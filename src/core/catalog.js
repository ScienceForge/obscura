export const ENTRIES = [
  {
    id: 'OBS-0001',
    route: 'room/001',
    title: 'The Last Light',
    classification: 'LUMINAL',
    description: 'A room that is dark on purpose. Someone wrote here for whoever thought to bring a light.',
    kind: 'room',
    hidden: false,
    requires: [],
    sealedHint: '',
  },
  {
    id: 'OBS-0002',
    route: 'room/002',
    title: 'Signal Lost',
    classification: 'TRANSMISSION',
    description: 'A broadcast with no source and no schedule. It is still arriving, and it is not in any language you were taught.',
    kind: 'room',
    hidden: false,
    requires: [],
    sealedHint: '',
  },
  {
    id: 'OBS-0003',
    route: 'room/003',
    title: 'The Infinite Hallway',
    classification: 'SPATIAL',
    description: 'Every door leads somewhere. Not every door leads somewhere different.',
    kind: 'room',
    hidden: false,
    requires: ['OBS-0001'],
    sealedHint: 'You will need a light to find the way in.',
  },
  {
    id: 'OBS-0004',
    route: 'room/004',
    title: 'Forgotten Coordinates',
    classification: 'CARTOGRAPHIC',
    description: 'A chart of places no one went to. The coordinates are correct. That is the unsettling part.',
    kind: 'room',
    hidden: false,
    requires: ['OBS-0002', 'OBS-0003'],
    sealedHint: 'You will need a signal, and a way to follow it.',
  },
  {
    id: 'OBS-0013',
    route: 'room/013',
    title: 'The Quiet Room',
    classification: 'UNLISTED',
    description: 'There is nothing here. That is not the same as there being nobody here.',
    kind: 'secret',
    hidden: true,
    requires: [],
    sealedHint: '',
  },
  {
    id: 'OBS-0000',
    route: 'origin',
    title: 'THE_ORIGIN',
    classification: 'UNCLASSIFIED',
    description: 'The first entry. It was filed last.',
    kind: 'secret',
    hidden: true,
    requires: [],
    sealedHint: '',
  },
];

export const ENTRY_INDEX = new Map(ENTRIES.map((entry) => [entry.id, entry]));
export const ROOM_IDS = ENTRIES.filter((entry) => entry.kind === 'room').map((entry) => entry.id);

export const FRAGMENTS = [
  {
    id: 'F1',
    source: 'The Last Light',
    text: 'Station 9 was built to listen. It was never built to remember. The remembering came later, and nobody signed for it.',
    hints: ['Some of what the dark holds is not written on the walls.', 'In the first room, stop moving. Let the light rest where nothing seems to be.'],
  },
  {
    id: 'F2',
    source: 'Signal Lost',
    text: 'The first transmission arrived on a frequency the station was not tuned to. The operators logged it as interference. It was still arriving when they left.',
    hints: ['The third transmission is the one that was never meant to be read.', 'It is locked with a word. The first room says what you carry.'],
  },
  {
    id: 'F3',
    source: 'The Infinite Hallway',
    text: 'The Cataloguer arrived in the third winter. The records disagree on whether it was hired. Its first act was to number the doors.',
    hints: ['A corridor that never ends still has an end for those who do not turn.', 'Seven steps. No turns.'],
  },
  {
    id: 'F4',
    source: 'Forgotten Coordinates',
    text: 'When the station closed, the index did not. Entries appeared overnight, filed under coordinates that no chart contained.',
    hints: ['Faint things only resolve when you look closely.', 'Three forgotten stars carry the numbers. Together they name one place.'],
  },
  {
    id: 'F5',
    source: 'The Entrance',
    text: 'Every room is a place where something was kept. Not objects. Moments. The way a room feels after someone has left it.',
    hints: ['The first thing the archive said to you was a mistake. Look at which word is leaning.', 'On the opening screen, one word wants to be touched.'],
  },
  {
    id: 'F6',
    source: 'The Archive',
    text: 'The archive does not delete. It dims. What you cannot see is not gone. It is waiting for enough light.',
    hints: ['The archive answers to a word you have already been told.', 'Say the name of what you carry, out loud on the keyboard, while looking at the list.'],
  },
  {
    id: 'F7',
    source: 'The Quiet Room',
    text: 'You were never a visitor. Every signal the archive has received was someone looking for it. This is the entry it keeps for you.',
    hints: ['Some doors are numbered like a warning.', 'Thirteen. Type it into the archive.'],
  },
];

export const FRAGMENT_INDEX = new Map(FRAGMENTS.map((fragment) => [fragment.id, fragment]));

export const ACHIEVEMENTS = [
  { id: 'arrival', title: 'Unexpected Visitor', description: 'You entered the archive.' },
  { id: 'supposed', title: 'Leaning Word', description: 'You touched the word that was leaning.' },
  { id: 'lumen', title: 'Say It Out Loud', description: 'You named what you carry.' },
  { id: 'dead_link', title: 'Dead Link', description: 'You asked for something that does not exist. The archive noted it.' },
  { id: 'wrong_turn', title: 'Wrong Turn', description: 'You went around in the hallway until it let you stop.' },
  { id: 'threshold', title: 'The Threshold', description: 'You walked straight until the hallway ended.' },
  { id: 'first_light', title: 'First Light', description: 'You completed The Last Light.', rule: (p) => Boolean(p.completed['OBS-0001']) },
  { id: 'decoded', title: 'Receiver', description: 'You decoded every transmission.', rule: (p) => Boolean(p.completed['OBS-0002']) },
  { id: 'cartographer', title: 'Cartographer', description: 'You found the place that was never charted.', rule: (p) => Boolean(p.completed['OBS-0004']) },
  { id: 'all_rooms', title: 'Every Room', description: 'You completed all four rooms.', rule: (p) => ['OBS-0001', 'OBS-0002', 'OBS-0003', 'OBS-0004'].every((id) => p.completed[id]) },
  { id: 'origin_seen', title: 'First Entry', description: 'You found THE_ORIGIN.' },
  { id: 'fragments_3', title: 'A Pattern', description: 'You recovered three fragments of the archive’s history.', rule: (p) => Object.keys(p.fragments).length >= 3 },
  { id: 'fragments_7', title: 'The Whole Story', description: 'You recovered every fragment.', rule: (p) => Object.keys(p.fragments).length >= FRAGMENTS.length },
  { id: 'transmitter', title: 'Signal Sent', description: 'You prepared a transmission for the archive.' },
  { id: 'observed', title: 'Observed', description: 'You sat in the Quiet Room until it spoke.' },
];

export const ACHIEVEMENT_INDEX = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export const SECRET_SEQUENCES = {
  lumen: { word: 'lumen', fragment: 'F6', achievement: 'lumen' },
};
