import { GITHUB_REPO } from '../config.js';
import {
  CATEGORIES,
  LIMITS,
  buildIssueUrl,
  checkRateLimit,
  formatSubmission,
  isValidCommunityEntry,
  recordSubmission,
  validateSubmission,
} from '../core/submission.js';
import { h, uid } from '../engine/dom.js';

const RATE_KEY = 'obscura:submissions:v1';

function readStamps() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RATE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}
function writeStamps(stamps) {
  try {
    localStorage.setItem(RATE_KEY, JSON.stringify(stamps));
  } catch {
  }
}

const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export function mountSubmit(container, ctx) {
  let startedAt = Date.now();
  let prepared = null;

  const root = h('section', { class: 'submit' });
  container.append(root);

  const fields = {};
  function field(name, label, control, { hint = '', required = false } = {}) {
    const id = uid(`f-${name}`);
    const errorId = `${id}-error`;
    control.id = id;
    control.setAttribute('aria-describedby', `${hint ? `${id}-hint ` : ''}${errorId}`);
    const error = h('p', { class: 'form__error', id: errorId });
    const wrap = h('div', { class: 'form__field' }, h('label', { class: 'form__label', for: id }, label, required ? h('span', { class: 'form__req' }, ' required') : h('span', { class: 'form__opt' }, ' optional')), hint ? h('p', { class: 'form__hint', id: `${id}-hint` }, hint) : null, control, error);
    fields[name] = { control, error, wrap };
    return wrap;
  }

  const title = field('title', 'Title', h('input', { class: 'form__input', name: 'title', type: 'text', maxLength: LIMITS.title.max, autocomplete: 'off' }), { required: true });
  const category = field('category', 'Category', h('select', { class: 'form__input', name: 'category' }, h('option', { value: '' }, 'Choose one…'), CATEGORIES.map((c) => h('option', { value: c }, c))), { required: true });
  const url = field('url', 'Link to the experience', h('input', { class: 'form__input', name: 'url', type: 'url', inputmode: 'url', autocomplete: 'off', placeholder: 'https://', maxLength: LIMITS.url.max }), { required: true, hint: 'A public https:// address. A reviewer will open it, so make sure it loads without an account.' });
  const description = field('description', 'Description', h('textarea', { class: 'form__input', name: 'description', rows: 6, maxLength: LIMITS.description.max }), { required: true, hint: `What is it, and what happens when someone arrives? ${LIMITS.description.min}–${LIMITS.description.max} characters.` });
  const creator = field('creator', 'Creator name', h('input', { class: 'form__input', name: 'creator', type: 'text', maxLength: LIMITS.creator.max, autocomplete: 'off' }), { hint: 'Shown beside the entry if it is approved. Leave empty to stay anonymous.' });
  const contact = field('contact', 'Contact or profile link', h('input', { class: 'form__input', name: 'contact', type: 'text', maxLength: LIMITS.contact.max, autocomplete: 'off' }), { hint: 'Only for the reviewer, in case they have a question. Not displayed publicly.' });

  const permissionBox = h('input', { type: 'checkbox', name: 'permission' });
  const permissionId = uid('permission');
  permissionBox.id = permissionId;
  permissionBox.setAttribute('aria-describedby', `${permissionId}-error`);
  const permissionError = h('p', { class: 'form__error', id: `${permissionId}-error` });
  fields.permission = { control: permissionBox, error: permissionError };
  const permission = h('div', { class: 'form__field form__check' }, h('div', {}, permissionBox, h('label', { for: permissionId }, 'I made this, or I have permission to share it, and I am happy for it to appear in the archive if it is approved.')), permissionError);

  const trap = h('div', { class: 'form__trap', 'aria-hidden': 'true' }, h('label', {}, 'Leave this empty', h('input', { name: 'website', type: 'text', tabindex: '-1', autocomplete: 'off' })));

  const summary = h('p', { class: 'form__summary', role: 'alert', hidden: true });
  const form = h('form', { class: 'form', novalidate: true, onsubmit: onSubmit }, title, category, url, description, creator, contact, permission, trap, summary, h('button', { class: 'btn', type: 'submit' }, 'Prepare transmission'));

  function showErrors(errors) {
    let first = null;
    for (const [name, f] of Object.entries(fields)) {
      const message = errors[name] ?? '';
      f.error.textContent = message;
      f.control.setAttribute('aria-invalid', message ? 'true' : 'false');
      if (message && !first) first = f.control;
    }
    return first;
  }

  function onSubmit(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const result = validateSubmission(data, { elapsedMs: Date.now() - startedAt });

    if (!result.ok && result.spam) {
      summary.hidden = false;
      summary.textContent = 'This transmission could not be accepted. Please take a moment and try again.';
      startedAt = Date.now() - 1500;
      return;
    }
    if (!result.ok) {
      const first = showErrors(result.errors);
      summary.hidden = false;
      summary.textContent = `${Object.keys(result.errors).length} ${Object.keys(result.errors).length === 1 ? 'thing needs' : 'things need'} attention.`;
      first?.focus();
      return;
    }

    const limit = checkRateLimit(readStamps());
    if (!limit.allowed) {
      summary.hidden = false;
      summary.textContent = `You have prepared several transmissions today. You can prepare another after ${dateFormat.format(new Date(limit.retryAt))}.`;
      return;
    }

    showErrors({});
    summary.hidden = true;
    prepared = result.value;
    renderReview();
  }

  function renderReview() {
    const link = buildIssueUrl(prepared, GITHUB_REPO);
    const status = h('p', { class: 'review__status', role: 'status', 'aria-live': 'polite' });

    const open = link
      ? h('a', { class: 'btn btn--primary', href: link, target: '_blank', rel: 'noopener noreferrer', onclick: () => {
          writeStamps(recordSubmission(readStamps()));
          ctx.store.dispatch({ type: 'achievement/award', id: 'transmitter' });
          status.textContent = 'GitHub has opened in a new tab. Press “Submit new issue” there to send it. Until you do, nothing has been sent.';
        } }, 'Open on GitHub')
      : null;

    const copy = h('button', { class: 'btn', type: 'button', onclick: async () => {
      try {
        await navigator.clipboard.writeText(formatSubmission(prepared));
        status.textContent = 'Copied. You can paste it into an email or an issue yourself.';
      } catch {
        status.textContent = 'Copying was blocked by the browser. Select the text above and copy it by hand.';
      }
    } }, 'Copy as text');

    root.replaceChildren(
      header(),
      h('section', { class: 'review', 'aria-labelledby': 'review-title' },
        h('h2', { class: 'review__title', id: 'review-title', tabindex: '-1' }, 'Review your transmission'),
        h('div', { class: 'review__notice' },
          h('p', {}, h('strong', {}, 'Nothing has been sent yet.')),
          link
            ? h('p', {}, 'Opening GitHub shows this transmission as a draft issue on the archive’s repository. You need to press “Submit new issue” yourself, using your own GitHub account. A person reads every submission, and nothing appears in the archive until it has been approved.')
            : h('p', {}, 'This copy of the archive is not connected to a repository, so there is nowhere to send a transmission. You can copy it as text and send it to whoever runs this archive.')),
        h('dl', { class: 'review__list' },
          ...[['Title', prepared.title], ['Category', prepared.category], ['Link', prepared.url], ['Description', prepared.description], ['Creator', prepared.creator || 'Anonymous'], ['Contact', prepared.contact || 'None given']].map(([k, v]) => h('div', {}, h('dt', {}, k), h('dd', {}, v)))),
        h('div', { class: 'review__actions' }, open, copy, h('button', { class: 'btn', type: 'button', onclick: () => { prepared = null; render(); } }, 'Edit')),
        status));
    root.querySelector('.review__title').focus({ preventScroll: true });
  }

  const approved = h('section', { class: 'approved', 'aria-labelledby': 'approved-title' }, h('h2', { class: 'approved__title', id: 'approved-title' }, 'Approved transmissions'), h('p', { class: 'approved__state', role: 'status' }, 'Listening…'));

  async function loadApproved() {
    const state = approved.querySelector('.approved__state');
    try {
      const response = await fetch('./community.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error(String(response.status));
      const { entries } = await response.json();
      const valid = (Array.isArray(entries) ? entries : []).filter(isValidCommunityEntry);
      if (valid.length === 0) {
        state.textContent = 'Nothing has been approved yet. Every transmission is read by a person before it appears here.';
        return;
      }
      state.remove();
      approved.append(h('ul', { class: 'approved__list' }, valid.map((e) => h('li', {}, h('a', { class: 'approved__link', href: e.url, target: '_blank', rel: 'noopener noreferrer nofollow ugc' }, e.title, h('span', { class: 'visually-hidden' }, ' (opens an external site in a new tab)')), h('span', { class: 'approved__meta' }, `${e.category}${e.creator ? ` · by ${e.creator}` : ''} · leaves the archive`), h('p', {}, e.description)))));
    } catch {
      state.textContent = 'The list could not be loaded just now. It will try again next time you visit.';
    }
  }

  function header() {
    return h('header', { class: 'submit__head' }, h('p', { class: 'eyebrow' }, 'OBS//ARCHIVE — TRANSMIT'), h('h1', { class: 'submit__title', tabindex: '-1' }, 'Transmit a discovery'), h('p', { class: 'submit__lede' }, 'Made something strange, quiet or beautiful that belongs here? Tell the archive about it. Every transmission is read by a person. Nothing is published automatically, and nothing is sent until you choose to send it.'));
  }

  function render() {
    root.replaceChildren(header(), form, approved);
    startedAt = Date.now();
    root.querySelector('.submit__title').focus({ preventScroll: true });
  }

  render();
  loadApproved();

  return { destroy() {} };
}
