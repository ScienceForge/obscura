export function createSequenceDetector(words, { maxGapMs = 1500, now = () => Date.now() } = {}) {
  const longest = Math.max(...words.map((word) => word.length));
  let buffer = '';
  let last = 0;

  return {
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
