import { h, loop, fitCanvas } from '../engine/dom.js';
import { reducedMotion, sleep, typeInto } from '../engine/motion.js';

export function mountIntro(container, ctx) {
  const abort = new AbortController();
  const { signal } = abort;
  let ready = false;

  const idLine = h('p', { class: 'intro__id', 'aria-hidden': 'true' });
  const title = h('h1', { class: 'intro__title' }, 'OBSCURA');
  const before = h('span', {});
  const word = h('button', { class: 'intro__word', type: 'button', hidden: true }, 'supposed');
  const after = h('span', {});
  const cursor = h('span', { class: 'cursor', 'aria-hidden': 'true' }, '_');
  const message = h('p', { class: 'intro__message', 'aria-label': "You weren't supposed to find this." }, before, word, after, cursor);
  const whisper = h('p', { class: 'intro__whisper', 'aria-live': 'polite' });
  const subtitle = h('p', { class: 'intro__sub' }, 'Somewhere between the known and the forgotten, something remains.');
  const alert = h('p', { class: 'intro__alert' }, h('span', { class: 'intro__pulse', 'aria-hidden': 'true' }), h('span', {}, 'AN UNCLASSIFIED ENTRY HAS BEEN DETECTED'), h('span', { class: 'intro__count' }, '1 UNKNOWN SIGNAL'));
  const enter = h('button', { class: 'intro__enter', type: 'button', hidden: true, onclick: () => go() }, h('span', { 'aria-hidden': 'true' }, '[ '), 'ENTER THE ARCHIVE', h('span', { 'aria-hidden': 'true' }, ' ]'));
  const skip = h('button', { class: 'intro__skip', type: 'button', onclick: () => go() }, 'skip');
  const canvas = h('canvas', { class: 'intro__field', 'aria-hidden': 'true' });

  const root = h('section', { class: 'intro', 'aria-label': 'Entrance' }, canvas, h('div', { class: 'intro__content' }, idLine, title, message, whisper, subtitle, alert, enter), skip);
  container.append(root);

  const parts = { before: "You weren't ", word: 'supposed', after: ' to find this.' };

  const specks = Array.from({ length: 70 }, (_, i) => ({
    x: (i * 0.618033) % 1,
    y: (i * 0.414213) % 1,
    r: 0.4 + ((i * 7) % 10) / 10,
    v: 0.004 + ((i * 3) % 7) / 2500,
  }));
  const stopField = loop((dt) => {
    const { width, height, ctx: g } = fitCanvas(canvas, 1.5);
    g.clearRect(0, 0, width, height);
    for (const s of specks) {
      if (!reducedMotion()) s.y = (s.y - s.v * dt * 10 + 1) % 1;
      g.fillStyle = `rgba(210,210,215,${0.05 + s.r * 0.07})`;
      g.fillRect(s.x * width, s.y * height, s.r, s.r);
    }
  });

  function finishInstantly() {
    idLine.textContent = 'OBS//ARCHIVE — ENTRY UNCATALOGUED';
    root.classList.add('is-title', 'is-sub', 'is-alert');
    before.textContent = parts.before;
    word.hidden = false;
    after.textContent = parts.after;
    reveal();
  }

  function reveal() {
    if (ready) return;
    ready = true;
    enter.hidden = false;
    root.classList.add('is-alert');
    enter.focus({ preventScroll: true });
  }

  async function sequence() {
    await sleep(500, signal);
    await typeInto(idLine, 'OBS//ARCHIVE — ENTRY UNCATALOGUED', { speed: 22, signal });
    root.classList.add('is-title');
    await sleep(1300, signal);
    await typeInto(before, parts.before, { speed: 42, signal });
    word.hidden = false;
    await typeInto(after, parts.after, { speed: 42, signal });
    await sleep(700, signal);
    root.classList.add('is-sub');
    await sleep(1100, signal);
    reveal();
  }

  const alreadyFound = () => Boolean(ctx.store.get().fragments.F5);
  let hintTimer = window.setTimeout(() => {
    if (!alreadyFound()) word.classList.add('is-hinting');
  }, 14000);

  word.addEventListener('click', () => {
    ctx.audio.burst(0.25, { freq: 2000, gain: 0.1 });
    title.classList.remove('is-glitching');
    void title.offsetWidth;
    title.classList.add('is-glitching');
    if (alreadyFound()) {
      whisper.textContent = 'You already know.';
    } else {
      whisper.textContent = '…but you were.';
      ctx.store.dispatch({ type: 'fragment/find', id: 'F5' });
      ctx.store.dispatch({ type: 'achievement/award', id: 'supposed' });
    }
    whisper.classList.add('is-visible');
    word.classList.remove('is-hinting');
  });

  function go() {
    abort.abort();
    ctx.store.dispatch({ type: 'intro/seen' });
    ctx.store.dispatch({ type: 'achievement/award', id: 'arrival' });
    ctx.navigate('archive');
  }

  const onKey = (event) => {
    if (event.key === 'Escape') {
      go();
    } else if (!ready && !event.metaKey && !event.ctrlKey && !event.altKey && !['Tab', 'Shift'].includes(event.key)) {
      abort.abort();
      finishInstantly();
    }
  };
  window.addEventListener('keydown', onKey);

  if (reducedMotion()) finishInstantly();
  else sequence().then(() => undefined);

  return {
    destroy() {
      abort.abort();
      stopField();
      window.clearTimeout(hintTimer);
      window.removeEventListener('keydown', onKey);
    },
  };
}
