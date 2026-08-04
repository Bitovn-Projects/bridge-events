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

/** Convenience for the dev build: validate and throw on failure. */
export function assertValid(event) {
  const { ok, errors } = validate(event);
  if (!ok) {
    throw new Error(`[bridge-events] invalid event: ${errors.join('; ')}`);
  }
  return true;
}
