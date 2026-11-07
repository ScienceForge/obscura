/**
 * Room 001, The Last Light: the logic of what a moving light reveals.
 * Positions are fractions of the room (0..1); the light is in pixels, so the
 * model is told the room size on every step.
 */

export const LIGHT_MESSAGES = [
  { id: 'm1', x: 0.4, y: 0.3, text: 'IT WAS NEVER DARK HERE. IT WAS WAITING.' },
  { id: 'm2', x: 0.7, y: 0.17, text: 'YOU CARRY A LIGHT. ITS OLD NAME IS LUMEN.' },
  { id: 'm3', x: 0.27, y: 0.7, text: 'DO NOT LOOK FOR THE SOURCE. BE THE SOURCE.' },
  { id: 'm4', x: 0.78, y: 0.62, text: 'SOME THINGS ONLY APPEAR TO THOSE WHO HOLD STILL.' },
  { id: 'm5', x: 0.5, y: 0.9, text: 'A LIGHT HELD STEADY BECOMES A WINDOW.' },
];

/** A spot with no visible message: the light must rest on it. */
export const DWELL_SPOT = { x: 0.57, y: 0.5, text: 'STATION 9 WAS BUILT TO LISTEN.' };

const distance = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

export function createLightModel({
  messages = LIGHT_MESSAGES,
  dwell = DWELL_SPOT,
  revealSeconds = 1.1,
  dwellSeconds = 4,
  stillSpeed = 40,
  reach = 0.6,
} = {}) {
  const exposure = new Map(messages.map((message) => [message.id, 0]));
  const found = new Set();
  let dwellTime = 0;
  let dwellFound = false;

  return {
    /**
     * @param {{ x: number, y: number, radius: number, speed: number }} light  pixels and px/s
     * @param {{ width: number, height: number }} size
     * @param {number} dt seconds
     * @returns {{ found: string[], dwell: boolean }} things newly revealed this step
     */
    step(light, size, dt) {
      const revealed = [];
      for (const message of messages) {
        if (found.has(message.id)) continue;
        const d = distance(light.x, light.y, message.x * size.width, message.y * size.height);
        const current = exposure.get(message.id);
        const next = d <= light.radius * reach ? current + dt : Math.max(0, current - dt * 0.5);
        exposure.set(message.id, next);
        if (next >= revealSeconds) {
          found.add(message.id);
          revealed.push(message.id);
        }
      }

      let dwellNow = false;
      if (!dwellFound) {
        const d = distance(light.x, light.y, dwell.x * size.width, dwell.y * size.height);
        if (d <= light.radius * 0.5 && light.speed < stillSpeed) dwellTime += dt;
        else dwellTime = Math.max(0, dwellTime - dt * 2);
        if (dwellTime >= dwellSeconds) {
          dwellFound = true;
          dwellNow = true;
        }
      }
      return { found: revealed, dwell: dwellNow };
    },

    /** 0..1 how revealed a message is, for drawing. */
    progress: (id) => (found.has(id) ? 1 : Math.min(1, (exposure.get(id) ?? 0) / revealSeconds)),
    dwellProgress: () => (dwellFound ? 1 : Math.min(1, dwellTime / dwellSeconds)),
    isFound: (id) => found.has(id),
    get dwellFound() {
      return dwellFound;
    },
    get foundIds() {
      return [...found];
    },
    get allFound() {
      return found.size === messages.length;
    },
    /** Accessible alternative: mark everything as read. */
    revealAll() {
      for (const message of messages) found.add(message.id);
      dwellFound = true;
    },
  };
}
