import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { canOpen, entryStatus, missingRequirements, visibleEntries } from '../src/core/access.js';
import { ACHIEVEMENTS, ENTRIES, ENTRY_INDEX, FRAGMENTS, ROOM_IDS } from '../src/core/catalog.js';
import { isKnownIdentifier, normalizeIdentifier, parseCommand } from '../src/core/commands.js';
import { createRng, hashString } from '../src/core/prng.js';
import { apply, createProgress, normalizeProgress, resetProgress } from '../src/core/progress.js';
import { matchRoute } from '../src/core/routes.js';
import { createSequenceDetector } from '../src/core/sequence.js';

const NOW = new Date('2026-01-01T00:00:00Z');
const fresh = () => createProgress({ now: NOW, visitorId: 'AB12' });
const run = (progress, ...actions) =>
  actions.reduce(
    (acc, action) => {
      const result = apply(acc.progress, action, NOW);
      return { progress: result.progress, events: [...acc.events, ...result.events] };
    },
    { progress, events: [] },
  );

describe('catalog', () => {
  it('has unique identifiers and routes', () => {
    assert.equal(new Set(ENTRIES.map((e) => e.id)).size, ENTRIES.length);
    assert.equal(new Set(ENTRIES.map((e) => e.route)).size, ENTRIES.length);
  });

  it('only requires entries that exist, and never requires itself', () => {
    for (const entry of ENTRIES) {
      for (const id of entry.requires) {
        assert.ok(ENTRY_INDEX.has(id), `${entry.id} requires unknown ${id}`);
        assert.notEqual(id, entry.id);
      }
    }
  });

  it('can always reach every room: the unlock graph has no cycles', () => {
    const done = new Set();
    let progressed = true;
    while (progressed) {
      progressed = false;
      for (const entry of ENTRIES) {
        if (!done.has(entry.id) && entry.requires.every((id) => done.has(id))) {
          done.add(entry.id);
          progressed = true;
        }
      }
    }
    assert.equal(done.size, ENTRIES.length);
  });

  it('gives every fragment two escalating hints and every sealed entry a hint', () => {
    for (const fragment of FRAGMENTS) assert.equal(fragment.hints.length, 2, fragment.id);
    for (const entry of ENTRIES.filter((e) => e.requires.length)) assert.ok(entry.sealedHint, entry.id);
  });

  it('has seven fragments, four rooms and unique achievement ids', () => {
    assert.equal(FRAGMENTS.length, 7);
    assert.equal(ROOM_IDS.length, 4);
    assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  });
});

describe('progress', () => {
  it('records a discovery once and emits one event', () => {
    const { progress, events } = run(fresh(), { type: 'entry/discover', id: 'OBS-0001' }, { type: 'entry/discover', id: 'OBS-0001' });
    assert.ok(progress.discovered['OBS-0001']);
    assert.equal(events.filter((e) => e.type === 'entry').length, 1);
    assert.equal(progress.history.length, 1);
  });

  it('ignores unknown ids', () => {
    const start = fresh();
    for (const action of [
      { type: 'entry/discover', id: 'OBS-9999' },
      { type: 'fragment/find', id: 'F99' },
      { type: 'achievement/award', id: 'nope' },
      { type: 'room/complete', id: 'nope' },
      { type: 'mystery' },
    ]) {
      assert.equal(apply(start, action, NOW).progress, start);
    }
  });

  it('never mutates its input', () => {
    const start = fresh();
    const snapshot = structuredClone(start);
    run(start, { type: 'fragment/find', id: 'F1' }, { type: 'room/complete', id: 'OBS-0001' });
    assert.deepEqual(start, snapshot);
  });

  it('awards rule-based achievements automatically, once', () => {
    const { progress, events } = run(fresh(), { type: 'room/complete', id: 'OBS-0001' });
    assert.ok(progress.achievements.first_light);
    assert.equal(events.filter((e) => e.type === 'achievement' && e.id === 'first_light').length, 1);
    const again = apply(progress, { type: 'fragment/find', id: 'F1' }, NOW);
    assert.equal(again.events.filter((e) => e.id === 'first_light').length, 0);
  });

  it('awards the pattern and whole-story achievements from fragment counts', () => {
    let state = { progress: fresh(), events: [] };
    for (const f of FRAGMENTS.slice(0, 3)) state = run(state.progress, { type: 'fragment/find', id: f.id });
    assert.ok(state.progress.achievements.fragments_3);
    assert.ok(!state.progress.achievements.fragments_7);
    for (const f of FRAGMENTS.slice(3)) state = run(state.progress, { type: 'fragment/find', id: f.id });
    assert.ok(state.progress.achievements.fragments_7);
  });

  it('awards all_rooms only when every room is complete', () => {
    let p = fresh();
    for (const id of ROOM_IDS.slice(0, 3)) p = run(p, { type: 'room/complete', id }).progress;
    assert.ok(!p.achievements.all_rooms);
    p = run(p, { type: 'room/complete', id: ROOM_IDS[3] }).progress;
    assert.ok(p.achievements.all_rooms);
  });

  it('escalates hints up to the limit and stops once a fragment is found', () => {
    let p = fresh();
    for (let i = 0; i < 5; i += 1) p = run(p, { type: 'hint/use', id: 'F3' }).progress;
    assert.equal(p.hints.F3, 2);
    p = run(p, { type: 'fragment/find', id: 'F3' }, { type: 'hint/use', id: 'F3' }).progress;
    assert.equal(p.hints.F3, 2);
  });

  it('caps history length', () => {
    let p = fresh();
    for (let i = 0; i < 260; i += 1) {
      p = { ...p, history: [...p.history, { t: NOW.toISOString(), type: 'entry', ref: 'OBS-0001' }].slice(-200) };
    }
    p = run(p, { type: 'entry/discover', id: 'OBS-0002' }).progress;
    assert.ok(p.history.length <= 200);
  });

  it('reset clears discoveries but keeps identity and sound preference', () => {
    let p = run(fresh(), { type: 'fragment/find', id: 'F1' }, { type: 'sound/set', on: true }).progress;
    p = resetProgress(p, NOW);
    assert.deepEqual(p.fragments, {});
    assert.deepEqual(p.achievements, {});
    assert.equal(p.visitorId, 'V-AB12');
    assert.equal(p.sound, true);
  });
});

