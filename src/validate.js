import { getSchema, isKnownEvent } from './schema.js';
import { COUNT } from './kinds.js';

/**
 * Validate one event against the registry.
 *
 * Returns `{ ok, errors }` rather than throwing, so each consumer can choose its
 * own severity:
 *   - room client, dev build: throw, so a bad emit fails loudly at the call site
 *   - room client, prod build: log and send anyway — telemetry must never break
 *     the room
 *   - backend ingest: skip the entry and count it, but still 200 the batch. A
 *     rejected batch used to wedge the client's buffer permanently, and no
 *     telemetry problem is worth losing the rest of a call's data over.
 */
export function validate(event) {
  const errors = [];

  if (!event || typeof event !== 'object') {
    return { ok: false, errors: ['event must be an object'] };
  }

  const { message, details } = event;

  if (typeof message !== 'string' || message === '') {
    errors.push('message must be a non-empty string');
    return { ok: false, errors };
  }

  if (!isKnownEvent(message)) {
    return { ok: false, errors: [`unknown event "${message}"`] };
  }

  const schema = getSchema(message);
  const required = schema.required ?? [];

  if (required.length > 0) {
    if (details == null || typeof details !== 'object') {
      errors.push(`"${message}" requires details: ${required.join(', ')}`);
      return { ok: errors.length === 0, errors };
    }
    for (const key of required) {
      if (details[key] === undefined || details[key] === null) {
        errors.push(`"${message}" is missing required details.${key}`);
      }
    }
  }

  // A duration that isn't a finite non-negative number is worse than a missing
  // one: it sums into the report as a real value. NaN and negatives are exactly
  // what an unpaired or clock-skewed interval produces.
  if (schema.kind !== COUNT && details && details.durationMs !== undefined) {
    const value = details.durationMs;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      errors.push(`"${message}" details.durationMs must be a finite number >= 0 (got ${value})`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Decide what an incoming event IS, rather than whether to keep it.
 *
 * Ingest must never drop an event just because its payload is old. A v1 client
 * (state markers, `details.duration`, no `sessionId`) is a perfectly normal
 * thing to have in the field during a staged rollout — and since the backend
 * ships before the client, it is the EXPECTED state, not an error. Rejecting on
 * payload shape meant a live v1 build had every event refused at the door and
 * the whole call's telemetry lost, which is a worse failure than the one this
 * work set out to fix.
 *
 * So the only fatal condition is an unknown event NAME: that is a typo or a
 * deleted constant, and storing it would just pollute the collection.
 *
 * @returns { known, version, errors }
 *   known:false            → drop it and count it
 *   version:2              → satisfies the v2 contract
 *   version:1              → known name, legacy payload; STORE IT, marked v1 so
 *                            duration aggregations correctly skip it
 */
export function classifyEvent(event) {
  if (!event || typeof event !== 'object' || typeof event.message !== 'string' || event.message === '') {
    return { known: false, version: null, errors: ['event must be an object with a message string'] };
  }
  if (!isKnownEvent(event.message)) {
    return { known: false, version: null, errors: [`unknown event "${event.message}"`] };
  }

  const { ok, errors } = validate(event);
  return { known: true, version: ok ? 2 : 1, errors };
}

/** Convenience for the dev build: validate and throw on failure. */
export function assertValid(event) {
  const { ok, errors } = validate(event);
  if (!ok) {
    throw new Error(`[bridge-events] invalid event: ${errors.join('; ')}`);
  }
  return true;
}
