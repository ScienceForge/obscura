import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { TRANSMISSIONS, atbash, caesar, decode, isSolved, signalStrength, vigenere } from '../src/core/cipher.js';
import { MOVES, SPECIALS, SPECIAL_IDS, describePosition, specialAt, step } from '../src/core/hallway.js';
import { DWELL_SPOT, LIGHT_MESSAGES, createLightModel } from '../src/core/lights.js';
import {
  FORGOTTEN,
  TARGET,
  WORLD,
  coordsToWorld,
  forgottenPosition,
  formatCoords,
  generateStars,
  isTarget,
  nearestStar,
  parseCoordinates,
  worldToCoords,
} from '../src/core/starmap.js';

describe('Room 001: the light model', () => {
  const size = { width: 1000, height: 800 };
  const at = (x, y, speed = 0, radius = 160) => ({ x: x * size.width, y: y * size.height, radius, speed });

  it('reveals a message only after the light has rested on it', () => {
    const model = createLightModel();
    const m = LIGHT_MESSAGES[0];
    assert.deepEqual(model.step(at(m.x, m.y), size, 0.5).found, []);
    assert.ok(model.progress(m.id) > 0 && model.progress(m.id) < 1);
    assert.deepEqual(model.step(at(m.x, m.y), size, 0.7).found, [m.id]);
    assert.equal(model.isFound(m.id), true);
  });

  it('does not count a light that is too far away, and decays brushed exposure', () => {
    const model = createLightModel();
    const m = LIGHT_MESSAGES[0];
    model.step(at(m.x, m.y), size, 0.8);
    const peak = model.progress(m.id);
    model.step(at(0.95, 0.95), size, 1);
    assert.ok(model.progress(m.id) < peak);
    assert.equal(model.isFound(m.id), false);
  });

  it('finds the hidden message only when the light is still on the dwell spot', () => {
    const moving = createLightModel();
    for (let i = 0; i < 100; i += 1) moving.step(at(DWELL_SPOT.x, DWELL_SPOT.y, 300), size, 0.1);
    assert.equal(moving.dwellFound, false, 'moving light never settles');

    const still = createLightModel();
    let reported = false;
    for (let i = 0; i < 60; i += 1) reported ||= still.step(at(DWELL_SPOT.x, DWELL_SPOT.y, 0), size, 0.1).dwell;
    assert.equal(reported, true);
    assert.equal(still.dwellFound, true);
  });

  it('completes when every message is found, and can reveal all for accessibility', () => {
    const model = createLightModel();
    for (const m of LIGHT_MESSAGES) model.step(at(m.x, m.y), size, 2);
    assert.equal(model.allFound, true);

    const assisted = createLightModel();
    assisted.revealAll();
    assert.equal(assisted.allFound, true);
    assert.equal(assisted.dwellFound, true);
  });

  it('keeps every message inside the room and apart from the others', () => {
    for (const m of [...LIGHT_MESSAGES, DWELL_SPOT]) assert.ok(m.x > 0.05 && m.x < 0.95 && m.y > 0.05 && m.y < 0.95);
    for (const a of LIGHT_MESSAGES) {
      for (const b of LIGHT_MESSAGES) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 0.2, `${a.id}/${b.id}`);
    }
  });
});

