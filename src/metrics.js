import * as EV from './events.js';

/**
 * Derived-metric definitions.
 *
 * Both the backend aggregation and the report UI read these, so a metric can
 * only be defined once. Previously "total speak time" existed as a Mongo
 * pipeline in meeting-repo.js and, separately, as an assumption in the Svelte
 * components — and the two could disagree without anything noticing.
 *
 * `agg`:
 *   sumDuration   sum details.durationMs
 *   count         count matching rows
 *   countDistinct count distinct values of `field`
 */

export const AGG = Object.freeze({
  SUM_DURATION: 'sumDuration',
  COUNT: 'count',
  COUNT_DISTINCT: 'countDistinct',
});

export const METRICS = Object.freeze({
  totalSpeakTime: {
    event: EV.SPEAK_DURATION,
    agg: AGG.SUM_DURATION,
    per: 'user',
    label: 'Total speak time',
    units: 'ms',
  },
  videoOnTime: {
    event: EV.VIDEO_DURATION,
    agg: AGG.SUM_DURATION,
    per: 'user',
    label: 'Camera on',
    units: 'ms',
  },
  micOnTime: {
    event: EV.MIC_DURATION,
    agg: AGG.SUM_DURATION,
    per: 'user',
    label: 'Mic on',
    units: 'ms',
  },
  screenShareTime: {
    event: EV.SCREENSHARE_DURATION,
    agg: AGG.SUM_DURATION,
    per: 'user',
    label: 'Screen share',
    units: 'ms',
  },
  messagesExchanged: {
    event: EV.SENT_MESSAGE,
    agg: AGG.COUNT,
    per: 'room',
    label: 'Messages exchanged',
  },
  filtersApplied: {
    event: EV.APPLIED_MEETING_FILTER,
    agg: AGG.COUNT,
    per: 'room',
    label: 'Filters applied',
  },
  // Distinct by sessionId, not a raw row count: a reconnect re-runs the join
  // path, so counting rows inflated this every time the network hiccupped.
  usersJoined: {
    event: EV.USER_JOINED,
    agg: AGG.COUNT_DISTINCT,
    field: 'details.sessionId',
    per: 'room',
    label: 'Total users joined',
  },
  usersLeft: {
    event: EV.USER_LEFT,
    agg: AGG.COUNT_DISTINCT,
    field: 'details.sessionId',
    per: 'room',
    label: 'Total users left',
  },
});

/**
 * Contribution-score weights.
 *
 * Note what this score IS: each user's time normalised against the TOP user's
 * time, not against the meeting duration. "Audio 60%" therefore means "60% of
 * however long the most talkative person spoke", not "spoke for 60% of the
 * call". The report has always rendered it as a bare percentage, which reads as
 * the second. Callers must present absolute durations alongside it — see
 * CONTRIBUTION_OUTPUT_FIELDS.
 */
export const CONTRIBUTION_WEIGHTS = Object.freeze({
  audio: 0.6,
  // When anyone in the room shared a screen, audio's weight drops to make room
  // for the screenshare component.
  audioWhenSharing: 0.5,
  video: 0.4,
  screenshare: 0.1,
});

/**
 * Absolute per-user values the aggregation must return alongside the normalised
 * score, so the UI can label honestly and can tell "no data" apart from "zero".
 */
export const CONTRIBUTION_OUTPUT_FIELDS = Object.freeze([
  'speakMs',
  'videoMs',
  'micMs',
  'shareMs',
]);

export function getMetric(name) {
  return METRICS[name];
}

export const METRIC_NAMES = Object.freeze(Object.keys(METRICS));
