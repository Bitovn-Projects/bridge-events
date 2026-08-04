/**
 * Every event in the registry is exactly one of these three kinds.
 *
 * The distinction exists because the original pipeline had no notion of it: the
 * client emitted camera on/off *markers* while the backend tried to *sum
 * durations*, and nothing in the system could detect the mismatch. Declaring a
 * kind per event makes that contract checkable.
 */

/** Something happened once. Carries no measurement. */
export const COUNT = 'COUNT';

/** A measurement taken at an instant. Carries `durationMs`. */
export const POINT = 'POINT';

/**
 * An episode that started and ended.
 *
 * Emitted ONLY on close, carrying the `durationMs` of the episode that just
 * ended. There is deliberately no "start" row: the client owns the pairing, so
 * the backend never has to match a start against a stop — which is what used to
 * fail whenever a stop went missing (browser-bar screen-share stop, tab close,
 * a dropped toggle).
 */
export const INTERVAL = 'INTERVAL';

export const KINDS = [COUNT, POINT, INTERVAL];
