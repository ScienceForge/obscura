import { h } from '../engine/dom.js';

/** Placeholder until the submission form is built. */
export function mountSubmit(container) {
  container.append(h('section', { class: 'notice' }, h('h1', { class: 'notice__title' }, 'Transmissions are not open yet'), h('a', { class: 'link', href: '#/archive' }, 'return to the archive')));
  return { destroy() {} };
}
