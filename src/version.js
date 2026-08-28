/**
 * Payload-contract version, stamped onto every stored event by the ingest
 * endpoint.
 *
 * Event NAMES are stable across versions — renaming them would orphan every
 * historical row and every saved query for no benefit. What changes is the
 * shape of `details`, so the version is what tells an aggregation whether a row
 * is usable:
 *
 *   v1 — state markers. `VIDEO_DURATION` carried `{type: "CAMERA_ON"}` and no
 *        duration at all, while the backend summed `details.duration`. Every
 *        video and screen-share number derived from these rows was zero. They
 *        cannot be repaired: the durations were never recorded.
 *   v2 — closed intervals. Duration events carry `durationMs`, always.
 *   v3 — Bitovn/Bridge-issues#1589. No duration-payload shape change — this
 *        bump is for the registry additions themselves (RECONNECT_ATTEMPT/
 *        SUCCEEDED/FAILED, MEDIA_STATE_CHANGED), matching how v2 also covered
 *        USER_LEFT/NEW_CONSUMER_FAILED/etc alongside the interval-shape
 *        change. MIN_USABLE_VERSION stays 2: existing duration aggregations
 *        are unaffected, nothing about MIC/VIDEO/SCREENSHARE_DURATION's
 *        payload shape changed here.
 *
 * Aggregations filter `schemaVersion >= 2`. A room with only v1 rows must
 * render as "legacy data", never as `0s` — conflating "no data" with "zero" is
 * what kept the original bug invisible.
 */
export const SCHEMA_VERSION = 3;

/** Oldest version whose rows are usable for duration metrics. */
export const MIN_USABLE_VERSION = 2;
