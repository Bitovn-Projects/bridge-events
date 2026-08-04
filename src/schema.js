import * as EV from './events.js';
import { COUNT, POINT, INTERVAL } from './kinds.js';

/**
 * Per-event payload contract.
 *
 * This file is the artifact whose absence caused the original bug. Nothing
 * declared that `SPEAK_DURATION` carries a duration in ms while `VIDEO_DURATION`
 * carried only a marker string, so when the backend was changed to sum
 * `details.duration` for both, nothing failed — the video numbers just silently
 * became zero and stayed that way.
 *
 * Entry shape:
 *   kind      COUNT | POINT | INTERVAL
 *   required  keys that MUST be present in `details`
 *   optional  keys that MAY be present
 *   units     unit of the measurement, for POINT/INTERVAL
 *   since     schema version the event was introduced in
 */

const count = (extra = {}) => ({ kind: COUNT, required: [], optional: [], since: 1, ...extra });
const duration = (kind, extra = {}) => ({
  kind,
  required: kind === INTERVAL ? ['durationMs', 'startedAt'] : ['durationMs'],
  optional: [],
  units: 'ms',
  since: 2,
  ...extra,
});

export const SCHEMA = Object.freeze({
  // ── Session lifecycle ────────────────────────────────────────────────────
  // sessionId is what makes join/leave counts correct across reconnects: a
  // reconnect re-runs the join path, and counting raw USER_JOINED rows inflated
  // "Total Users Joined" every time the network hiccupped.
  [EV.USER_JOINED]: count({ required: ['sessionId'], optional: ['device', 'role'] }),
  [EV.USER_LEFT]: count({ required: ['sessionId'], optional: ['reason'], since: 2 }),
  [EV.USER_REMOVED]: count({ optional: ['sessionId', 'removedBy'] }),
  // NOTE: activeTime/inactiveTime are in SECONDS, not milliseconds — the one
  // measurement in the system that doesn't use ms. Left alone deliberately:
  // renaming or rescaling would break fetchUserActiveDuration and every stored
  // row. Worth normalising in a future schema version, not in this one.
  [EV.USER_ACTIVE_TIME]: count({ required: ['activeTime', 'inactiveTime'], units: 's' }),

  // ── Duration metrics ─────────────────────────────────────────────────────
  [EV.MIC_DURATION]: duration(INTERVAL),
  [EV.VIDEO_DURATION]: duration(INTERVAL),
  [EV.SCREENSHARE_DURATION]: duration(INTERVAL),
  // POINT, not INTERVAL: the audio worklet reports a completed speaking burst
  // it has already measured. This is the one duration metric that was always
  // correct, because it was the one that always carried its duration.
  [EV.SPEAK_DURATION]: duration(POINT, { since: 1 }),

  // ── Chat ─────────────────────────────────────────────────────────────────
  [EV.CLICKED_ON_CHAT]: count(),
  [EV.SENT_MESSAGE]: count(),
  [EV.RECEIVED_MESSAGE]: count(),

  // ── Controls / UI ────────────────────────────────────────────────────────
  [EV.SETTINGS_CLICKED]: count(),
  [EV.PARTICIPANTS_CLICKED]: count(),
  [EV.CHANGE_CAMERA]: count({ optional: ['deviceId'] }),
  [EV.CHANGE_AUDIO_INPUT]: count({ optional: ['deviceId'] }),
  [EV.APPLIED_MEETING_FILTER]: count({ optional: ['filter'] }),
  [EV.RESET_CAMERA_MIC_OPTIONS]: count(),
  [EV.ENTER_FULL_SCREEN]: count(),
  [EV.EXIT_FULL_SCREEN]: count(),
  [EV.COPY_LINK]: count(),
  [EV.CLICKED_ON_HOME]: count(),
  [EV.REPORT_ISSUE_CLICKED]: count({ optional: ['reason'] }),
  [EV.ROOM_VARIANT_SWITCHED]: count({ optional: ['to'] }),
  [EV.SCREEN_SHARE_STOPPED]: count(),

  // ── Reactions ────────────────────────────────────────────────────────────
  [EV.CLAP_EVENT]: count(),
  [EV.EMOJI_EVENT]: count({ optional: ['emoji'] }),
  [EV.HAND_RAISED]: count(),
  [EV.HAND_DOWN]: count(),

  // ── Guest / approval flow ────────────────────────────────────────────────
  [EV.REQUESTED_TO_JOIN_AS_GUEST]: count(),
  [EV.GOT_REQUEST_FOR_GUEST]: count({ optional: ['userId'] }),
  [EV.ACCEPTED_REQUEST_FOR_GUEST]: count({ optional: ['userId'] }),
  [EV.DECLINED_REQUEST_FOR_GUEST]: count({ optional: ['userId'] }),

  // ── Network ──────────────────────────────────────────────────────────────
  [EV.SLOW_INTERNET_DETECTED]: count({ optional: ['level', 'latencyMs'] }),
  [EV.INTERNET_ERROR]: count({ optional: ['level'] }),

  // ── Errors ───────────────────────────────────────────────────────────────
  // `reason` is optional throughout: an error event with no detail is still far
  // more useful than the error going unrecorded, and requiring a field would
  // mean a catch block that can't supply it emits nothing at all.
  [EV.GUEST_REQUEST_ERROR]: count({ optional: ['reason'] }),
  [EV.NEW_CONSUMER_FAILED]: count({ optional: ['reason', 'kind'] }),
  [EV.DATA_CONSUMER_CREATION_ERROR]: count({ optional: ['reason'] }),
  [EV.CHAT_MESSAGE_RECEIVE_ERROR]: count({ optional: ['reason'] }),
  [EV.ERROR_ENABLING_MIC]: count({ optional: ['reason'] }),
  [EV.EXCEPTION_ENABLING_MIC]: count({ optional: ['reason'] }),
  [EV.ERROR_DISABLING_MIC]: count({ optional: ['reason'] }),
  [EV.ERROR_WHILE_MUTING_MIC]: count({ optional: ['reason'] }),
  [EV.ERROR_WHILE_UNMUTING_MIC]: count({ optional: ['reason'] }),
  [EV.ERROR_ENABLING_WEBCAM]: count({ optional: ['reason'] }),
  [EV.EXCEPTION_ENABLING_WEBCAM]: count({ optional: ['reason'] }),
  [EV.ERROR_DISABLING_WEBCAM]: count({ optional: ['reason'] }),
  [EV.ERROR_CHANGING_WEBCAM]: count({ optional: ['reason'] }),
  [EV.ERROR_ENABLING_SHARE]: count({ optional: ['reason'] }),
  [EV.MEDIASOUP_ERROR_ENABLING_SHARE]: count({ optional: ['reason'] }),
  [EV.EXCEPTION_ENABLING_SHARE]: count({ optional: ['reason'] }),
  [EV.ERROR_DISABLING_SHARE]: count({ optional: ['reason'] }),
});

/** Every event name the system knows about. */
export const EVENT_NAMES = Object.freeze(Object.keys(SCHEMA));

export function getSchema(name) {
  return SCHEMA[name];
}

export function isKnownEvent(name) {
  return Object.prototype.hasOwnProperty.call(SCHEMA, name);
}

/** Names whose kind carries a measurable duration — used by the aggregations. */
export const DURATION_EVENTS = Object.freeze(
  EVENT_NAMES.filter((name) => SCHEMA[name].kind === POINT || SCHEMA[name].kind === INTERVAL)
);
