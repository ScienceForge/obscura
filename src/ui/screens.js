import { missingRequirements } from '../core/access.js';
import { h } from '../engine/dom.js';

/** Small full-screen states. None of them is ever a dead end. */

export function mountNotFound(container, _ctx, { path }) {
  container.append(
    h('section', { class: 'notice' },
      h('p', { class: 'eyebrow' }, 'OBS-0404'),
      h('h1', { class: 'notice__title', tabindex: '-1' }, 'No signal at this address'),
      h('p', { class: 'notice__text' }, `Nothing is filed under “${path.slice(0, 40)}”. It may have been moved. It may never have existed.`),
      h('a', { class: 'link', href: '#/archive' }, 'return to the archive')),
  );
  container.querySelector('.notice__title').focus({ preventScroll: true });
  return { destroy() {} };
}

export function mountSealed(container, ctx, { entry }) {
  const missing = missingRequirements(ctx.store.get(), entry);
  container.append(
    h('section', { class: 'notice' },
      h('p', { class: 'eyebrow' }, `${entry.id} — SEALED`),
      h('h1', { class: 'notice__title', tabindex: '-1' }, 'This entry is not open yet'),
      h('p', { class: 'notice__text' }, entry.sealedHint),
      h('p', { class: 'notice__text notice__text--dim' }, `Needs: ${missing.join(', ')}.`),
      h('a', { class: 'link', href: '#/archive' }, 'return to the archive')),
  );
  container.querySelector('.notice__title').focus({ preventScroll: true });
  return { destroy() {} };
}

export function mountUnavailable(container, _ctx, { entry }) {
  container.append(
    h('section', { class: 'notice' },
      h('p', { class: 'eyebrow' }, `${entry.id} — UNAVAILABLE`),
      h('h1', { class: 'notice__title', tabindex: '-1' }, 'This room could not be loaded'),
      h('p', { class: 'notice__text' }, 'Something went wrong while opening it. Reloading the page usually helps, and your progress is safe.'),
      h('a', { class: 'link', href: '#/archive' }, 'return to the archive')),
  );
  container.querySelector('.notice__title').focus({ preventScroll: true });
  return { destroy() {} };
}
