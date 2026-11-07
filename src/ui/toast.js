import { h } from '../engine/dom.js';

/** In-world notifications: a small labelled line that fades after a few seconds. */
export function createToaster(parent) {
  const region = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'false' });
  parent.append(region);

  return {
    show({ label, title, detail = '', duration = 5200 }) {
      const toast = h('div', { class: 'toast' }, h('p', { class: 'toast__label' }, label), h('p', { class: 'toast__title' }, title), detail ? h('p', { class: 'toast__detail' }, detail) : null);
      region.append(toast);
      while (region.children.length > 3) region.firstElementChild.remove();
      window.setTimeout(() => {
        toast.classList.add('is-leaving');
        window.setTimeout(() => toast.remove(), 600);
      }, duration);
    },
  };
}