describe('Room 002: ciphers', () => {
  it('caesar and atbash are reversible and leave punctuation alone', () => {
    assert.equal(caesar(caesar('HELLO, WORLD.', 9), -9), 'HELLO, WORLD.');
    assert.equal(atbash(atbash('STILL HERE.')), 'STILL HERE.');
    assert.equal(caesar('abc', 1), 'BCD');
    assert.equal(atbash('AZ'), 'ZA');
  });

  it('vigenere round-trips and only advances the key on letters', () => {
    const text = 'MEET ME, AT NOON.';
    assert.equal(vigenere(vigenere(text, 'LIGHT'), 'LIGHT', { decrypt: true }), text);
    assert.equal(vigenere('A A', 'BC'), 'B C');
    assert.equal(vigenere('HELLO', ''), 'HELLO');
  });

  it('can solve every transmission with its intended answer', () => {
    const [t1, t2, t3] = TRANSMISSIONS;
    assert.equal(isSolved(t1, { shift: t1.shift }), true);
    assert.equal(isSolved(t2, { shift: t2.shift, mirror: true }), true);
    assert.equal(isSolved(t3, { key: 'LIGHT' }), true);
    assert.equal(isSolved(t3, { key: 'light' }), true, 'key is case-insensitive');
  });

  it('is not solved by nearby wrong answers', () => {
    const [t1, t2, t3] = TRANSMISSIONS;
    for (const shift of Array.from({ length: 26 }, (_, i) => i).filter((s) => s !== t1.shift)) assert.equal(isSolved(t1, { shift }), false);
    assert.equal(isSolved(t2, { shift: t2.shift, mirror: false }), false);
    assert.equal(isSolved(t2, { shift: t2.shift + 1, mirror: true }), false);
    assert.equal(isSolved(t3, { key: 'LIGHS' }), false);
    assert.equal(isSolved(t3, {}), false);
  });

  it('shows unreadable ciphertext at the wrong setting', () => {
    const [t1] = TRANSMISSIONS;
    assert.notEqual(decode(t1, { shift: 0 }), t1.plain);
    assert.equal(decode(t1, { shift: t1.shift }), t1.plain);
  });

  it('signal strength peaks only at the solution and falls off smoothly', () => {
    const [t1, t2, t3] = TRANSMISSIONS;
    assert.equal(signalStrength(t1, { shift: t1.shift }), 1);
    const strengths = [0, 1, 2, 3].map((d) => signalStrength(t1, { shift: t1.shift + d }));
    assert.deepEqual([...strengths].sort((a, b) => b - a), strengths, 'monotonic with distance');
    assert.ok(strengths[1] < 1);
    assert.ok(signalStrength(t2, { shift: t2.shift, mirror: false }) < signalStrength(t2, { shift: t2.shift, mirror: true }));
    assert.equal(signalStrength(t3, { key: 'LIGHT' }), 1);
    assert.ok(signalStrength(t3, { key: 'LIGHZ' }) > signalStrength(t3, { key: 'LIGZZ' }));
    assert.equal(signalStrength(t3, {}), 0);
  });

  it('carries the fragment on the final transmission only', () => {
    assert.deepEqual(TRANSMISSIONS.map((t) => t.fragment ?? null), [null, null, 'F2']);
    for (const t of TRANSMISSIONS) assert.equal(t.hints.length, 3);
  });
});

describe('Room 003: the hallway', () => {
  const walk = (moves) => [...moves].reduce((path, move) => step(path, move), '');

  it('is deterministic: the same position always looks the same', () => {
    assert.deepEqual(describePosition('LFR'), describePosition('LFR'));
    assert.notEqual(describePosition('LFR').seed, describePosition('LFL').seed);
  });

  it('finds the three specials at their positions', () => {
    assert.equal(specialAt('FFFFFFF'), SPECIALS.threshold);
    assert.equal(specialAt('LLRR'), SPECIALS.numbered);
    assert.equal(specialAt('FLLRR'), SPECIALS.numbered);
    assert.equal(specialAt('RRR'), SPECIALS.loop);
    assert.equal(specialAt('FFFFFF'), null);
    assert.equal(specialAt('FFFFFFFF'), null, 'eight straight is past the threshold');
    assert.equal(specialAt(''), null);
    assert.equal(SPECIAL_IDS.length, 3);
  });

  it('can be walked to every special', () => {
    assert.equal(specialAt(walk('FFFFFFF'))?.id, 'threshold');
    assert.equal(specialAt(walk('LLRR'))?.id, 'numbered');
    assert.equal(specialAt(walk('RRR'))?.id, 'loop');
  });

  it('sends you back to the start after the loop, and always lets you step back', () => {
    assert.equal(step('RRR', 'F'), 'F');
    assert.equal(step('LF', 'B'), 'L');
    assert.equal(step('', 'B'), '', 'cannot go back past the start');
    assert.equal(step('LF', 'X'), 'LF', 'unknown moves are ignored');
  });

  it('gives every position three doors, a whisper and a valid palette', () => {
    const seen = new Set();
    for (const path of ['', 'L', 'F', 'R', 'LL', 'FFF', 'LRLRLR', 'FRFLF', 'RRR']) {
      const node = describePosition(path);
      assert.deepEqual(node.doors.map((d) => d.move), MOVES);
      assert.ok(node.whisper.length > 0);
      assert.equal(node.palette.wall.length, 3);
      assert.ok(node.steps >= 11 && node.width > 0.5 && node.width < 0.9);
      seen.add(node.seed);
    }
    assert.equal(seen.size, 9, 'every position gets its own seed');
  });

  it('whispers directions at the right places', () => {
    assert.match(describePosition('FFF').whisper, /straight|going/i);
    assert.match(describePosition('LLR').whisper, /thirteen/i);
    assert.equal(describePosition('FFFFFFF').whisper, SPECIALS.threshold.text);
  });
});

