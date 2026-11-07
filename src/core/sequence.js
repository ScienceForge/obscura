/**
 * Detects a word typed on the keyboard anywhere on a screen. Feed it every
 * keypress; it returns the matched word once, then resets. A pause between
 * keys clears the buffer, so ordinary typing never accumulates into a match.
 */
export function createSequenceDetector(words, { maxGapMs = 1500, now = () => Date.now() } = {}) {
  const longest = Math.max(...words.map((word) => word.length));
  let buffer = '';
  let last = 0;

  return {
    /** @param {string} key  a single character; anything else resets */
    push(key) {
      const time = now();
      if (time - last > maxGapMs) buffer = '';
      last = time;

      if (typeof key !== 'string' || key.length !== 1 || !/[a-z]/i.test(key)) {
        buffer = '';
        return null;
      }
      buffer = (buffer + key.toLowerCase()).slice(-longest);
      const match = words.find((word) => buffer.endsWith(word));
      if (match) {
        buffer = '';
        return match;
      }
      return null;
    },
    reset() {
      buffer = '';
    },
  };
}
