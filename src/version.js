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
 *
 * Aggregations filter `schemaVersion >= 2`. A room with only v1 rows must
 * render as "legacy data", never as `0s` — conflating "no data" with "zero" is
 * what kept the original bug invisible.
 */
export const SCHEMA_VERSION = 2;

/** Oldest version whose rows are usable for duration metrics. */
export const MIN_USABLE_VERSION = 2;
