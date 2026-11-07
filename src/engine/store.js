import { apply, createProgress, normalizeProgress, resetProgress } from '../core/progress.js';

const STORAGE_KEY = 'obscura:progress:v1';

function browserStorage() {
  try {
    const storage = globalThis.localStorage;
    storage.setItem('__obscura_probe__', '1');
    storage.removeItem('__obscura_probe__');
    return storage;
  } catch {
    return null;
  }
}

const randomHex = () =>
  Math.floor(Math.random() * 0x10000)
    .toString(16)
    .toUpperCase()
    .padStart(4, '0');

export function createProgressStore({ backend = browserStorage(), now = () => new Date(), createId = randomHex } = {}) {
  const persistent = backend !== null;
  const memory = new Map();
  const fresh = () => createProgress({ now: now(), visitorId: createId() });

  const read = () => {
    try {
      return persistent ? backend.getItem(STORAGE_KEY) : (memory.get(STORAGE_KEY) ?? null);
    } catch {
      return null;
    }
  };

  let notice = '';
  let state = (() => {
    const text = read();
    if (text === null) return fresh();
    try {
      return normalizeProgress(JSON.parse(text), fresh());
    } catch {
      notice = 'Stored progress could not be read, so the archive started fresh.';
      return fresh();
    }
  })();

  const listeners = new Set();
  const eventListeners = new Set();
  let writeFailed = false;

  function persist() {
    const text = JSON.stringify(state);
    try {
      if (persistent) backend.setItem(STORAGE_KEY, text);
      else memory.set(STORAGE_KEY, text);
      writeFailed = false;
    } catch {
      writeFailed = true;
    }
  }

  function commit(next, events = []) {
    if (next === state) return events;
    state = next;
    persist();
    for (const listener of [...listeners]) listener(state);
    for (const event of events) for (const listener of [...eventListeners]) listener(event);
    return events;
  }

  return {
    persistent,
    get notice() {
      return notice;
    },
    get writeFailed() {
      return writeFailed;
    },
    get: () => state,
    dispatch(action) {
      const result = apply(state, action, now());
      return commit(result.progress, result.events);
    },
    reset() {
      commit(resetProgress(state, now()));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onEvent(listener) {
      eventListeners.add(listener);
      return () => eventListeners.delete(listener);
    },
  };
}
