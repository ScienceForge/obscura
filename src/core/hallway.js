import { createRng, hashString } from './prng.js';

export const MOVES = ['L', 'F', 'R'];

export const SPECIALS = {
  threshold: {
    id: 'threshold',
    title: 'THE THRESHOLD',
    text: 'The hallway ends. It was only ever long. Not endless. Someone numbered the doors.',
    fragment: 'F3',
    achievement: 'threshold',
  },
  numbered: {
    id: 'numbered',
    title: 'THE NUMBERED DOOR',
    text: 'A door with a number scratched into it: 13. Thirteen. Type it into the archive.',
  },
  loop: {
    id: 'loop',
    title: 'THE SAME PLACE',
    text: 'You have been here before. The hallway lets you think you chose.',
    achievement: 'wrong_turn',
  },
};

export const SPECIAL_IDS = ['threshold', 'numbered', 'loop'];

const STRAIGHT = 7;

export function specialAt(path) {
  if (path === 'F'.repeat(STRAIGHT)) return SPECIALS.threshold;
  if (path.endsWith('LLRR')) return SPECIALS.numbered;
  if (path.endsWith('RRR')) return SPECIALS.loop;
  return null;
}

export function step(path, move) {
  if (move === 'B') return path.slice(0, -1);
  if (!MOVES.includes(move)) return path;
  if (specialAt(path)?.id === 'loop') return move;
  return path + move;
}

const PALETTES = [
  { wall: [38, 44, 42], light: [150, 175, 165], name: 'lichen' },
  { wall: [34, 38, 48], light: [150, 165, 205], name: 'blue hour' },
  { wall: [46, 42, 38], light: [205, 185, 150], name: 'tungsten' },
  { wall: [44, 32, 34], light: [210, 140, 140], name: 'ember' },
  { wall: [30, 30, 32], light: [200, 200, 205], name: 'ash' },
];

const GLYPHS = ['◦', '·', '+', '×', '∴', '‖', '≈', '△', '▯', '○'];

const WHISPERS = [
  'Every door was here before you.',
  'The hallway remembers a different shape.',
  'Something here has been counted.',
  'You are further in than you were.',
  'The light is coming from the wrong direction.',
  'This corridor is slightly longer than the last.',
  'A door opened and closed behind you.',
  'It is quieter than it should be.',
  'The walls are warm.',
  'Nobody has walked straight in a long time.',
  'Some turns are only the hallway being polite.',
  'Left is not always left.',
];

const ROUTE_WHISPERS = {
  FFF: 'Straight on. Keep going.',
  FFFFF: 'The corridor does not narrow. Keep going.',
  FFFFFF: 'One more.',
  LL: 'Two lefts. And then?',
  LLR: 'Thirteen doors down, the noise stops. One more turn.',
  RR: 'A third would bring you back around.',
};

export function describePosition(path) {
  const seed = hashString(`hall:${path}`);
  const rng = createRng(seed);
  const special = specialAt(path);
  const palette = PALETTES[Math.floor(rng() * PALETTES.length)];

  return {
    path,
    depth: path.length,
    seed,
    special,
    palette,
    lamps: Math.floor(rng() * 4),
    width: 0.55 + rng() * 0.3,
    tilt: (rng() - 0.5) * 0.05,
    steps: 11 + Math.floor(rng() * 6),
    flicker: rng() < 0.28,
    doors: MOVES.map((move) => ({ move, glyph: GLYPHS[Math.floor(rng() * GLYPHS.length)], at: 2 + Math.floor(rng() * 3) })),
    whisper: special ? special.text : (ROUTE_WHISPERS[path] ?? WHISPERS[Math.floor(rng() * WHISPERS.length)]),
  };
}
