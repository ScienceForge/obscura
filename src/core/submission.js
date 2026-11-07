/**
 * Community submissions. The site is static, so there is no server to receive
 * a submission. Instead a validated submission becomes a *prefilled GitHub
 * issue* that the visitor must submit themselves; a person reviews it, and
 * only approved entries are ever added to public/community.json.
 *
 * Nothing in this module sends data anywhere. It validates, cleans and
 * formats.
 */

export const CATEGORIES = ['Interactive visual', 'Audio', 'Puzzle or game', 'Narrative', 'Tool or utility', 'Other'];

export const LIMITS = {
  title: { min: 3, max: 80 },
  description: { min: 20, max: 600 },
  url: { max: 300 },
  creator: { max: 60 },
  contact: { max: 120 },
};

export const SPAM = {
  minFillMs: 3000,
  maxPerWindow: 3,
  windowMs: 24 * 60 * 60 * 1000,
};

/* eslint-disable no-control-regex */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
/** Zero-width characters and bidirectional overrides, used to disguise text. */
const INVISIBLE = /[​-‏‪-‮⁠-⁯﻿]/g;

/** Clean untrusted text. Single-line values lose their line breaks. */
export function sanitizeText(value, { multiline = false } = {}) {
  let text = String(value ?? '').normalize('NFC').replace(/\r\n?/g, '\n').replace(CONTROL, '').replace(INVISIBLE, '');
  text = multiline ? text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n') : text.replace(/\s+/g, ' ');
  return text.trim();
}

const PRIVATE_HOST = /^(?:localhost|.*\.(?:local|localhost|internal|lan|home|test|invalid))$/i;

/**
 * Accept only public https links. No credentials, no raw IP addresses, no
 * local or internal hosts, and no other schemes (javascript:, data:, file:…).
 * @returns {{ ok: true, url: string } | { ok: false, error: string }}
 */
export function validateUrl(text, { max = LIMITS.url.max } = {}) {
  const raw = String(text ?? '').trim();
  if (!raw) return { ok: false, error: 'Enter the link to your experience.' };
  if (raw.length > max) return { ok: false, error: `Keep the link under ${max} characters.` };

  let url;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: 'That does not look like a web address. Try https://example.com/page.' };
  }
  if (url.protocol !== 'https:') return { ok: false, error: 'Use a secure link that starts with https://.' };
  if (url.username || url.password) return { ok: false, error: 'The link should not contain a username or password.' };

  const host = url.hostname.toLowerCase();
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(':') || host.startsWith('[')) {
    return { ok: false, error: 'Use a website name, not an IP address.' };
  }
  if (PRIVATE_HOST.test(host) || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(host)) {
    return { ok: false, error: 'Use the public address of a website.' };
  }
  return { ok: true, url: url.href };
}

/**
 * Validate and clean a submission.
 *
 * @param {Record<string, string>} input raw field values, including the hidden `website` honeypot
 * @param {{ elapsedMs?: number }} [context]
 * @returns {{ ok: true, value: object } | { ok: false, spam?: boolean, errors: Record<string, string> }}
 */
export function validateSubmission(input, { elapsedMs = Infinity } = {}) {
  // Spam checks come first and are deliberately vague: a bot learns nothing.
  if (String(input.website ?? '').trim() !== '' || elapsedMs < SPAM.minFillMs) {
    return { ok: false, spam: true, errors: {} };
  }

  const errors = {};
  const title = sanitizeText(input.title);
  const description = sanitizeText(input.description, { multiline: true });
  const creator = sanitizeText(input.creator);
  const contact = sanitizeText(input.contact);

  if (title.length < LIMITS.title.min) errors.title = `Give it a title of at least ${LIMITS.title.min} characters.`;
  else if (title.length > LIMITS.title.max) errors.title = `Keep the title under ${LIMITS.title.max} characters.`;

  if (!CATEGORIES.includes(input.category)) errors.category = 'Choose a category.';

  const link = validateUrl(sanitizeText(input.url));
  if (!link.ok) errors.url = link.error;

  if (description.length < LIMITS.description.min) errors.description = `Describe it in at least ${LIMITS.description.min} characters, so a reviewer knows what they are opening.`;
  else if (description.length > LIMITS.description.max) errors.description = `Keep the description under ${LIMITS.description.max} characters.`;

  if (creator.length > LIMITS.creator.max) errors.creator = `Keep this under ${LIMITS.creator.max} characters.`;
  if (contact.length > LIMITS.contact.max) errors.contact = `Keep this under ${LIMITS.contact.max} characters.`;
  else if (/^[a-z][a-z0-9+.-]*:/i.test(contact) && !/^https:\/\//i.test(contact) && !/^mailto:/i.test(contact)) {
    errors.contact = 'Use an email address, a handle, or an https:// link.';
  }

  if (input.permission !== 'on' && input.permission !== true) errors.permission = 'Please confirm you made this or have permission to share it.';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { title, category: input.category, url: link.url, description, creator, contact } };
}

/* ------------------------------------------------------------ rate limit */

/**
 * Limit how many transmissions one browser prepares per day. This only stops
 * accidents and casual repetition; the real barrier is that GitHub requires an
 * account and a human reviews everything.
 */
export function checkRateLimit(timestamps, now = Date.now(), { max = SPAM.maxPerWindow, windowMs = SPAM.windowMs } = {}) {
  const recent = timestamps.filter((t) => Number.isFinite(t) && now - t < windowMs && t <= now);
  if (recent.length < max) return { allowed: true, remaining: max - recent.length };
  const retryAt = Math.min(...recent) + windowMs;
  return { allowed: false, remaining: 0, retryAt };
}

export function recordSubmission(timestamps, now = Date.now(), windowMs = SPAM.windowMs) {
  return [...timestamps.filter((t) => Number.isFinite(t) && now - t < windowMs), now];
}

/* ------------------------------------------------------------ GitHub issue */

export const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/** Build a prefilled "new issue" link for the repository's submission form, or null if unconfigured. */
export function buildIssueUrl(value, repo) {
  if (typeof repo !== 'string' || !REPO_PATTERN.test(repo)) return null;
  const params = new URLSearchParams({
    template: 'submission.yml',
    title: `Submission: ${value.title}`.slice(0, 120),
    url: value.url,
    category: value.category,
    description: value.description,
    creator: value.creator,
    contact: value.contact,
  });
  return `https://github.com/${repo}/issues/new?${params.toString()}`;
}

/** Plain-text version, for copying when GitHub is not an option. */
export function formatSubmission(value) {
  return [
    `Title: ${value.title}`,
    `Category: ${value.category}`,
    `Link: ${value.url}`,
    `Creator: ${value.creator || '(not given)'}`,
    `Contact: ${value.contact || '(not given)'}`,
    '',
    value.description,
  ].join('\n');
}

/* ------------------------------------------------------ approved entries */

/** Is this entry in community.json safe and well-formed enough to display? */
export function isValidCommunityEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  const { title, description, url, category, addedAt, creator } = entry;
  return (
    typeof title === 'string' && title.length >= LIMITS.title.min && title.length <= LIMITS.title.max &&
    typeof description === 'string' && description.length >= 1 && description.length <= LIMITS.description.max &&
    typeof url === 'string' && validateUrl(url).ok &&
    CATEGORIES.includes(category) &&
    typeof addedAt === 'string' && !Number.isNaN(Date.parse(addedAt)) &&
    (creator === undefined || creator === '' || (typeof creator === 'string' && creator.length <= LIMITS.creator.max))
  );
}
