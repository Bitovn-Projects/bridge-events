import test from 'node:test';
import assert from 'node:assert/strict';

import * as EV from '../src/events.js';
import { REMOVED_IN_V2 } from '../src/events.js';
import { SCHEMA, EVENT_NAMES, DURATION_EVENTS } from '../src/schema.js';
import { KINDS, COUNT, INTERVAL, POINT } from '../src/kinds.js';
import { validate } from '../src/validate.js';

// Everything exported from events.js that is a plain event-name string.
const exportedNames = Object.entries(EV)
  .filter(([key, value]) => typeof value === 'string' && key !== 'REMOVED_IN_V2')
  .map(([, value]) => value);

test('every exported event name has a schema entry', () => {
  for (const name of exportedNames) {
    assert.ok(SCHEMA[name], `missing schema entry for ${name}`);
  }
});

test('every schema entry is an exported event name', () => {
  for (const name of EVENT_NAMES) {
    assert.ok(exportedNames.includes(name), `schema has orphan entry ${name}`);
  }
});

test('every schema entry declares a valid kind', () => {
  for (const [name, entry] of Object.entries(SCHEMA)) {
    assert.ok(KINDS.includes(entry.kind), `${name} has invalid kind ${entry.kind}`);
  }
});

test('COUNT events require no details', () => {
  for (const [name, entry] of Object.entries(SCHEMA)) {
    if (entry.kind !== COUNT) continue;
    // A COUNT may still require an identity field (sessionId); what it must not
    // require is a measurement.
    assert.ok(
      !(entry.required ?? []).includes('durationMs'),
      `${name} is COUNT but requires durationMs`
    );
  }
});

test('POINT and INTERVAL events require durationMs', () => {
  for (const name of DURATION_EVENTS) {
    assert.ok(
      SCHEMA[name].required.includes('durationMs'),
      `${name} carries a measurement but does not require durationMs`
    );
  }
});

test('INTERVAL events require startedAt', () => {
  for (const [name, entry] of Object.entries(SCHEMA)) {
    if (entry.kind !== INTERVAL) continue;
    assert.ok(
      entry.required.includes('startedAt'),
      `${name} is INTERVAL but does not require startedAt`
    );
  }
});

test('the four duration metrics are exactly the ones the report depends on', () => {
  // Regression guard for the original bug: VIDEO_DURATION and
  // SCREENSHARE_DURATION were treated as duration-carrying by the backend while
  // the client emitted them as bare markers. If either ever drops out of this
  // set, the report silently reads 0 again.
  assert.deepEqual(
    [...DURATION_EVENTS].sort(),
    ['MIC_DURATION', 'SCREENSHARE_DURATION', 'SPEAK_DURATION', 'VIDEO_DURATION']
  );
});

test('removed v2 names are not resurrected as events', () => {
  for (const name of REMOVED_IN_V2) {
    assert.ok(!SCHEMA[name], `${name} was removed in v2 but is back in the schema`);
  }
});

test('SPEAK_DURATION is a POINT, not an INTERVAL', () => {
  // The audio worklet reports an already-measured burst; treating it as an
  // interval would mean the client had to open/close it, which it cannot.
  assert.equal(SCHEMA.SPEAK_DURATION.kind, POINT);
});

test('validate accepts a well-formed event of each kind', () => {
  assert.ok(validate({ message: EV.SENT_MESSAGE }).ok);
  assert.ok(validate({ message: EV.SPEAK_DURATION, details: { durationMs: 1200 } }).ok);
  assert.ok(
    validate({
      message: EV.VIDEO_DURATION,
      details: { durationMs: 45000, startedAt: 1_700_000_000_000 },
    }).ok
  );
});

test('validate rejects the exact shapes that caused the original bug', () => {
  // A v1 camera marker: no duration at all. The backend summed these to zero.
  const marker = validate({ message: EV.VIDEO_DURATION, details: { type: 'CAMERA_ON' } });
  assert.equal(marker.ok, false);

  // An unpaired/skewed interval producing a negative duration.
  const negative = validate({
    message: EV.VIDEO_DURATION,
    details: { durationMs: -5, startedAt: 1 },
  });
  assert.equal(negative.ok, false);

  // NaN from arithmetic on a missing start timestamp.
  const nan = validate({
    message: EV.MIC_DURATION,
    details: { durationMs: Number.NaN, startedAt: 1 },
  });
  assert.equal(nan.ok, false);
});

test('validate rejects unknown event names', () => {
  assert.equal(validate({ message: 'TOTALLY_MADE_UP' }).ok, false);
  assert.equal(validate({ message: 'CAMERA_ON' }).ok, false);
});
