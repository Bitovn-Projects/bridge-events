/**
 * Canonical event names. The single source of truth.
 *
 * Previously this list existed three times — room/src/utility/LoggerEvents.js,
 * bridge-analytics/src/events/LoggerEvents.js (already drifted) and hardcoded
 * string literals inside the backend's aggregation pipelines. Nothing could
 * detect when they disagreed.
 *
 * Rules:
 *  - A name here MUST have an entry in schema.js (enforced by test).
 *  - A name here MUST have at least one emitter in the room client (enforced by
 *    CI in that repo). Constants with no emitter are dead telemetry that reads
 *    as "we measure this" while measuring nothing — delete them instead.
 */

// ── Session lifecycle ──────────────────────────────────────────────────────
export const USER_JOINED = 'USER_JOINED';
// New in v2. The backend has counted this since the beginning; nothing has ever
// emitted it, so "Total Users Left" has always rendered 0.
export const USER_LEFT = 'USER_LEFT';
export const USER_REMOVED = 'USER_REMOVED';
// Periodic active/idle sample from the session tracker in App.svelte. It feeds
// the report's "Active Time" panel via /v1/user-active-duration. It was emitted
// as a bare string literal from Utility.sendSessionDataToServer and appears in
// no registry anywhere — exactly the kind of event that ingest validation would
// have started silently dropping.
export const USER_ACTIVE_TIME = 'USER_ACTIVE_TIME';

// ── Duration metrics ───────────────────────────────────────────────────────
// All INTERVAL except SPEAK_DURATION, which is a POINT measured by the audio
// worklet.
export const MIC_DURATION = 'MIC_DURATION';
export const VIDEO_DURATION = 'VIDEO_DURATION';
export const SCREENSHARE_DURATION = 'SCREENSHARE_DURATION';
export const SPEAK_DURATION = 'SPEAK_DURATION';

// ── Chat ───────────────────────────────────────────────────────────────────
export const CLICKED_ON_CHAT = 'CLICKED_ON_CHAT';
export const SENT_MESSAGE = 'SENT_MESSAGE';
export const RECEIVED_MESSAGE = 'RECEIVED_MESSAGE';

// ── Controls / UI ──────────────────────────────────────────────────────────
export const SETTINGS_CLICKED = 'SETTINGS_CLICKED';
export const PARTICIPANTS_CLICKED = 'PARTICIPANTS_CLICKED';
export const CHANGE_CAMERA = 'CHANGE_CAMERA';
export const CHANGE_AUDIO_INPUT = 'CHANGE_AUDIO_INPUT';
export const APPLIED_MEETING_FILTER = 'APPLIED_MEETING_FILTER';
export const RESET_CAMERA_MIC_OPTIONS = 'RESET_CAMERA_MIC_OPTIONS';
export const ENTER_FULL_SCREEN = 'ENTER_FULL_SCREEN';
export const EXIT_FULL_SCREEN = 'EXIT_FULL_SCREEN';
export const COPY_LINK = 'COPY_LINK';
export const CLICKED_ON_HOME = 'CLICKED_ON_HOME';
export const REPORT_ISSUE_CLICKED = 'REPORT_ISSUE_CLICKED';
export const ROOM_VARIANT_SWITCHED = 'ROOM_VARIANT_SWITCHED';
// Retained alongside the SCREENSHARE_DURATION interval: the interval carries the
// measurement, this marks the moment (it drives the meeting-moment screenshot
// and shows up in the event-stats panel).
export const SCREEN_SHARE_STOPPED = 'SCREEN_SHARE_STOPPED';

// ── Reactions ──────────────────────────────────────────────────────────────
export const CLAP_EVENT = 'CLAP';
export const EMOJI_EVENT = 'EMOJI_EVENT';
export const HAND_RAISED = 'HAND_RAISED';
export const HAND_DOWN = 'HAND_DOWN';