describe('normalizeProgress', () => {
  it('falls back for garbage', () => {
    for (const bad of [null, undefined, 4, 'x', []]) assert.deepEqual(normalizeProgress(bad, fresh()), fresh());
  });

  it('drops unknown ids, bad dates and oversized values', () => {
    const p = normalizeProgress(
      {
        visitorId: 'V-ZZZZ',
        discovered: { 'OBS-0001': NOW.toISOString(), 'OBS-9999': NOW.toISOString(), 'OBS-0002': 'not a date' },
        fragments: { F1: NOW.toISOString(), F99: NOW.toISOString() },
        hints: { F1: 99, F2: -1, nope: 1 },
        history: [{ t: NOW.toISOString(), type: 'entry', ref: 'x'.repeat(100) }, { t: 'bad', type: 'entry', ref: 'a' }, 7],
        achievements: { arrival: NOW.toISOString(), fake: NOW.toISOString() },
      },
      fresh(),
    );
    assert.equal(p.visitorId, 'V-AB12');
    assert.deepEqual(Object.keys(p.discovered), ['OBS-0001']);
    assert.deepEqual(Object.keys(p.fragments), ['F1']);
    assert.deepEqual(p.hints, { F1: 2 });
    assert.equal(p.history.length, 1);
    assert.equal(p.history[0].ref.length, 24);
    assert.deepEqual(Object.keys(p.achievements), ['arrival']);
  });

  it('is idempotent', () => {
    const p = run(fresh(), { type: 'fragment/find', id: 'F2' }, { type: 'room/complete', id: 'OBS-0001' }).progress;
    assert.deepEqual(normalizeProgress(p, fresh()), normalizeProgress(normalizeProgress(p, fresh()), fresh()));
  });

  it('does not pollute prototypes', () => {
    const p = normalizeProgress(JSON.parse('{"discovered":{"__proto__":"2026-01-01T00:00:00Z"}}'), fresh());
    assert.equal(({}).polluted, undefined);
    assert.deepEqual(p.discovered, {});
  });
});

describe('access', () => {
  it('hides secrets until discovered, seals rooms until prerequisites are done', () => {
    const p = fresh();
    assert.equal(entryStatus(p, ENTRY_INDEX.get('OBS-0013')), 'hidden');
    assert.equal(entryStatus(p, ENTRY_INDEX.get('OBS-0001')), 'open');
    assert.equal(entryStatus(p, ENTRY_INDEX.get('OBS-0003')), 'sealed');
    assert.equal(entryStatus(p, ENTRY_INDEX.get('OBS-0004')), 'sealed');
    assert.ok(!visibleEntries(p).some(({ entry }) => entry.id === 'OBS-0013'));
  });

  it('unlocks the hallway after the first room and the map after rooms two and three', () => {
    let p = run(fresh(), { type: 'room/complete', id: 'OBS-0001' }).progress;
    assert.equal(entryStatus(p, ENTRY_INDEX.get('OBS-0003')), 'open');
    assert.equal(entryStatus(p, ENTRY_INDEX.get('OBS-0004')), 'sealed');
    p = run(p, { type: 'room/complete', id: 'OBS-0002' }, { type: 'room/complete', id: 'OBS-0003' }).progress;
    assert.equal(entryStatus(p, ENTRY_INDEX.get('OBS-0004')), 'open');
  });

  it('lets a hidden entry be opened by identifier, and then lists it', () => {
    let p = fresh();
    assert.ok(canOpen(p, 'OBS-0013'));
    p = run(p, { type: 'entry/discover', id: 'OBS-0013' }).progress;
    assert.ok(visibleEntries(p).some(({ entry }) => entry.id === 'OBS-0013'));
  });

  it('refuses sealed entries and names what is missing', () => {
    const p = fresh();
    assert.equal(canOpen(p, 'OBS-0004'), false);
    assert.deepEqual(missingRequirements(p, ENTRY_INDEX.get('OBS-0004')), ['Signal Lost', 'The Infinite Hallway']);
    assert.equal(canOpen(p, 'OBS-5555'), false);
  });
});

