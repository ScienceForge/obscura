import {
  ACHIEVEMENTS,
  ACHIEVEMENT_INDEX,
  ENTRY_INDEX,
  FRAGMENT_INDEX,
} from './catalog.js';

/**
 * Visitor progress, as pure functions. `apply` takes a progress object and an
 * action and returns the new progress plus a list of events (things worth
 * telling the visitor about). Nothing here touches storage or the DOM.
 */

export const PROGRESS_VERSION = 1;
export const HISTORY_LIMIT = 200;

export function createProgress({ now = new Date(), visitorId = '0000' } = {}) {
  return {
    version: PROGRESS_VERSION,
    visitorId: `V-${visitorId}`,
    createdAt: now.toISOString(),
    introSeen: false,
    sound: false,
    discovered: {},
    completed: {},
    fragments: {},
    achievements: {},
    hints: {},
    history: [],
  };
}

const iso = (now) => now.toISOString();

function record(progress, now, type, ref) {
  const history = [...progress.history, { t: iso(now), type, ref }];
  return { ...progress, history: history.slice(-HISTORY_LIMIT) };
}

/** Award any rule-based achievements newly satisfied. */
function awardRules(progress, now, events) {
  let next = progress;
  for (const achievement of ACHIEVEMENTS) {
    if (achievement.rule && !next.achievements[achievement.id] && achievement.rule(next)) {
      next = { ...next, achievements: { ...next.achievements, [achievement.id]: iso(now) } };
      next = record(next, now, 'achievement', achievement.id);
      events.push({ type: 'achievement', id: achievement.id });
    }
  }
  return next;
}

/**
 * @param {object} progress
 * @param {{ type: string, [key: string]: any }} action
 * @param {Date} [now]
 * @returns {{ progress: object, events: Array<{ type: string, id: string }> }}
 */
export function apply(progress, action, now = new Date()) {
  const events = [];
  let next = progress;

  switch (action.type) {
    case 'intro/seen':
      if (!next.introSeen) next = { ...next, introSeen: true };
      break;

    case 'sound/set':
      next = { ...next, sound: Boolean(action.on) };
      break;

    case 'entry/discover': {
      const entry = ENTRY_INDEX.get(action.id);
      if (!entry || next.discovered[entry.id]) break;
      next = { ...next, discovered: { ...next.discovered, [entry.id]: iso(now) } };
      next = record(next, now, 'entry', entry.id);
      events.push({ type: 'entry', id: entry.id });
      break;
    }

    case 'room/complete': {
      const entry = ENTRY_INDEX.get(action.id);
      if (!entry || next.completed[entry.id]) break;
      next = { ...next, completed: { ...next.completed, [entry.id]: iso(now) } };
      next = record(next, now, 'complete', entry.id);
      events.push({ type: 'complete', id: entry.id });
      break;
    }

    case 'fragment/find': {
      if (!FRAGMENT_INDEX.has(action.id) || next.fragments[action.id]) break;
      next = { ...next, fragments: { ...next.fragments, [action.id]: iso(now) } };
      next = record(next, now, 'fragment', action.id);
      events.push({ type: 'fragment', id: action.id });
      break;
    }

    case 'achievement/award': {
      if (!ACHIEVEMENT_INDEX.has(action.id) || next.achievements[action.id]) break;
      next = { ...next, achievements: { ...next.achievements, [action.id]: iso(now) } };
      next = record(next, now, 'achievement', action.id);
      events.push({ type: 'achievement', id: action.id });
      break;
    }

    case 'hint/use': {
      if (!FRAGMENT_INDEX.has(action.id) || next.fragments[action.id]) break;
      const level = Math.min(FRAGMENT_INDEX.get(action.id).hints.length, (next.hints[action.id] ?? 0) + 1);
      next = { ...next, hints: { ...next.hints, [action.id]: level } };
      break;
    }

    default:
      break;
  }

  if (next !== progress) next = awardRules(next, now, events);
  return { progress: next, events };
}

/** Wipe discoveries but keep who the visitor is and their sound preference. */
export function resetProgress(progress, now = new Date()) {
  return {
    ...createProgress({ now, visitorId: progress.visitorId.replace(/^V-/, '') }),
    sound: progress.sound,
  };
}

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isIso = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value));

function cleanTimestamps(raw, allowed) {
  const out = {};
  if (!isRecord(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (allowed(key) && isIso(value)) out[key] = value;
  }
  return out;
}

/** Turn untrusted stored data into valid progress. */
export function normalizeProgress(raw, fallback) {
  if (!isRecord(raw)) return fallback;
  const base = fallback;
  const visitorId = typeof raw.visitorId === 'string' && /^V-[0-9A-F]{4}$/.test(raw.visitorId) ? raw.visitorId : base.visitorId;

  const hints = {};
  if (isRecord(raw.hints)) {
    for (const [id, level] of Object.entries(raw.hints)) {
      const fragment = FRAGMENT_INDEX.get(id);
      if (fragment && Number.isInteger(level) && level > 0) hints[id] = Math.min(level, fragment.hints.length);
    }
  }

  const history = Array.isArray(raw.history)
    ? raw.history
        .filter((item) => isRecord(item) && isIso(item.t) && ['entry', 'complete', 'fragment', 'achievement'].includes(item.type) && typeof item.ref === 'string')
        .map((item) => ({ t: item.t, type: item.type, ref: item.ref.slice(0, 24) }))
        .slice(-HISTORY_LIMIT)
    : [];

  return {
    version: PROGRESS_VERSION,
    visitorId,
    createdAt: isIso(raw.createdAt) ? raw.createdAt : base.createdAt,
    introSeen: raw.introSeen === true,
    sound: raw.sound === true,
    discovered: cleanTimestamps(raw.discovered, (id) => ENTRY_INDEX.has(id)),
    completed: cleanTimestamps(raw.completed, (id) => ENTRY_INDEX.has(id)),
    fragments: cleanTimestamps(raw.fragments, (id) => FRAGMENT_INDEX.has(id)),
    achievements: cleanTimestamps(raw.achievements, (id) => ACHIEVEMENT_INDEX.has(id)),
    hints,
    history,
  };
}
