import { reducedMotion } from './motion.js';

const GLYPHS = '█▓▒░#%&/\\|<>-_=+*?';
const pick = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

/** Same-length noise for a string, keeping spaces so the shape of the text survives. */
export const noiseFor = (text) => [...text].map((c) => (c === ' ' ? ' ' : pick())).join('');

/**
 * Resolve garbled text into the real thing, left to right, the way a signal
 * locks on. The element always ends up holding the exact text, and under
 * reduced motion it simply gets it at once.
 */
export function resolveInto(el, text, { duration = 700, startScrambled = true } = {}) {
  if (reducedMotion() || duration <= 0) {
    el.textContent = text;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const locked = Math.floor(progress * text.length);
      el.textContent = [...text].map((char, i) => (i < locked || char === ' ' ? char : startScrambled || i > locked ? pick() : char)).join('');
      if (progress < 1) requestAnimationFrame(step);
      else {
        el.textContent = text;
        resolve();
      }
    };
    requestAnimationFrame(step);
    // Animation frames pause in background tabs; make sure the text is never left garbled.
    window.setTimeout(() => {
      el.textContent = text;
      resolve();
    }, duration + 200);
  });
}

/** Corrupt text progressively, then stop at pure noise. */
export function corruptInto(el, text, { duration = 500 } = {}) {
  if (reducedMotion() || duration <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      el.textContent = [...text].map((char) => (char === ' ' ? char : Math.random() < progress ? pick() : char)).join('');
      if (progress < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
    window.setTimeout(resolve, duration + 200);
  });
}
