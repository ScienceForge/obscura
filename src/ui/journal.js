import { ACHIEVEMENTS, ACHIEVEMENT_INDEX, ENTRY_INDEX, FRAGMENTS } from '../core/catalog.js';
import { h } from '../engine/dom.js';

const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const when = (iso) => (iso ? dateFormat.format(new Date(iso)) : '');

function describe(item) {
  switch (item.type) {
    case 'entry': return ['ENTRY LOGGED', `${item.ref} · ${ENTRY_INDEX.get(item.ref)?.title ?? 'Unknown'}`];
    case 'complete': return ['COMPLETE', `${item.ref} · ${ENTRY_INDEX.get(item.ref)?.title ?? 'Unknown'}`];
    case 'fragment': return ['FRAGMENT', `${item.ref} recovered`];
    case 'achievement': return ['ACHIEVEMENT', ACHIEVEMENT_INDEX.get(item.ref)?.title ?? item.ref];
    default: return ['EVENT', item.ref];
  }
}

export function mountJournal(container, ctx) {
  const { store } = ctx;
  let confirming = false;
  const root = h('section', { class: 'journal' });
  container.append(root);

  function render() {
    const p = store.get();
    const fragmentCount = Object.keys(p.fragments).length;
    const achievementCount = Object.keys(p.achievements).length;

    const history = [...p.history].reverse();

    root.replaceChildren(
      h('header', { class: 'journal__head' }, h('p', { class: 'eyebrow' }, 'OBS//ARCHIVE — YOUR RECORD'), h('h1', { class: 'journal__title', tabindex: '-1' }, 'Discovery log'), h('p', { class: 'journal__lede' }, `You are ${p.visitorId}. First noted ${when(p.createdAt)}. This record is kept only in this browser.`)),

      h('section', { class: 'journal__block', 'aria-labelledby': 'j-history' }, h('h2', { class: 'journal__h', id: 'j-history' }, 'History'),
        history.length === 0
          ? h('p', { class: 'empty' }, 'Nothing logged yet. The archive is patient.')
          : h('ol', { class: 'history' }, history.map((item) => { const [label, text] = describe(item); return h('li', {}, h('time', { datetime: item.t }, when(item.t)), h('span', { class: 'history__label' }, label), h('span', {}, text)); }))),

      h('section', { class: 'journal__block', 'aria-labelledby': 'j-frag' }, h('h2', { class: 'journal__h', id: 'j-frag' }, `Fragments ${fragmentCount} / ${FRAGMENTS.length}`),
        fragmentCount > 0 ? h('p', { class: 'journal__note' }, 'Recovered fragments are filed under ', h('a', { class: 'link', href: '#/origin' }, 'OBS-0000'), '.') : h('p', { class: 'journal__note' }, 'Fragments of something are scattered through the archive. None have been recovered yet.'),
        h('ul', { class: 'fragments' }, FRAGMENTS.map((fragment) => {
          const found = p.fragments[fragment.id];
          const level = p.hints[fragment.id] ?? 0;
          return h('li', { class: `fragment${found ? ' is-found' : ''}` },
            h('span', { class: 'fragment__id' }, fragment.id),
            found
              ? h('span', { class: 'fragment__text' }, `Recovered ${when(found)}`)
              : h('span', { class: 'fragment__text' }, 'Not recovered', level > 0 ? h('span', { class: 'fragment__hints' }, fragment.hints.slice(0, level).map((hint) => h('span', {}, hint))) : null),
            !found && level < fragment.hints.length ? h('button', { class: 'link', type: 'button', onclick: () => store.dispatch({ type: 'hint/use', id: fragment.id }) }, level === 0 ? 'ask for a hint' : 'another hint') : null);
        }))),

      h('section', { class: 'journal__block', 'aria-labelledby': 'j-ach' }, h('h2', { class: 'journal__h', id: 'j-ach' }, `Achievements ${achievementCount} / ${ACHIEVEMENTS.length}`),
        h('ul', { class: 'achievements' }, ACHIEVEMENTS.map((a) => {
          const earned = p.achievements[a.id];
          return h('li', { class: earned ? 'is-earned' : '' }, h('span', { class: 'achievement__title' }, earned ? a.title : '— — —'), h('span', { class: 'achievement__text' }, earned ? `${a.description} ${when(earned)}` : 'Not yet.'));
        }))),

      h('section', { class: 'journal__block journal__reset', 'aria-labelledby': 'j-reset' }, h('h2', { class: 'journal__h', id: 'j-reset' }, 'Forget everything'),
        h('p', { class: 'journal__note' }, 'Clears every discovery, fragment and achievement stored in this browser. You will keep your identifier and your sound setting.'),
        confirming
          ? h('div', { class: 'journal__confirm', role: 'alert' }, h('span', {}, 'This cannot be undone.'), h('button', { class: 'btn btn--danger', type: 'button', onclick: () => { store.reset(); confirming = false; ctx.toast({ label: 'ARCHIVE', title: 'Progress cleared', detail: 'The archive has forgotten you. Almost.' }); } }, 'Yes, forget'), h('button', { class: 'btn', type: 'button', onclick: () => { confirming = false; render(); } }, 'Keep it'))
          : h('button', { class: 'btn', type: 'button', onclick: () => { confirming = true; render(); root.querySelector('.journal__confirm .btn')?.focus(); } }, 'Reset my progress')),
    );
  }

  const unsubscribe = store.subscribe(() => render());
  render();
  root.querySelector('.journal__title')?.focus({ preventScroll: true });

  return { destroy: unsubscribe };
}
