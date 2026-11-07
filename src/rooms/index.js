/**
 * Rooms are loaded on demand, so the archive itself stays small and each
 * room's code only downloads when someone walks into it.
 */
export const ROOM_LOADERS = {
  'OBS-0013': () => import('./quiet-room.js'),
};
