import { ENTRIES } from './catalog.js';

export function matchRoute(hash) {
  const path = String(hash ?? '')
    .replace(/^#\/?/, '')
    .replace(/\/+$/, '')
    .toLowerCase()
    .slice(0, 64);

  if (path === '') return { view: 'home', path };
  if (path === 'archive') return { view: 'archive', path };
  if (path === 'journal') return { view: 'journal', path };
  if (path === 'submit') return { view: 'submit', path };

  const entry = ENTRIES.find((candidate) => candidate.route === path);
  if (entry) return { view: entry.route === 'origin' ? 'origin' : 'room', entryId: entry.id, path };

  return { view: 'notfound', path };
}

export const routeFor = (entry) => `#/${entry.route}`;
