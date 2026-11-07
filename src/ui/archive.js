import { entryStatus, missingRequirements, visibleEntries } from '../core/access.js';
import { ENTRY_INDEX, FRAGMENTS, FRAGMENT_INDEX, SECRET_SEQUENCES } from '../core/catalog.js';
import { parseCommand } from '../core/commands.js';
import { createSequenceDetector } from '../core/sequence.js';
import { h } from '../engine/dom.js';
import { reducedMotion } from '../engine/motion.js';
import { drawPlate } from './plates.js';

const STATUS_LABEL = { complete: 'COMPLETE', explored: 'EXPLORED', open: 'UNEXPLORED', sealed: 'SEALED' };
const redact = (text) => '█'.repeat(Math.max(4, text.length));

export function mountArchive(container, ctx) {
  const { store } = ctx;
  let selectedId = null;
  let destroyed = false;

  /* ------------------------------------------------------------ skeleton */
  const title = h('h1', { class: 'archive__title', tabindex: '-1' }, 'The Archive');
  const list = h('ul', { class: 'index', role: 'list' });
  const plate = h('canvas', { class: 'specimen__plate', width: 320, height: 200, 'aria-hidden': 'true' });
  const sClass = h('p', { class: 'specimen__class' });
  const sTitle = h('h2', { class: 'specimen__title' });
  const sText = h('p', { class: 'specimen__text' });
  const sAction = h('a', { class: 'specimen__action', href: '#/archive' });
  const specimen = h('aside', { class: 'specimen', 'aria-label': 'Selected entry' }, plate, sClass, sTitle, sText, sAction);

  const output = h('div', { class: 'console__out', role: 'log', 'aria-live': 'polite' });
  const input = h('input', { class: 'console__input', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', maxLength: 64, 'aria-label': 'Archive prompt. Type help for commands.', placeholder: 'type help' });
  const prompt = h('form', { class: 'console__form', onsubmit: onSubmit }, h('span', { class: 'console__caret', 'aria-hidden': 'true' }, '>'), input);
  const consoleEl = h('section', { class: 'console', 'aria-label': 'Archive prompt' }, output, prompt);

  const footer = h(
    'footer',
    { class: 'archive__foot' },
    h('a', { class: 'link', href: '#/submit' }, 'transmit a discovery'),
    h('a', { class: 'link', href: '#/journal' }, 'discovery log'),
    h('button', { class: 'link', type: 'button', onclick: () => ctx.replayIntro() }, 'replay entrance'),
  );

  const root = h(
    'section',
    { class: 'archive' },
    h('header', { class: 'archive__head' }, h('p', { class: 'eyebrow' }, 'OBS//ARCHIVE — INDEX'), title, h('p', { class: 'archive__lede' }, 'Entries are filed by identifier. Some were filed by something else.')),
    h('div', { class: 'archive__body' }, list, specimen),
    consoleEl,
    footer,
  );
  container.append(root);

  /* ---------------------------------------------------------------- list */
  function statusOf(progress, entry) {
    const status = entryStatus(progress, entry);
    if (status === 'open' && progress.discovered[entry.id]) return 'explored';
    return status;
  }

  function renderList() {
    const progress = store.get();
    const focusedId = document.activeElement?.closest?.('[data-entry]')?.dataset.entry;
    const rows = visibleEntries(progress).map(({ entry, status: base }) => {
      const status = statusOf(progress, entry);
      const sealed = base === 'sealed';
      const shown = sealed ? redact(entry.title) : entry.title;
      const classification = sealed ? '░░░░░░░░' : entry.classification;
      const row = h(
        sealed ? 'button' : 'a',
        {
          class: `index__row is-${status}`,
          href: sealed ? undefined : `#/${entry.route}`,
          type: sealed ? 'button' : undefined,
          dataset: { entry: entry.id },
          'aria-label': sealed ? `${entry.id}, sealed` : `${entry.id}, ${entry.title}, ${STATUS_LABEL[status].toLowerCase()}`,
          onmouseenter: () => select(entry.id),
          onfocus: () => select(entry.id),
          onclick: sealed ? () => { select(entry.id); sayEntryLocked(entry); } : undefined,
        },
        h('span', { class: 'index__id' }, entry.id),
        h('span', { class: 'index__title' }, shown),
        h('span', { class: 'index__class' }, classification),
        h('span', { class: 'index__status' }, STATUS_LABEL[status]),
      );
      return h('li', { class: 'index__item' }, row);
    });
    list.replaceChildren(...rows);
    if (focusedId) list.querySelector(`[data-entry="${focusedId}"]`)?.focus({ preventScroll: true });
    if (!selectedId || !visibleEntries(progress).some(({ entry }) => entry.id === selectedId)) {
      selectedId = visibleEntries(progress)[0]?.entry.id ?? null;
    }
    select(selectedId, { quiet: true });
  }

  function select(id, { quiet = false } = {}) {
    if (!id) return;
    const entry = ENTRY_INDEX.get(id);
    const progress = store.get();
    const status = entryStatus(progress, entry);
    const sealed = status === 'sealed';
    if (!quiet && selectedId === id && sTitle.textContent) return;
    selectedId = id;
    drawPlate(plate, id, { sealed });
    sClass.textContent = sealed ? 'CLASSIFICATION WITHHELD' : `CLASS // ${entry.classification}`;
    sTitle.textContent = sealed ? redact(entry.title) : entry.title;
    sText.textContent = sealed ? entry.sealedHint : entry.description;
    sAction.hidden = sealed;
    sAction.href = `#/${entry.route}`;
    sAction.textContent = status === 'complete' ? 'Return to this entry' : 'Open this entry';
    list.querySelectorAll('.index__row').forEach((row) => row.classList.toggle('is-selected', row.dataset.entry === id));
    if (!reducedMotion()) {
      specimen.classList.remove('is-swapping');
      void specimen.offsetWidth;
      specimen.classList.add('is-swapping');
    }
  }

  /* ------------------------------------------------------------- console */
  function say(text, kind = 'out') {
    output.append(h('p', { class: `console__line is-${kind}` }, text));
    while (output.children.length > 9) output.firstElementChild.remove();
    output.scrollTop = output.scrollHeight;
  }

  function sayEntryLocked(entry) {
    const missing = missingRequirements(store.get(), entry);
    say(`${entry.id} is sealed. ${entry.sealedHint} (Needs: ${missing.join(', ')}.)`, 'warn');
  }

  function open(id) {
    const entry = ENTRY_INDEX.get(id);
    if (!entry) {
      if (id === 'OBS-0404') {
        say('OBS-0404 — NOT FOUND. This has been noted.', 'warn');
        ctx.store.dispatch({ type: 'achievement/award', id: 'dead_link' });
      } else {
        say(`${id} — no such entry.`, 'warn');
      }
      return;
    }
    if (entryStatus(store.get(), entry) === 'sealed') return sayEntryLocked(entry);
    say(`Opening ${entry.id}…`);
    ctx.navigate(entry.route);
  }

  function dim() {
    if (reducedMotion()) return;
    root.classList.add('is-dimming');
    window.setTimeout(() => root.classList.remove('is-dimming'), 1800);
  }

  function triggerSecret(key) {
    const secret = SECRET_SEQUENCES[key];
    if (!secret) return;
    dim();
    if (store.get().fragments[secret.fragment]) {
      say('The archive dims, and brightens again. Nothing new, this time.');
      return;
    }
    say('The archive dims. Something in the index shifts.');
    ctx.store.dispatch({ type: 'fragment/find', id: secret.fragment });
    ctx.store.dispatch({ type: 'achievement/award', id: secret.achievement });
    ctx.audio.burst(0.6, { freq: 300, gain: 0.12, type: 'lowpass' });
  }

  function giveHint() {
    const progress = store.get();
    const next = FRAGMENTS.find((fragment) => !progress.fragments[fragment.id]);
    if (!next) return say('There is nothing left to hint at. That you know of.');
    ctx.store.dispatch({ type: 'hint/use', id: next.id });
    const level = store.get().hints[next.id];
    const total = FRAGMENT_INDEX.get(next.id).hints.length;
    say(`Hint ${level} of ${total}, for a fragment you have not recovered: ${next.hints[level - 1]}`, 'hint');
  }

  function onSubmit(event) {
    event.preventDefault();
    const text = input.value;
    input.value = '';
    const action = parseCommand(text);
    if (action.type === 'empty') return;
    say(`> ${text.trim()}`, 'echo');

    switch (action.type) {
      case 'help':
        say('Commands: ls · open <id> · journal · submit · hint · whoami · sound on|off · intro · clear');
        say('You can also type an identifier directly, such as OBS-0001. Not every identifier is listed.');
        break;
      case 'list':
        for (const { entry } of visibleEntries(store.get())) say(`${entry.id}  ${entryStatus(store.get(), entry) === 'sealed' ? redact(entry.title) : entry.title}`);
        break;
      case 'clear':
        output.replaceChildren();
        break;
      case 'navigate':
        ctx.navigate(action.route);
        break;
      case 'sound':
        ctx.setSound(action.on);
        say(action.on ? 'Sound on.' : 'Sound off.');
        break;
      case 'intro':
        ctx.replayIntro();
        break;
      case 'hint':
        giveHint();
        break;
      case 'whoami':
        say(`You are ${store.get().visitorId}. The archive has noted this.`);
        break;
      case 'secret':
        triggerSecret(action.word);
        break;
      case 'identifier':
        open(action.id);
        break;
      default:
        say(`No entry matches "${action.text}". Try help.`, 'warn');
    }
  }

  /* ----------------------------------------------------------- keyboard */
  const detector = createSequenceDetector(Object.keys(SECRET_SEQUENCES));
  const typing = (target) => target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable);

  function onKey(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (typing(event.target)) return;

    if (event.key === '/') {
      event.preventDefault();
      input.focus();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const rows = [...list.querySelectorAll('.index__row')];
      if (rows.length === 0) return;
      event.preventDefault();
      const current = rows.indexOf(document.activeElement);
      const next = event.key === 'ArrowDown' ? (current + 1) % rows.length : (current - 1 + rows.length) % rows.length;
      rows[current === -1 ? 0 : next].focus();
      return;
    }
    const match = detector.push(event.key);
    if (match) triggerSecret(match);
  }
  window.addEventListener('keydown', onKey);

  /* Rows lean slightly toward the pointer. */
  let frame = 0;
  function onPointerMove(event) {
    if (reducedMotion() || event.pointerType !== 'mouse' || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      for (const row of list.querySelectorAll('.index__row')) {
        const rect = row.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - event.clientY);
        row.style.setProperty('--lean', `${Math.max(0, 1 - distance / 130) * 14}px`);
      }
    });
  }
  const onPointerLeave = () => list.querySelectorAll('.index__row').forEach((row) => row.style.removeProperty('--lean'));
  list.addEventListener('pointermove', onPointerMove);
  list.addEventListener('pointerleave', onPointerLeave);

  const unsubscribe = store.subscribe(() => {
    if (!destroyed) renderList();
  });

  renderList();
  say('Type help for commands, or choose an entry above.', 'dim');

  // If nobody touches anything for a while, the archive notices.
  const idleLines = ['Still there?', 'The archive is listening.', 'Nothing has moved. Something has noticed.'];
  let idleCount = 0;
  let idleTimer = 0;
  const armIdle = () => {
    window.clearTimeout(idleTimer);
    if (idleCount >= idleLines.length) return;
    idleTimer = window.setTimeout(() => {
      say(idleLines[idleCount], 'dim');
      idleCount += 1;
      armIdle();
    }, 45000);
  };
  const touch = () => armIdle();
  window.addEventListener('pointermove', touch, { passive: true });
  window.addEventListener('keydown', touch);
  armIdle();
  title.focus({ preventScroll: true });

  return {
    destroy() {
      destroyed = true;
      unsubscribe();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointermove', touch);
      window.removeEventListener('keydown', touch);
      window.clearTimeout(idleTimer);
      cancelAnimationFrame(frame);
    },
  };
}
