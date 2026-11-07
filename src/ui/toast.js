import { h } from '../engine/dom.js';
import { corruptInto, resolveInto } from '../engine/scramble.js';

/**
 * Notifications are signals that tear in out of static and decay back into it.
 * The visible text is animated and hidden from assistive technology; a clean
 * copy is what screen readers get, so nobody hears the noise.
 */
export function createToaster(parent) {
  const region = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'false' });
  parent.append(region);

  return {
    /**
     * @param {{ kind?: 'entry'|'complete'|'fragment'|'achievement'|'info', label: string, title: string, detail?: string, duration?: number }} options
     */
    show({ kind = 'info', label, title, detail = '', duration = 5600 }) {
      const labelEl = h('span', { class: 'toast__label', 'aria-hidden': 'true' });
      const titleEl = h('span', { class: 'toast__title', 'aria-hidden': 'true' });
      const detailEl = detail ? h('span', { class: 'toast__detail', 'aria-hidden': 'true' }) : null;
      const spoken = h('span', { class: 'visually-hidden' }, `${label}. ${title}.${detail ? ` ${detail}` : ''}`);

      const toast = h('div', { class: `toast toast--${kind}` }, h('span', { class: 'toast__mark', 'aria-hidden': 'true' }), h('div', { class: 'toast__body' }, labelEl, titleEl, detailEl), spoken);
      region.append(toast);
      while (region.children.length > 3) region.firstElementChild.remove();

      resolveInto(labelEl, label, { duration: 380 });
      resolveInto(titleEl, title, { duration: 760 });
      if (detailEl) resolveInto(detailEl, detail, { duration: 1100 });

      window.setTimeout(async () => {
        toast.classList.add('is-dying');
        corruptInto(titleEl, title, { duration: 520 });
        await new Promise((resolve) => window.setTimeout(resolve, 760));
        toast.remove();
      }, duration);
    },
  };
}
