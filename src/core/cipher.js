/**
 * Room 002, Signal Lost: three transmissions, each harder to read.
 *
 *  1. a shifted alphabet (turn the dial until it clears)
 *  2. a mirrored alphabet that is also shifted (flip the phase, then tune)
 *  3. a keyword cipher (the first room says what you carry)
 */

const A = 65;
const mod = (n, m) => ((n % m) + m) % m;

/** Shift letters by `shift` (negative to undo). Other characters are untouched. */
export function caesar(text, shift) {
  return [...text.toUpperCase()]
    .map((char) => {
      const code = char.charCodeAt(0);
      return code >= A && code < A + 26 ? String.fromCharCode(A + mod(code - A + shift, 26)) : char;
    })
    .join('');
}

/** A↔Z, B↔Y, and so on. */
export function atbash(text) {
  return [...text.toUpperCase()]
    .map((char) => {
      const code = char.charCodeAt(0);
      return code >= A && code < A + 26 ? String.fromCharCode(A + 25 - (code - A)) : char;
    })
    .join('');
}

/** Vigenère with a repeating key; the key only advances on letters. */
export function vigenere(text, key, { decrypt = false } = {}) {
  const shifts = [...key.toUpperCase()].filter((c) => c >= 'A' && c <= 'Z').map((c) => c.charCodeAt(0) - A);
  if (shifts.length === 0) return text.toUpperCase();
  let index = 0;
  return [...text.toUpperCase()]
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code < A || code >= A + 26) return char;
      const shift = shifts[index % shifts.length] * (decrypt ? -1 : 1);
      index += 1;
      return String.fromCharCode(A + mod(code - A + shift, 26));
    })
    .join('');
}

const PLAIN = {
  t1: 'THE SIGNAL IS NOT BROKEN. YOU ARE JUST LATE.',
  t2: 'STILL HERE. STILL LISTENING. STILL LOOKING FOR YOU.',
  t3: 'THE FIRST TRANSMISSION ARRIVED ON A FREQUENCY NO ONE HAD TUNED. THE OPERATORS CALLED IT INTERFERENCE. IT WAS STILL ARRIVING WHEN THEY LEFT.',
};

export const TRANSMISSIONS = [
  {
    id: 't1',
    label: 'TRANSMISSION 01',
    method: 'shift',
    shift: 7,
    plain: PLAIN.t1,
    cipher: caesar(PLAIN.t1, 7),
    hints: [
      'The letters are all there. They have only slid along the alphabet.',
      'Turn the dial slowly. The signal strength rises as you get closer.',
      'The meter peaks at exactly one setting. Read the text there.',
    ],
  },
  {
    id: 't2',
    label: 'TRANSMISSION 02',
    method: 'mirror',
    shift: 11,
    plain: PLAIN.t2,
    cipher: caesar(atbash(PLAIN.t2), 11),
    hints: [
      'This one has been reflected as well as slid.',
      'Flip the phase switch first, then tune the dial.',
      'With the phase flipped, the meter will peak at exactly one setting.',
    ],
  },
  {
    id: 't3',
    label: 'TRANSMISSION 03',
    method: 'keyword',
    key: 'LIGHT',
    plain: PLAIN.t3,
    cipher: vigenere(PLAIN.t3, 'LIGHT'),
    fragment: 'F2',
    hints: [
      'This transmission is locked with a word, not a dial.',
      'The first room told you what you carry.',
      'The word is five letters. It begins with L.',
    ],
  },
];

export const TRANSMISSION_INDEX = new Map(TRANSMISSIONS.map((t) => [t.id, t]));

/**
 * What the visitor currently sees for a transmission.
 * @param {{ shift?: number, mirror?: boolean, key?: string }} attempt
 */
export function decode(transmission, attempt = {}) {
  switch (transmission.method) {
    case 'shift':
      return caesar(transmission.cipher, -(attempt.shift ?? 0));
    case 'mirror': {
      const shifted = caesar(transmission.cipher, -(attempt.shift ?? 0));
      return attempt.mirror ? atbash(shifted) : shifted;
    }
    case 'keyword': {
      const key = (attempt.key ?? '').replace(/[^a-z]/gi, '');
      return key ? vigenere(transmission.cipher, key.padEnd(transmission.key.length, 'A'), { decrypt: true }) : transmission.cipher;
    }
    default:
      return transmission.cipher;
  }
}

export function isSolved(transmission, attempt = {}) {
  return decode(transmission, attempt) === transmission.plain;
}

const circularDistance = (a, b) => {
  const d = Math.abs(mod(a, 26) - mod(b, 26));
  return Math.min(d, 26 - d);
};

/** 0..1, how clear the signal is. Reaches 1 only when the text is correct. */
export function signalStrength(transmission, attempt = {}) {
  if (isSolved(transmission, attempt)) return 1;
  switch (transmission.method) {
    case 'shift':
      return Math.min(0.97, (1 - circularDistance(attempt.shift ?? 0, transmission.shift) / 13) ** 3);
    case 'mirror': {
      const tuning = (1 - circularDistance(attempt.shift ?? 0, transmission.shift) / 13) ** 3;
      return Math.min(0.97, attempt.mirror ? tuning : tuning * 0.45);
    }
    case 'keyword': {
      const key = (attempt.key ?? '').toUpperCase().replace(/[^A-Z]/g, '');
      const hits = [...transmission.key].filter((letter, i) => key[i] === letter).length;
      return Math.min(0.97, hits / transmission.key.length);
    }
    default:
      return 0;
  }
}
