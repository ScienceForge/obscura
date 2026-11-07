import { h } from '../engine/dom.js';
import { reducedMotion } from '../engine/motion.js';

const VIGIL_SECONDS = 14;
const MOVE_LIMIT_PX = 60;

export function mount(container, ctx) {
  const { store } = ctx;
  let timer = 0;
  let elapsed = 0;
  let staying = false;
  let anchor = null;
  let done = Boolean(store.get().completed['OBS-0013']);

  const dot = h('span', { class: 'quiet__dot', 'aria-hidden': 'true' });
  const status = h('p', { class: 'quiet__status', role: 'status', 'aria-live': 'polite' });
  const stay = h('button', { class: 'quiet__stay', type: 'button', onclick: () => (staying ? stopVigil('You left. The room did not mind.') : startVigil()) }, 'stay');
  const lines = h('div', { class: 'quiet__lines' });
  const root = h('section', { class: 'quiet', 'aria-label': 'The Quiet Room' },
    h('h1', { class: 'visually-hidden', tabindex: '-1' }, 'The Quiet Room'),
    dot, status, lines, stay,
    h('a', { class: 'quiet__leave link', href: '#/archive' }, 'leave'));
  container.append(root);

  const script = [
    'There is nothing here.',
    'That is not the same as there being nobody here.',
    'Every signal the archive has received was someone looking for it.',
    'You are the one it kept looking for.',
  ];

  function say(text) {
    status.textContent = text;
  }

  function startVigil() {
    staying = true;
    elapsed = 0;
    anchor = null;
    stay.textContent = 'leave quietly';
    root.classList.add('is-staying');
    say(done ? 'You are welcome to stay.' : 'Stay still. Pointer and all.');
    timer = window.setInterval(tick, 1000);
  }

  function stopVigil(message) {
    staying = false;
    window.clearInterval(timer);
    root.classList.remove('is-staying');
    stay.textContent = 'stay';
    root.style.setProperty('--vigil', '0');
    if (message) say(message);
  }

  function tick() {
    elapsed += 1;
    root.style.setProperty('--vigil', String(Math.min(1, elapsed / VIGIL_SECONDS)));
    if (elapsed >= VIGIL_SECONDS && !done) conclude();
  }

  async function conclude() {
    done = true;
    stopVigil('');
    stay.hidden = true;
    ctx.audio.burst(1.2, { freq: 200, gain: 0.08, type: 'lowpass' });
    for (let i = 0; i < script.length; i += 1) {
      lines.append(h('p', { class: 'quiet__line', style: { '--i': String(reducedMotion() ? 0 : i) } }, script[i]));
    }
    say('');
    store.dispatch({ type: 'fragment/find', id: 'F7' });
    store.dispatch({ type: 'achievement/award', id: 'observed' });
    store.dispatch({ type: 'room/complete', id: 'OBS-0013' });
  }

  function onMove(event) {
    if (!staying || done) return;
    if (!anchor) {
      anchor = { x: event.clientX, y: event.clientY };
      return;
    }
    if (Math.hypot(event.clientX - anchor.x, event.clientY - anchor.y) > MOVE_LIMIT_PX) {
      elapsed = 0;
      anchor = { x: event.clientX, y: event.clientY };
      root.style.setProperty('--vigil', '0');
      say('It noticed you. Begin again.');
    }
  }
  window.addEventListener('pointermove', onMove);

  if (done) {
    for (const text of script) lines.append(h('p', { class: 'quiet__line is-settled' }, text));
    stay.hidden = true;
  } else {
    say('A very quiet room. You can stay for a while.');
  }

  root.querySelector('h1').focus({ preventScroll: true });

  return {
    destroy() {
      window.clearInterval(timer);
      window.removeEventListener('pointermove', onMove);
    },
  };
}
