const query = window.matchMedia('(prefers-reduced-motion: reduce)');

/** True when the visitor has asked their system for less motion. */
export const reducedMotion = () => query.matches;

export const sleep = (ms, signal) =>
  new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      window.clearTimeout(timer);
      resolve();
    }, { once: true });
  });

/**
 * Type text into an element one character at a time. Resolves when finished
 * or aborted; under reduced motion the whole text appears at once. The
 * element always ends up holding the complete text.
 */
export async function typeInto(el, text, { speed = 28, signal } = {}) {
  if (reducedMotion() || speed <= 0) {
    el.textContent = text;
    return;
  }
  el.textContent = '';
  for (let i = 1; i <= text.length; i += 1) {
    if (signal?.aborted) break;
    el.textContent = text.slice(0, i);
    const char = text[i - 1];
    await sleep(char === '.' || char === ',' ? speed * 7 : speed, signal);
  }
  el.textContent = text;
}
