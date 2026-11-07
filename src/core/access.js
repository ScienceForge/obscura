import { ENTRIES, ENTRY_INDEX } from './catalog.js';

/**
 * What the visitor can currently see and open.
 *
 *  hidden   not yet discovered; does not appear in the archive at all
 *  sealed   visible, but its prerequisites are not complete
 *  open     can be entered, not yet completed
 *  complete entered and finished
 */
export function entryStatus(progress, entry) {
  if (entry.hidden && !progress.discovered[entry.id]) return 'hidden';
  if (progress.completed[entry.id]) return 'complete';
  const missing = entry.requires.filter((id) => !progress.completed[id]);
  return missing.length > 0 ? 'sealed' : 'open';
}

/** Entries shown in the archive list, in catalog order. */
export function visibleEntries(progress) {
  return ENTRIES.map((entry) => ({ entry, status: entryStatus(progress, entry) })).filter(
    ({ status }) => status !== 'hidden',
  );
}

/** Can this route be opened? Hidden secrets can always be reached by identifier. */
export function canOpen(progress, entryId) {
  const entry = ENTRY_INDEX.get(entryId);
  if (!entry) return false;
  const status = entryStatus(progress, entry);
  return status === 'open' || status === 'complete' || status === 'hidden';
}

/** Which prerequisites are still missing, as titles, for the sealed message. */
export function missingRequirements(progress, entry) {
  return entry.requires.filter((id) => !progress.completed[id]).map((id) => ENTRY_INDEX.get(id)?.title ?? id);
}