describe('commands', () => {
  it('reads identifiers in several spellings', () => {
    for (const text of ['OBS-0001', 'obs-0001', 'obs0001', '1', '0001', 'open 1', 'open obs-0001', ' ENTER  OBS-1 ']) {
      assert.deepEqual(parseCommand(text), { type: 'identifier', id: 'OBS-0001' }, text);
    }
    assert.equal(normalizeIdentifier('obs-13'), 'OBS-0013');
    assert.equal(normalizeIdentifier('obs-12345'), null);
    assert.ok(isKnownIdentifier('OBS-0000'));
    assert.ok(!isKnownIdentifier('OBS-0404'));
  });

  it('recognises commands and the hidden word', () => {
    assert.equal(parseCommand('help').type, 'help');
    assert.equal(parseCommand('LS').type, 'list');
    assert.deepEqual(parseCommand('journal'), { type: 'navigate', route: 'journal' });
    assert.deepEqual(parseCommand('sound off'), { type: 'sound', on: false });
    assert.deepEqual(parseCommand('lumen'), { type: 'secret', word: 'lumen' });
  });

  it('treats unknown input as a miss, not an error', () => {
    assert.equal(parseCommand('').type, 'empty');
    assert.equal(parseCommand('   ').type, 'empty');
    assert.deepEqual(parseCommand('xyzzy'), { type: 'miss', text: 'xyzzy' });
    assert.equal(parseCommand('x'.repeat(500)).text.length, 64);
    assert.equal(parseCommand(null).type, 'empty');
  });
});

describe('sequence detector', () => {
  it('matches a word typed in order and then resets', () => {
    const d = createSequenceDetector(['lumen']);
    const results = [...'lumen'].map((k) => d.push(k));
    assert.equal(results.at(-1), 'lumen');
    assert.equal(d.push('n'), null);
  });

  it('ignores case, junk before the word, and non-letter keys', () => {
    const d = createSequenceDetector(['lumen']);
    for (const k of 'xxLUM') d.push(k);
    assert.equal(d.push('E'), null);
    assert.equal(d.push('N'), 'lumen');
    for (const k of 'lum') d.push(k);
    d.push('ArrowDown');
    assert.equal(d.push('e'), null, 'a non-letter key breaks the sequence');
  });

  it('forgets partial input after a pause', () => {
    let time = 0;
    const d = createSequenceDetector(['lumen'], { maxGapMs: 1000, now: () => time });
    for (const k of 'lum') d.push(k);
    time += 5000;
    d.push('e');
    assert.equal(d.push('n'), null);
  });
});

describe('routes', () => {
  it('maps the known routes', () => {
    assert.equal(matchRoute('').view, 'home');
    assert.equal(matchRoute('#/').view, 'home');
    assert.equal(matchRoute('#/archive').view, 'archive');
    assert.equal(matchRoute('#/journal').view, 'journal');
    assert.equal(matchRoute('#/submit').view, 'submit');
    assert.deepEqual(matchRoute('#/room/001'), { view: 'room', entryId: 'OBS-0001', path: 'room/001' });
    assert.equal(matchRoute('#/room/013').entryId, 'OBS-0013');
    assert.equal(matchRoute('#/origin').view, 'origin');
  });

  it('is forgiving about case and trailing slashes, and falls back to notfound', () => {
    assert.equal(matchRoute('#/ARCHIVE/').view, 'archive');
    assert.equal(matchRoute('#/room/999').view, 'notfound');
    assert.equal(matchRoute('#/<script>').view, 'notfound');
    assert.ok(matchRoute(`#/${'a'.repeat(500)}`).path.length <= 64);
  });
});

describe('prng', () => {
  it('is deterministic and well-distributed enough', () => {
    const a = createRng(hashString('x'));
    const b = createRng(hashString('x'));
    const seq = Array.from({ length: 5 }, a);
    assert.deepEqual(seq, Array.from({ length: 5 }, b));
    assert.ok(seq.every((n) => n >= 0 && n < 1));
    assert.notEqual(hashString('a'), hashString('b'));
  });
});
