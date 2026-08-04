import test from 'node:test';
import assert from 'node:assert/strict';

import * as EV from '../src/events.js';
import { computeMetrics, computeContribution } from '../src/compute.js';
import { SCHEMA_VERSION } from '../src/version.js';

const v2 = (userId, message, details) => ({
  userId,
  roomId: 'room-1',
  message,
  details,
  schemaVersion: SCHEMA_VERSION,
});

const v1 = (userId, message, details) => ({
  userId,
  roomId: 'room-1',
  message,
  details,
  schemaVersion: 1,
});

// One synthetic call, with known-by-construction totals:
//   alice — speaks 30s, camera on 60s (two episodes), shares 20s
//   bob   — speaks 10s, camera on 30s, never shares
//   3 chat messages, 1 filter, both users join and leave once each
function syntheticCall() {
  return [
    v2('alice', EV.USER_JOINED, { sessionId: 'a1' }),
    v2('bob', EV.USER_JOINED, { sessionId: 'b1' }),

    v2('alice', EV.SPEAK_DURATION, { durationMs: 20000 }),
    v2('alice', EV.SPEAK_DURATION, { durationMs: 10000 }),
    v2('bob', EV.SPEAK_DURATION, { durationMs: 10000 }),

    v2('alice', EV.VIDEO_DURATION, { durationMs: 40000, startedAt: 1 }),
    v2('alice', EV.VIDEO_DURATION, { durationMs: 20000, startedAt: 2 }),
    v2('bob', EV.VIDEO_DURATION, { durationMs: 30000, startedAt: 1 }),

    v2('alice', EV.SCREENSHARE_DURATION, { durationMs: 20000, startedAt: 1 }),

    v2('alice', EV.SENT_MESSAGE),
    v2('alice', EV.SENT_MESSAGE),
    v2('bob', EV.SENT_MESSAGE),
    v2('alice', EV.APPLIED_MEETING_FILTER),

    v2('alice', EV.USER_LEFT, { sessionId: 'a1', reason: 'left' }),
    v2('bob', EV.USER_LEFT, { sessionId: 'b1', reason: 'unload' }),
  ];
}

test('per-user durations sum across episodes', () => {
  const { perUser } = computeMetrics(syntheticCall());

  assert.equal(perUser.alice.speakMs, 30000);
  assert.equal(perUser.alice.videoMs, 60000);
  assert.equal(perUser.alice.shareMs, 20000);

  assert.equal(perUser.bob.speakMs, 10000);
  assert.equal(perUser.bob.videoMs, 30000);
  assert.equal(perUser.bob.shareMs, 0);
});

test('room counts', () => {
  const { room } = computeMetrics(syntheticCall());

  assert.equal(room.messagesExchanged, 3);
  assert.equal(room.filtersApplied, 1);
  assert.equal(room.usersJoined, 2);
  assert.equal(room.usersLeft, 2);
});

test('reconnects do not inflate the join count', () => {
  // The join path re-runs on every protoo reconnect. Counting rows made "Total
  // Users Joined" climb with every network hiccup; distinct sessionId fixes it.
  const events = [
    v2('alice', EV.USER_JOINED, { sessionId: 'a1' }),
    v2('alice', EV.USER_JOINED, { sessionId: 'a1' }),
    v2('alice', EV.USER_JOINED, { sessionId: 'a1' }),
    v2('bob', EV.USER_JOINED, { sessionId: 'b1' }),
  ];
  assert.equal(computeMetrics(events).room.usersJoined, 2);
});

test('v1 marker rows contribute nothing and are reported as unusable', () => {
  // Exactly the corrupt shape: a camera marker with no duration. It must not
  // silently read as 0 — the caller has to be able to say "legacy data".
  const events = [
    v1('alice', EV.VIDEO_DURATION, { type: 'CAMERA_ON' }),
    v1('alice', EV.VIDEO_DURATION, { type: 'CAMERA_OFF' }),
  ];
  const result = computeMetrics(events);

  assert.equal(result.perUser.alice.videoMs, 0);
  assert.equal(result.hasUsableData, false);
});

test('mixed v1 and v2 rows count only the v2 ones', () => {
  const events = [
    v1('alice', EV.VIDEO_DURATION, { type: 'CAMERA_ON' }),
    v2('alice', EV.VIDEO_DURATION, { durationMs: 5000, startedAt: 1 }),
  ];
  const result = computeMetrics(events);

  assert.equal(result.perUser.alice.videoMs, 5000);
  assert.equal(result.hasUsableData, true);
});

test('malformed durations are ignored rather than poisoning the sum', () => {
  const events = [
    v2('alice', EV.SPEAK_DURATION, { durationMs: 1000 }),
    v2('alice', EV.SPEAK_DURATION, { durationMs: Number.NaN }),
    v2('alice', EV.SPEAK_DURATION, { durationMs: -500 }),
    v2('alice', EV.SPEAK_DURATION, { durationMs: '2000' }),
  ];
  assert.equal(computeMetrics(events).perUser.alice.speakMs, 1000);
});

test('contribution ranks the top contributor first and returns absolutes', () => {
  const { perUser } = computeMetrics(syntheticCall());
  const [top, second] = computeContribution(perUser);

  assert.equal(top.userId, 'alice');
  assert.equal(second.userId, 'bob');

  // Absolutes travel with the score so the UI can label the percentage.
  assert.equal(top.speakMs, 30000);
  assert.equal(second.videoMs, 30000);

  // bob speaks a third as long as alice, so his audio component is a third of
  // hers — the score is relative to the top user, not to the meeting.
  assert.ok(Math.abs(second.audioScore - top.audioScore / 3) < 1e-9);
});

test('contribution does not produce NaN when a whole category is empty', () => {
  // Nobody shared a screen: maxShare is 0, and the old code divided by it.
  const { perUser } = computeMetrics([
    v2('alice', EV.SPEAK_DURATION, { durationMs: 1000 }),
  ]);
  const [row] = computeContribution(perUser);

  assert.ok(Number.isFinite(row.score));
  assert.equal(row.screenshareScore, 0);
  assert.equal(row.videoScore, 0);
});

test('an empty room yields zeros, not NaN, and flags no usable data', () => {
  const result = computeMetrics([]);
  assert.equal(result.hasUsableData, false);
  assert.deepEqual(result.perUser, {});
  assert.equal(result.room.messagesExchanged, 0);
});
