import { METRICS, AGG, CONTRIBUTION_WEIGHTS } from './metrics.js';
import { MIN_USABLE_VERSION } from './version.js';
import * as EV from './events.js';

/**
 * Reference implementation of the derived metrics, over a plain array of stored
 * event documents.
 *
 * The production aggregation runs as a Mongo pipeline for volume reasons, but
 * that pipeline is exactly what nobody could check — it silently produced zeros
 * for two years. This is the executable definition it must agree with, and the
 * oracle the contract tests assert against.
 */

function usable(event) {
  return (event.schemaVersion ?? 1) >= MIN_USABLE_VERSION;
}

function sumDuration(events, name) {
  let total = 0;
  for (const event of events) {
    if (event.message !== name || !usable(event)) continue;
    const value = event.details?.durationMs;
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      total += value;
    }
  }
  return total;
}

function readPath(object, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), object);
}

/**
 * @param events  stored event documents for one room
 * @returns per-user durations, room-level counts, and a `hasUsableData` flag.
 */
export function computeMetrics(events) {
  const userIds = [...new Set(events.map((e) => e.userId).filter((id) => id != null))];

  const perUser = {};
  for (const userId of userIds) {
    const own = events.filter((e) => e.userId === userId);
    perUser[userId] = {
      userId,
      speakMs: sumDuration(own, EV.SPEAK_DURATION),
      videoMs: sumDuration(own, EV.VIDEO_DURATION),
      micMs: sumDuration(own, EV.MIC_DURATION),
      shareMs: sumDuration(own, EV.SCREENSHARE_DURATION),
    };
  }

  const room = {};
  for (const [name, metric] of Object.entries(METRICS)) {
    if (metric.per !== 'room') continue;
    const matching = events.filter((e) => e.message === metric.event && usable(e));
    if (metric.agg === AGG.COUNT) {
      room[name] = matching.length;
    } else if (metric.agg === AGG.COUNT_DISTINCT) {
      room[name] = new Set(matching.map((e) => readPath(e, metric.field))).size;
    }
  }

  return {
    // Distinguishes "we have no v2 data for this room" from "everything really
    // was zero". Rendering those two the same way is what hid the original bug.
    hasUsableData: events.some(usable),
    perUser,
    room,
  };
}

/**
 * Contribution score. Each user's time normalised against the TOP user's time —
 * NOT against meeting duration. Absolute milliseconds are returned alongside so
 * a caller can label the percentage honestly.
 */
export function computeContribution(perUser) {
  const rows = Object.values(perUser);
  const max = (key) => rows.reduce((acc, row) => Math.max(acc, row[key] ?? 0), 0);

  const maxSpeak = max('speakMs');
  const maxVideo = max('videoMs');
  const maxShare = max('shareMs');

  const audioWeight = maxShare > 0 ? CONTRIBUTION_WEIGHTS.audioWhenSharing : CONTRIBUTION_WEIGHTS.audio;

  // Guarded division: with no data at all the max is 0, and x/0 is NaN, which
  // used to propagate into the report as a blank cell.
  const ratio = (value, maximum) => (maximum > 0 ? value / maximum : 0);

  return rows
    .map((row) => {
      const audioScore = ratio(row.speakMs, maxSpeak) * audioWeight;
      const videoScore = ratio(row.videoMs, maxVideo) * CONTRIBUTION_WEIGHTS.video;
      const screenshareScore = ratio(row.shareMs, maxShare) * CONTRIBUTION_WEIGHTS.screenshare;
      return {
        ...row,
        audioScore,
        videoScore,
        screenshareScore,
        score: audioScore + videoScore + screenshareScore,
      };
    })
    .sort((a, b) => b.score - a.score);
}
