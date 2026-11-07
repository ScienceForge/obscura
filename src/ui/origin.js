import { FRAGMENTS } from '../core/catalog.js';
import { h } from '../engine/dom.js';

const redactLine = (text) => text.replace(/[^\s]/g, '█');

/**
 * THE_ORIGIN: the archive's fictional history, assembled from fragments the
 * visitor has found elsewhere. Missing fragments stay redacted, so visiting
 * early is never a dead end. It just shows how much is still unread.
 */
export function mountOrigin(container, ctx) {
  const { store } = ctx;
  store.dispatch({ type: 'achievement/award', id: 'origin_seen' });

  const root = h('section', { class: 'origin' });
  container.append(root);

  function render() {
    const p = store.get();
    const found = FRAGMENTS.filter((fragment) => p.fragments[fragment.id]).length;
    const complete = found === FRAGMENTS.length;

    root.replaceChildren(
      h('header', { class: 'origin__head' },
        h('p', { class: 'eyebrow' }, 'OBS-0000 — UNCLASSIFIED'),
        h('h1', { class: 'origin__title', tabindex: '-1' }, 'THE_ORIGIN'),
        h('p', { class: 'origin__lede' }, complete ? 'Nothing here is redacted any more.' : `${found} of ${FRAGMENTS.length} fragments recovered. The rest is still dark.`)),
      h('ol', { class: 'origin__list' }, FRAGMENTS.map((fragment, index) => {
        const got = Boolean(p.fragments[fragment.id]);
        const text = got
          ? fragment.id === 'F7'
            ? `${fragment.text} It is filed under ${p.visitorId}.`
            : fragment.text
          : redactLine(fragment.text);
        return h('li', { class: `origin__item${got ? ' is-found' : ' is-missing'}`, style: { '--i': String(index) } },
          h('span', { class: 'origin__id' }, fragment.id),
          h('p', { class: 'origin__text', 'aria-label': got ? undefined : 'Redacted fragment' }, text),
          h('span', { class: 'origin__source' }, got ? `recovered from: ${fragment.source}` : 'source: unknown'));
      })),
      complete
        ? h('p', { class: 'origin__end' }, 'That is everything the archive knows about itself. The rest, it has decided, is yours.')
        : h('p', { class: 'origin__hint' }, 'Fragments are kept in the rooms, and in places that are not rooms. The discovery log can offer a hint.'),
      h('p', { class: 'origin__back' }, h('a', { class: 'link', href: '#/archive' }, 'return to the archive'), ' · ', h('a', { class: 'link', href: '#/journal' }, 'discovery log')),
    );
  }

  const unsubscribe = store.subscribe(() => render());
  render();
  root.querySelector('.origin__title')?.focus({ preventScroll: true });

  return { destroy: unsubscribe };
}
