# @bitovn/bridge-events

Canonical event registry, payload schema and derived-metric definitions for Bridge analytics.

Consumed by three repos, which is the point — this list used to exist three times
(`room/src/utility/LoggerEvents.js`, `bridge-analytics/src/events/LoggerEvents.js`,
and hardcoded string literals in the backend's aggregation pipelines) and nothing
could detect when they disagreed. They had, silently.

## Why this package exists

The room client emitted camera/mic **state markers** (`{type: "CAMERA_ON"}`) while
the backend summed **durations** (`details.duration`). Nothing declared which
events carried a duration, so when the aggregation was changed to sum one,
nothing failed — the video and screen-share numbers just became zero and stayed
that way. `schema.js` is the artifact whose absence allowed that.

## Contents

| Module | Purpose |
|---|---|
| `events.js` | canonical event names, plus `REMOVED_IN_V2` |
| `kinds.js` | `COUNT` / `POINT` / `INTERVAL` |
| `schema.js` | per-event required payload |
| `metrics.js` | derived-metric definitions + contribution weights |
| `validate.js` | `validate(event)` / `assertValid(event)` |
| `compute.js` | reference implementation of the metrics |
| `version.js` | `SCHEMA_VERSION`, `MIN_USABLE_VERSION` |

## Event kinds

- **COUNT** — happened once. No measurement.
- **POINT** — a measurement at an instant. Carries `durationMs`.
- **INTERVAL** — an episode that started and ended. Emitted **only on close**,
  carrying `durationMs` and `startedAt`. There is no "start" row: the client owns
  the pairing, so a missing stop (browser-bar screen-share stop, abrupt tab
  close) can't leave the server guessing where an episode ended.

## Schema versions

Event *names* are stable across versions. The payload contract is not, so every
stored row carries a `schemaVersion` stamped by ingest.

- **v1** — state markers, no durations. Unusable for duration metrics, and
  unrepairable: the durations were never recorded.
- **v2** — closed intervals with `durationMs`.

Aggregations filter `schemaVersion >= MIN_USABLE_VERSION`. A room with only v1
rows must render as **"legacy data"**, never as `0s` — conflating "no data" with
"zero" is what kept the original bug invisible.

## `compute.js`

The production aggregation runs as a Mongo pipeline for volume reasons, and that
pipeline is precisely what nobody could check. `compute.js` is the executable
definition it must agree with, and the oracle the contract tests assert against.

## Consuming

```js
import { EV, validate, SCHEMA_VERSION, CONTRIBUTION_WEIGHTS } from '@bitovn/bridge-events';
```

## Adding an event

1. Add the name to `events.js`.
2. Add a `schema.js` entry with its kind and required payload. Tests fail otherwise.
3. If it feeds a report number, add it to `metrics.js`.
4. Emit it from the room client. CI there fails on a registry constant with no
   emitter — a constant nobody emits reads as "we measure this" while measuring
   nothing, which is how ~20 error events came to be dead.

## Tests

```bash
npm test
```
