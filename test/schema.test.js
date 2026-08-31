import test from 'node:test';
import assert from 'node:assert/strict';

import * as EV from '../src/events.js';
import { REMOVED_IN_V2 } from '../src/events.js';
import { SCHEMA, EVENT_NAMES, DURATION_EVENTS } from '../src/schema.js';
import { KINDS, COUNT, INTERVAL, POINT } from '../src/kinds.js';
import { validate, classifyEvent } from '../src/validate.js';
import { SCHEMA_VERSION } from '../src/version.js';

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
  // MEDIA_STATE_CHANGED is the one documented exception — see the
  // "MEDIA_STATE_CHANGED is in DURATION_EVENTS" test above for why.
  for (const name of DURATION_EVENTS) {
    if (name === 'MEDIA_STATE_CHANGED') continue;
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

test('the four original duration metrics are still in DURATION_EVENTS', () => {
  // Regression guard for the original bug: VIDEO_DURATION and
  // SCREENSHARE_DURATION were treated as duration-carrying by the backend while
  // the client emitted them as bare markers. If either ever drops out of this
  // set, the report silently reads 0 again.
  //
  // Not an exact-equality check any more (Bitovn/Bridge-issues#1589 added a 5th
  // member, see the next test) — a subset check keeps this guard's original
  // purpose without re-breaking every time DURATION_EVENTS legitimately grows.
  const original = ['MIC_DURATION', 'SCREENSHARE_DURATION', 'SPEAK_DURATION', 'VIDEO_DURATION'];
  for (const name of original) {
    assert.ok(DURATION_EVENTS.includes(name), `${name} dropped out of DURATION_EVENTS`);
  }
});

test('MEDIA_STATE_CHANGED is in DURATION_EVENTS despite carrying no duration', () => {
  // Bitovn/Bridge-issues#1589 — DURATION_EVENTS is defined as "kind is POINT
  // or INTERVAL", not "carries durationMs". MEDIA_STATE_CHANGED is a POINT (a
  // discrete on/off marker, not a measurement) so it gets swept into this set
  // by that filter even though it has no durationMs field at all. Documented
  // here rather than silently shipped: any consumer that assumes every member
  // of DURATION_EVENTS is summable by details.durationMs needs to special-case
  // this one (or the filter itself needs a narrower definition — out of scope
  // for #1589, flagged in its PR).
  assert.ok(DURATION_EVENTS.includes('MEDIA_STATE_CHANGED'));
  assert.equal(SCHEMA.MEDIA_STATE_CHANGED.required.includes('durationMs'), false);
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

test('classifyEvent keeps v1 payloads instead of dropping them', () => {
  // REGRESSION: ingest briefly validated every entry against the v2 contract and
  // dropped whatever failed. Because the backend deploys before the client, the
  // live v1 build had its ENTIRE telemetry refused at the door and every call's
  // data was lost. A known name must always be stored; only the version differs.
  const v1Camera = { message: EV.VIDEO_DURATION, details: { type: 'CAMERA_ON' } };
  const v1Speak = { message: EV.SPEAK_DURATION, details: { duration: 1200 } };
  const v1Join = { message: EV.USER_JOINED };

  for (const event of [v1Camera, v1Speak, v1Join]) {
    const result = classifyEvent(event);
    assert.equal(result.known, true, `${event.message} must be kept`);
    assert.equal(result.version, 1, `${event.message} must be stamped v1`);
  }
});

test('classifyEvent marks a well-formed payload with the current SCHEMA_VERSION', () => {
  // Bitovn/Bridge-issues#1589 — was hardcoded to the literal 2 here (matching
  // classifyEvent's own former hardcoding); both now reference SCHEMA_VERSION
  // so a future bump can't silently drift the two apart again.
  assert.deepEqual(
    classifyEvent({
      message: EV.VIDEO_DURATION,
      details: { durationMs: 1000, startedAt: 1 },
    }),
    { known: true, version: SCHEMA_VERSION, errors: [] }
  );
});

test('classifyEvent drops only unknown names', () => {
  assert.equal(classifyEvent({ message: 'TOTALLY_MADE_UP' }).known, false);
  assert.equal(classifyEvent({ message: 'CAMERA_ON' }).known, false);
  assert.equal(classifyEvent(null).known, false);
});

test('validate rejects unknown event names', () => {
  assert.equal(validate({ message: 'TOTALLY_MADE_UP' }).ok, false);
  assert.equal(validate({ message: 'CAMERA_ON' }).ok, false);
});