describe('Room 004: the star map', () => {
  it('generates the same sky every time, with unique ids and all stars inside the world', () => {
    const a = generateStars();
    const b = generateStars();
    assert.deepEqual(a, b);
    assert.equal(new Set(a.map((s) => s.id)).size, a.length);
    for (const s of a) assert.ok(Math.abs(s.x) <= WORLD && Math.abs(s.y) <= WORLD && s.mag > 0 && s.mag <= 1);
    assert.equal(a.filter((s) => s.name).length, 12);
  });

  it('places each forgotten star beside its named neighbour', () => {
    const stars = generateStars();
    for (const faint of FORGOTTEN) {
      const p = forgottenPosition(faint);
      const named = stars.find((s) => s.name === faint.near);
      assert.ok(Math.hypot(named.x - p.x, named.y - p.y) < 25, faint.id);
    }
  });

  it('converts between coordinates and the world, and the target is inside it', () => {
    const w = coordsToWorld(TARGET);
    assert.ok(Math.abs(w.x) <= WORLD && Math.abs(w.y) <= WORLD);
    assert.deepEqual(worldToCoords(w.x, w.y), TARGET);
    assert.equal(formatCoords(TARGET), '04h 17m −39°');
    for (const c of [{ h: 0, m: 0, dec: 0 }, { h: 23, m: 59, dec: 90 }, { h: 12, m: 30, dec: -90 }]) {
      assert.deepEqual(worldToCoords(coordsToWorld(c).x, coordsToWorld(c).y), c);
    }
  });

  it('reads coordinates typed in many styles', () => {
    for (const text of ['04h 17m -39', '4h 17m -39', '04:17 -39', '4 17 -39', '04h17m−39°', '04h 17m 39S', '04h 17m −39°', ' 4h17m -39 ']) {
      assert.deepEqual(parseCoordinates(text), TARGET, text);
      assert.equal(isTarget(parseCoordinates(text)), true, text);
    }
  });

  it('rejects nonsense and out-of-range coordinates, and wrong answers do not match', () => {
    for (const text of ['', 'hello', '25h 00m 10', '04h 61m 10', '04h 17m 99', '04h 17m', '<script>', null, undefined]) {
      assert.equal(parseCoordinates(text), null, String(text));
    }
    assert.equal(isTarget(parseCoordinates('04h 17m 39')), false, 'sign matters');
    assert.equal(isTarget(parseCoordinates('04h 18m -39')), false);
    assert.equal(isTarget(null), false);
  });

  it('finds the nearest star within a radius, honouring a filter', () => {
    const stars = [{ id: 'a', x: 0, y: 0, mag: 1 }, { id: 'b', x: 10, y: 0, mag: 1 }];
    assert.equal(nearestStar(stars, 6, 0, 20).id, 'b');
    assert.equal(nearestStar(stars, 6, 0, 2), null);
    assert.equal(nearestStar(stars, 6, 0, 20, (s) => s.id === 'a').id, 'a');
  });
});
