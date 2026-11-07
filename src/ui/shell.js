import { h } from '../engine/dom.js';
import { reducedMotion } from '../engine/motion.js';
import { createToaster } from './toast.js';

/**
 * The frame around every screen: film grain, vignette, a minimal header, the
 * stage views mount into, and notifications. The header is deliberately quiet,
 * and hidden entirely on the opening screen.
 */
export function createShell(root, { onToggleSound }) {
  const where = h('span', { class: 'bar__where' });
  const sound = h('button', { class: 'bar__btn', type: 'button', 'aria-pressed': 'false', onclick: onToggleSound }, 'SND OFF');
  const bar = h(
    'header',
    { class: 'bar' },
    h('a', { class: 'bar__mark', href: '#/archive', 'aria-label': 'OBSCURA, return to the archive' }, 'OBSCURA'),
    where,
    h('nav', { class: 'bar__nav', 'aria-label': 'Archive' }, sound, h('a', { class: 'bar__btn', href: '#/journal' }, 'LOG')),
  );

  const stage = h('main', { class: 'stage', id: 'stage', tabindex: '-1' });
  const skip = h('a', { class: 'skip-link', href: '#stage', onclick: (event) => { event.preventDefault(); stage.focus(); } }, 'Skip to content');

  const vignette = h('div', { class: 'vignette', 'aria-hidden': 'true' });
  root.append(skip, h('div', { class: 'grain', 'aria-hidden': 'true' }), vignette, bar, stage);
  const toaster = createToaster(document.body);

  return {
    stage,
    toast: toaster.show,
    setWhere(text) {
      where.textContent = text ?? '';
    },
    /** The edges of the screen flush red for a moment, as if something noticed. */
    pulse() {
      if (reducedMotion()) return;
      vignette.classList.remove('is-pulsing');
      void vignette.offsetWidth;
      vignette.classList.add('is-pulsing');
    },
    setView(name) {
      document.body.dataset.view = name;
    },
    setSound(on, supported) {
      sound.textContent = supported ? (on ? 'SND ON' : 'SND OFF') : 'NO SND';
      sound.setAttribute('aria-pressed', String(on));
      sound.disabled = !supported;
    },
    /** Fade the stage out, run `swap`, then fade back in. */
    async transition(swap) {
      if (reducedMotion()) {
        swap();
        return;
      }
      stage.classList.add('is-out');
      await new Promise((resolve) => window.setTimeout(resolve, 160));
      swap();
      stage.classList.remove('is-out');
      stage.classList.add('is-in');
      window.setTimeout(() => stage.classList.remove('is-in'), 500);
    },
  };
}