// ── Guest / approval flow ──────────────────────────────────────────────────
export const REQUESTED_TO_JOIN_AS_GUEST = 'REQUESTED_TO_JOIN_AS_GUEST';
export const GOT_REQUEST_FOR_GUEST = 'GOT_REQUEST_FOR_GUEST';
export const ACCEPTED_REQUEST_FOR_GUEST = 'ACCEPTED_REQUEST_FOR_GUEST';
export const DECLINED_REQUEST_FOR_GUEST = 'DECLINED_REQUEST_FOR_GUEST';

// ── Network ────────────────────────────────────────────────────────────────
export const SLOW_INTERNET_DETECTED = 'SLOW_INTERNET_DETECTED';
export const INTERNET_ERROR = 'INTERNET_ERROR';

// ── Errors ─────────────────────────────────────────────────────────────────
// Of these, only ERROR_ENABLING_MIC and GUEST_REQUEST_ERROR still had emitters
// when the pipeline was audited — the rest had been orphaned by refactors, so
// the report's error panel was showing stale rows from an older build. Phase 2
// re-instruments them at the existing catch blocks in RoomClient.js.
export const GUEST_REQUEST_ERROR = 'GUEST_REQUEST_ERROR';
export const NEW_CONSUMER_FAILED = 'NEW_CONSUMER_FAILED';
export const DATA_CONSUMER_CREATION_ERROR = 'DATA_CONSUMER_CREATION_ERROR';
export const CHAT_MESSAGE_RECEIVE_ERROR = 'CHAT_MESSAGE_RECEIVE_ERROR';
export const ERROR_ENABLING_MIC = 'ERROR_ENABLING_MIC';
export const EXCEPTION_ENABLING_MIC = 'EXCEPTION_ENABLING_MIC';
export const ERROR_DISABLING_MIC = 'ERROR_DISABLING_MIC';
export const ERROR_WHILE_MUTING_MIC = 'ERROR_WHILE_MUTING_MIC';
export const ERROR_WHILE_UNMUTING_MIC = 'ERROR_WHILE_UNMUTING_MIC';
export const ERROR_ENABLING_WEBCAM = 'ERROR_ENABLING_WEBCAM';
export const EXCEPTION_ENABLING_WEBCAM = 'EXCEPTION_ENABLING_WEBCAM';
export const ERROR_DISABLING_WEBCAM = 'ERROR_DISABLING_WEBCAM';
export const ERROR_CHANGING_WEBCAM = 'ERROR_CHANGING_WEBCAM';
export const ERROR_ENABLING_SHARE = 'ERROR_ENABLING_SHARE';
export const MEDIASOUP_ERROR_ENABLING_SHARE = 'MEDIASOUP_ERROR_ENABLING_SHARE';
export const EXCEPTION_ENABLING_SHARE = 'EXCEPTION_ENABLING_SHARE';
export const ERROR_DISABLING_SHARE = 'ERROR_DISABLING_SHARE';

/**
 * Removed in v2, listed so a stray reference is an obvious deletion rather than
 * a mystery, and so the CI drift check can flag any repo still using one:
 *
 *   CAMERA_ON, CAMERA_OFF, MIC_ON, MIC_OFF, SCREEN_SHARE_STARTED, SPEAK_STARTED
 *     — never events, only `details.type` marker strings. The INTERVAL kind
 *       replaces the whole marker convention.
 *   ERROR_LOGS, REMOVED_PARTICIPANTS, ENABLED_SCREENSHARE_AS_HOST,
 *   DISABLED_SCREENSHARE_AS_HOST
 *     — declared but never emitted by anything, in any build.
 */
export const REMOVED_IN_V2 = Object.freeze([
  'CAMERA_ON',
  'CAMERA_OFF',
  'MIC_ON',
  'MIC_OFF',
  'SCREEN_SHARE_STARTED',
  'SPEAK_STARTED',
  'ERROR_LOGS',
  'REMOVED_PARTICIPANTS',
  'ENABLED_SCREENSHARE_AS_HOST',
  'DISABLED_SCREENSHARE_AS_HOST',
]);
