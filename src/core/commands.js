import { ENTRY_INDEX } from './catalog.js';

/**
 * Parse what a visitor types at the archive prompt. Returns a plain action
 * object; the UI decides what to do with it. Unknown input is not an error.
 * It is a "miss", which the archive answers in character.
 *
 * @returns {{ type: string, [key: string]: any }}
 */
export function parseCommand(input) {
  const text = String(input ?? '').trim().replace(/\s+/g, ' ').slice(0, 64);
  if (!text) return { type: 'empty' };

  const lower = text.toLowerCase();
  const [verb, ...rest] = lower.split(' ');
  const argument = rest.join(' ');

  const identifier = normalizeIdentifier(argument || lower);
  if (identifier && (verb === 'open' || verb === 'enter' || verb === 'go' || !argument)) {
    return { type: 'identifier', id: identifier };
  }

  switch (verb) {
    case 'help':
    case '?':
      return { type: 'help' };
    case 'ls':
    case 'list':
    case 'index':
      return { type: 'list' };
    case 'journal':
    case 'history':
    case 'log':
      return { type: 'navigate', route: 'journal' };
    case 'submit':
    case 'transmit':
      return { type: 'navigate', route: 'submit' };
    case 'clear':
    case 'cls':
      return { type: 'clear' };
    case 'sound':
      return { type: 'sound', on: argument === 'off' ? false : true };
    case 'intro':
    case 'replay':
      return { type: 'intro' };
    case 'hint':
      return { type: 'hint' };
    case 'whoami':
      return { type: 'whoami' };
    case 'lumen':
      return { type: 'secret', word: 'lumen' };
    default:
      return { type: 'miss', text };
  }
}

/** "obs-0001", "OBS0001", "0001" and "1" all mean OBS-0001. */
export function normalizeIdentifier(text) {
  const match = /^(?:obs)?-?\s*(\d{1,4})$/i.exec(String(text).trim());
  if (!match) return null;
  return `OBS-${match[1].padStart(4, '0')}`;
}

/** Does this identifier exist in the catalog? */
export function isKnownIdentifier(id) {
  return ENTRY_INDEX.has(id);
}
