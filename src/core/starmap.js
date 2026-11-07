import { createRng, hashString } from './prng.js';

/**
 * Room 004, Forgotten Coordinates. The sky is generated from a fixed seed, so
 * it is the same every visit. World units run from -1000 to 1000 on both
 * axes; right ascension runs west to east along x and declination along y.
 */

export const WORLD = 1000;

const NAMES = ['Vesper', 'Halcyon', 'Mirelle', 'Orrin', 'Tessaly', 'Caldris', 'Nenya', 'Auric', 'Sable', 'Lorn', 'Idris', 'Quill'];

/** Three stars too faint to see unless you look closely. Each holds a piece of a coordinate. */
export const FORGOTTEN = [
  { id: 'FS1', near: 'Vesper', anchor: { x: -412, y: 233 }, offset: { x: 14, y: -9 }, piece: '04h', clue: 'Right ascension, hours: 04h' },
  { id: 'FS2', near: 'Halcyon', anchor: { x: 508, y: -377 }, offset: { x: -11, y: 12 }, piece: '17m', clue: 'Right ascension, minutes: 17m' },
  { id: 'FS3', near: 'Mirelle', anchor: { x: -90, y: -640 }, offset: { x: 9, y: 13 }, piece: '−39°', clue: 'Declination: −39°' },
];

export const TARGET = { h: 4, m: 17, dec: -39 };

/** The faint stars only resolve at or above this zoom level. */
export const FAINT_ZOOM = 3.4;

export const forgottenPosition = (star) => ({ x: star.anchor.x + star.offset.x, y: star.anchor.y + star.offset.y });

export function coordsToWorld({ h, m, dec }) {
  return { x: -WORLD + ((h * 60 + m) / 1440) * 2 * WORLD, y: -(dec / 90) * WORLD };
}

export function worldToCoords(x, y) {
  const minutes = Math.round(((x + WORLD) / (2 * WORLD)) * 1440);
  const clamped = Math.min(1439, Math.max(0, minutes));
  return { h: Math.floor(clamped / 60), m: clamped % 60, dec: Math.round(-(y / WORLD) * 90) };
}

export const formatCoords = ({ h, m, dec }) =>
  `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${dec < 0 ? '−' : '+'}${String(Math.abs(dec)).padStart(2, '0')}°`;

/**
 * Read coordinates typed in several styles: "04h 17m -39", "4 17 -39",
 * "04:17 −39°", "4h17m 39S".
 * @returns {{ h: number, m: number, dec: number } | null}
 */
export function parseCoordinates(text) {
  const normalised = String(text ?? '').replace(/[−–—]/g, '-').slice(0, 40);
  const match = /^\s*(\d{1,2})\s*(?:h|:|\s)\s*(\d{1,2})\s*m?\s*[,;]?\s*([+-]?\s*\d{1,2})\s*°?\s*([ns])?\s*$/i.exec(normalised);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  let dec = Number(match[3].replace(/\s+/g, ''));
  if (match[4]?.toLowerCase() === 's') dec = -Math.abs(dec);
  if (h > 23 || m > 59 || dec < -90 || dec > 90) return null;
  return { h, m, dec };
}

export const isTarget = (coords) => coords !== null && coords.h === TARGET.h && coords.m === TARGET.m && coords.dec === TARGET.dec;

/**
 * Generate the sky.
 * @returns {Array<{ id: string, x: number, y: number, mag: number, name: string | null }>}
 */
export function generateStars(count = 900) {
  const rng = createRng(hashString('forgotten-coordinates'));
  const stars = [];

  for (let i = 0; i < count; i += 1) {
    stars.push({
      id: `HD-${String(1000 + Math.floor(rng() * 8999))}-${i}`,
      x: (rng() * 2 - 1) * WORLD,
      y: (rng() * 2 - 1) * WORLD,
      mag: Math.min(1, rng() ** 2.4 + 0.08),
      name: null,
    });
  }

  // Named stars are the brightest, and three are anchored beside the faint ones.
  const anchors = new Map(FORGOTTEN.map((star) => [star.near, star.anchor]));
  NAMES.forEach((name, index) => {
    const anchor = anchors.get(name);
    stars.push({
      id: `NM-${index + 1}`,
      x: anchor ? anchor.x : (rng() * 1.7 - 0.85) * WORLD,
      y: anchor ? anchor.y : (rng() * 1.7 - 0.85) * WORLD,
      mag: 1,
      name,
    });
  });
  return stars;
}

/** Nearest star to a world point within `radius` world units, or null. */
export function nearestStar(stars, x, y, radius, filter = () => true) {
  let best = null;
  let bestDistance = radius;
  for (const star of stars) {
    if (!filter(star)) continue;
    const d = Math.hypot(star.x - x, star.y - y);
    if (d <= bestDistance) {
      best = star;
      bestDistance = d;
    }
  }
  return best;
}
