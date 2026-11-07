import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  CATEGORIES,
  LIMITS,
  SPAM,
  buildIssueUrl,
  checkRateLimit,
  formatSubmission,
  isValidCommunityEntry,
  recordSubmission,
  sanitizeText,
  validateSubmission,
  validateUrl,
} from '../src/core/submission.js';

const good = () => ({
  title: 'The Slow Lantern',
  category: 'Interactive visual',
  url: 'https://example.com/lantern',
  description: 'A small experiment about light that moves slower than you do.',
  creator: 'Ada',
  contact: 'ada@example.com',
  permission: 'on',
  website: '',
});
const slow = { elapsedMs: 20_000 };

describe('sanitizeText', () => {
  it('removes control and invisible characters and normalises whitespace', () => {
    assert.equal(sanitizeText('  Hello\u0000 ​world‮ \n again  '), 'Hello world again');
    assert.equal(sanitizeText('a​b﻿c'), 'abc');
  });

  it('keeps paragraph breaks for multiline text but limits them', () => {
    assert.equal(sanitizeText('one\r\ntwo\n\n\n\nthree', { multiline: true }), 'one\ntwo\n\nthree');
  });

  it('handles non-strings and unicode safely', () => {
    assert.equal(sanitizeText(null), '');
    assert.equal(sanitizeText(42), '42');
    assert.equal(sanitizeText('Café'), 'Café');
  });
});

describe('validateUrl', () => {
  it('accepts ordinary public https links', () => {
    for (const url of ['https://example.com', 'https://sub.example.co.uk/path?x=1#y', 'https://my-site.dev/a%20b']) {
      assert.equal(validateUrl(url).ok, true, url);
    }
  });

  it('rejects other schemes, credentials, IPs and internal hosts', () => {
    const bad = [
      'http://example.com', 'javascript:alert(1)', 'data:text/html,<script>', 'file:///etc/passwd', 'ftp://example.com',
      'https://user:pass@example.com', 'https://127.0.0.1/x', 'https://[::1]/', 'https://192.168.1.1', 'https://localhost',
      'https://app.local', 'https://intranet.internal', 'https://nodots', 'https://example.c', 'not a url', '', 'https://',
    ];
    for (const url of bad) assert.equal(validateUrl(url).ok, false, url);
  });

  it('rejects over-long links and returns a normalised href', () => {
    assert.equal(validateUrl(`https://example.com/${'a'.repeat(400)}`).ok, false);
    assert.equal(validateUrl('HTTPS://EXAMPLE.com/Path').url, 'https://example.com/Path');
  });
});

describe('validateSubmission', () => {
  it('accepts a complete valid submission and returns cleaned values', () => {
    const result = validateSubmission(good(), slow);
    assert.equal(result.ok, true);
    assert.equal(result.value.url, 'https://example.com/lantern');
    assert.equal(result.value.category, 'Interactive visual');
  });

  it('allows the optional fields to be empty', () => {
    const result = validateSubmission({ ...good(), creator: '', contact: '' }, slow);
    assert.equal(result.ok, true);
    assert.equal(result.value.creator, '');
  });

  it('reports a specific message for every invalid field', () => {
    const result = validateSubmission(
      { title: 'a', category: 'Nope', url: 'http://x', description: 'short', creator: 'x'.repeat(100), contact: 'javascript:alert(1)', permission: '', website: '' },
      slow,
    );
    assert.equal(result.ok, false);
    assert.deepEqual(Object.keys(result.errors).sort(), ['category', 'contact', 'creator', 'description', 'permission', 'title', 'url']);
  });

  it('enforces length limits at their boundaries', () => {
    const at = (field, length) => validateSubmission({ ...good(), [field]: 'x'.repeat(length) }, slow);
    assert.equal(at('title', LIMITS.title.max).ok, true);
    assert.equal(at('title', LIMITS.title.max + 1).ok, false);
    assert.equal(at('description', LIMITS.description.min).ok, true);
    assert.equal(at('description', LIMITS.description.min - 1).ok, false);
    assert.equal(at('description', LIMITS.description.max + 1).ok, false);
  });

  it('treats the honeypot and instant submissions as spam, with no hints', () => {
    const trap = validateSubmission({ ...good(), website: 'http://spam.example' }, slow);
    assert.deepEqual(trap, { ok: false, spam: true, errors: {} });
    assert.equal(validateSubmission(good(), { elapsedMs: SPAM.minFillMs - 1 }).spam, true);
    assert.equal(validateSubmission(good(), { elapsedMs: SPAM.minFillMs }).ok, true);
  });

  it('strips hidden characters rather than storing them', () => {
    const result = validateSubmission({ ...good(), title: 'Re‮vil title', description: `${good().description}​\u0000` }, slow);
    assert.equal(result.ok, true);
    assert.equal(result.value.title, 'Revil title');
    assert.ok(!/[​‮\u0000]/.test(result.value.description));
  });

  it('never throws on hostile input', () => {
    for (const input of [{}, { title: {}, url: [], description: null }, Object.create(null)]) {
      assert.doesNotThrow(() => validateSubmission(input, slow));
    }
  });
});

