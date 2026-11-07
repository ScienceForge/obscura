import { ENTRIES, ENTRY_INDEX } from './catalog.js';

export function entryStatus(progress, entry) {
  if (entry.hidden && !progress.discovered[entry.id]) return 'hidden';
  if (progress.completed[entry.id]) return 'complete';
  const missing = entry.requires.filter((id) => !progress.completed[id]);
  return missing.length > 0 ? 'sealed' : 'open';
}

export function visibleEntries(progress) {
  return ENTRIES.map((entry) => ({ entry, status: entryStatus(progress, entry) })).filter(
    ({ status }) => status !== 'hidden',
  );
}

export function canOpen(progress, entryId) {
  const entry = ENTRY_INDEX.get(entryId);
  if (!entry) return false;
  const status = entryStatus(progress, entry);
  return status === 'open' || status === 'complete' || status === 'hidden';
}

export function missingRequirements(progress, entry) {
  return entry.requires.filter((id) => !progress.completed[id]).map((id) => ENTRY_INDEX.get(id)?.title ?? id);
}
