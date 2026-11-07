export const ROOM_LOADERS = {
  'OBS-0001': () => import('./last-light.js'),
  'OBS-0002': () => import('./signal-lost.js'),
  'OBS-0003': () => import('./infinite-hallway.js'),
  'OBS-0004': () => import('./forgotten-coordinates.js'),
  'OBS-0013': () => import('./quiet-room.js'),
};