describe('rate limit', () => {
  const now = 1_000_000_000;
  it('allows up to the maximum per window, then reports when it resets', () => {
    let stamps = [];
    for (let i = 0; i < SPAM.maxPerWindow; i += 1) {
      assert.equal(checkRateLimit(stamps, now + i).allowed, true);
      stamps = recordSubmission(stamps, now + i);
    }
    const blocked = checkRateLimit(stamps, now + 10);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.retryAt, now + SPAM.windowMs);
  });

  it('forgets old attempts and ignores corrupt entries', () => {
    const old = [now - SPAM.windowMs - 1, now - SPAM.windowMs - 5, now - SPAM.windowMs - 9];
    assert.equal(checkRateLimit(old, now).allowed, true);
    assert.equal(checkRateLimit(['x', null, NaN, now + 99999], now).allowed, true);
    assert.deepEqual(recordSubmission(old, now), [now]);
  });
});

describe('GitHub issue link', () => {
  const value = validateSubmission(good(), slow).value;

  it('builds a prefilled link for a configured repository', () => {
    const link = buildIssueUrl(value, 'owner/obscura');
    const url = new URL(link);
    assert.equal(url.origin + url.pathname, 'https://github.com/owner/obscura/issues/new');
    assert.equal(url.searchParams.get('template'), 'submission.yml');
    assert.equal(url.searchParams.get('url'), value.url);
    assert.equal(url.searchParams.get('description'), value.description);
    assert.match(url.searchParams.get('title'), /^Submission: The Slow Lantern/);
    assert.ok(link.length < 6000);
  });

  it('refuses an unconfigured or malformed repository', () => {
    for (const repo of ['', undefined, null, 'owner', 'owner/', '/repo', 'a/b/c', 'own er/repo', 'https://github.com/a/b', '../x/y']) {
      assert.equal(buildIssueUrl(value, repo), null, String(repo));
    }
  });

  it('keeps tricky characters intact through the link and stays within a safe length', () => {
    const tricky = { ...value, description: 'Line one\nLine two & more = "quotes" <b>tags</b> #123 @someone ```fence```', title: 'Title & <b>' };
    const url = new URL(buildIssueUrl(tricky, 'owner/obscura'));
    assert.equal(url.searchParams.get('description'), tricky.description);
    const long = { ...value, description: 'é'.repeat(LIMITS.description.max) };
    assert.ok(buildIssueUrl(long, 'owner/obscura').length < 8000);
  });

  it('formats a readable plain-text copy', () => {
    assert.match(formatSubmission(value), /^Title: The Slow Lantern\nCategory: Interactive visual\nLink: https:\/\/example\.com\/lantern/);
    assert.match(formatSubmission({ ...value, creator: '' }), /Creator: \(not given\)/);
  });
});

describe('approved community entries', () => {
  const entry = { id: 'x', title: 'Okay', description: 'A real thing.', url: 'https://example.com', category: CATEGORIES[0], addedAt: '2026-01-01' };

  it('validates entries and rejects malformed or unsafe ones', () => {
    assert.equal(isValidCommunityEntry(entry), true);
    for (const bad of [null, 'x', {}, { ...entry, url: 'javascript:alert(1)' }, { ...entry, url: 'http://example.com' }, { ...entry, category: 'Hacking' }, { ...entry, addedAt: 'later' }, { ...entry, title: 'ab' }, { ...entry, creator: 5 }]) {
      assert.equal(isValidCommunityEntry(bad), false, JSON.stringify(bad));
    }
  });

  it('only ships approved entries that pass validation (public/community.json)', () => {
    const file = JSON.parse(readFileSync(new URL('../public/community.json', import.meta.url), 'utf8'));
    assert.ok(Array.isArray(file.entries));
    for (const e of file.entries) assert.equal(isValidCommunityEntry(e), true, JSON.stringify(e));
  });
});
