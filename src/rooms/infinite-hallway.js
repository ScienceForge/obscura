import { SPECIALS, SPECIAL_IDS, describePosition, step } from '../core/hallway.js';
import { clamp, fitCanvas, h, loop } from '../engine/dom.js';
import { reducedMotion } from '../engine/motion.js';

const SHRINK = 0.8;
const MOVE_MS = 520;

const HINTS = {
  threshold: ['Not every door asks you to turn.', 'Try walking in a straight line. Count your steps.', 'Seven steps forward, and no turning.'],
  numbered: ['Some turns only mean something together.', 'Two directions, each taken twice.', 'Left, left, right, right.'],
  loop: ['Repetition makes a circle.', 'Take the same turn again and again.', 'Right, right, right.'],
};

const rgb = (c, k = 1, a = 1) => `rgba(${Math.round(c[0] * k)}, ${Math.round(c[1] * k)}, ${Math.round(c[2] * k)}, ${a})`;

function inside(point, polygon) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/**
 * Room 003: The Infinite Hallway. Three doors at every position. Where you
 * are is just the sequence of turns you took; the hallway invents everything
 * else, the same way every time. Three places in it are not like the others.
 */
export function mount(container, ctx) {
  let path = '';
  const foundSpecials = new Set();
  const hintLevel = { threshold: 0, numbered: 0, loop: 0 };
  let completed = Boolean(ctx.store.get().completed['OBS-0003']);
  let hover = null;
  let polygons = [];
  let anim = null;
  let node = describePosition(path);

  /* ------------------------------------------------------------- elements */
  const canvas = h('canvas', { class: 'hall__canvas', 'aria-hidden': 'true' });
  const level = h('p', { class: 'hall__level' });
  const whisper = h('p', { class: 'hall__whisper', role: 'status', 'aria-live': 'polite' });
  const places = h('ul', { class: 'hall__places', 'aria-label': 'Places found' });
  const hints = h('ul', { class: 'hall__hints' });
  const finale = h('p', { class: 'hall__finale', hidden: true }, 'Every doorway was a way back. The hallway is endless only for those who keep turning.');

  const pad = (label, move, key) => h('button', { class: 'hall__pad', type: 'button', 'aria-keyshortcuts': key, onclick: () => go(move) }, label);
  const pads = h('div', { class: 'hall__pads', role: 'group', 'aria-label': 'Move' }, pad('◄ Left', 'L', 'ArrowLeft'), pad('▲ Forward', 'F', 'ArrowUp'), pad('Right ►', 'R', 'ArrowRight'), pad('▼ Back', 'B', 'ArrowDown'));
  const hintButton = h('button', { class: 'room-btn', type: 'button', onclick: giveHint }, 'Hint');

  const hud = h('div', { class: 'hall__hud' }, h('h1', { class: 'room-title', tabindex: '-1' }, 'The Infinite Hallway'), h('p', { class: 'room-help' }, 'Choose a door: click it, use the buttons, or the arrow keys. Down arrow or Backspace steps back.'), level, places, hints);
  const root = h('section', { class: 'room hall', 'aria-label': 'Room 003, The Infinite Hallway' }, canvas, hud, h('div', { class: 'hall__foot' }, finale, whisper, pads, hintButton));
  container.append(root);

  /* ------------------------------------------------------------- behaviour */
  function renderPlaces() {
    places.replaceChildren(...SPECIAL_IDS.map((id) => h('li', { class: foundSpecials.has(id) ? 'is-found' : '' }, foundSpecials.has(id) ? SPECIALS[id].title : '? ? ?')));
  }

  function arrive() {
    node = describePosition(path);
    level.textContent = `LEVEL ${String(node.depth).padStart(2, '0')}`;
    whisper.textContent = node.whisper;
    const special = node.special;
    if (special && !foundSpecials.has(special.id)) {
      foundSpecials.add(special.id);
      if (special.fragment) ctx.store.dispatch({ type: 'fragment/find', id: special.fragment });
      if (special.achievement) ctx.store.dispatch({ type: 'achievement/award', id: special.achievement });
      ctx.audio.blip(330, 0.9, { gain: 0.07 });
      renderPlaces();
      if (SPECIAL_IDS.every((id) => foundSpecials.has(id))) {
        if (!completed) ctx.store.dispatch({ type: 'room/complete', id: 'OBS-0003' });
        completed = true;
        finale.hidden = false;
      }
    }
  }

  function go(move) {
    if (anim) return;
    const next = step(path, move);
    if (next === path) {
      whisper.textContent = 'There is nothing behind you. This is where it begins.';
      return;
    }
    ctx.audio.burst(0.18, { freq: 140, q: 1.2, gain: 0.14, type: 'lowpass' });
    if (reducedMotion()) {
      path = next;
      arrive();
      return;
    }
    anim = { start: performance.now(), move, next, swapped: false };
  }

  function giveHint() {
    const target = SPECIAL_IDS.find((id) => !foundSpecials.has(id));
    if (!target) {
      hints.replaceChildren(h('li', {}, 'You have found every place there is to find here.'));
      return;
    }
    hintLevel[target] = Math.min(HINTS[target].length, hintLevel[target] + 1);
    hints.replaceChildren(...HINTS[target].slice(0, hintLevel[target]).map((text) => h('li', {}, text)));
    whisper.textContent = `Hint: ${HINTS[target][hintLevel[target] - 1]}`;
  }

  /* ----------------------------------------------------------------- input */
  const KEYMAP = { ArrowLeft: 'L', ArrowRight: 'R', ArrowUp: 'F', ArrowDown: 'B', Backspace: 'B', a: 'L', d: 'R', w: 'F', s: 'B' };
  const onKey = (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target instanceof HTMLElement && event.target.matches('input, textarea, select')) return;
    const move = KEYMAP[event.key.length === 1 ? event.key.toLowerCase() : event.key];
    if (!move) return;
    event.preventDefault();
    go(move);
  };
  window.addEventListener('keydown', onKey);

  const local = (event) => {
    const rect = canvas.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  };
  canvas.addEventListener('pointermove', (event) => {
    const point = local(event);
    hover = polygons.find((p) => inside(point, p.points))?.move ?? null;
    canvas.style.cursor = hover ? 'pointer' : 'default';
  });
  canvas.addEventListener('pointerleave', () => { hover = null; });
  canvas.addEventListener('click', (event) => {
    const point = local(event);
    const hit = polygons.find((p) => inside(point, p.points));
    if (hit) go(hit.move);
  });

  /* ------------------------------------------------------------- rendering */
  function drawNode(g, n, W, H, { zoom = 1, alpha = 1, shift = 0, hot = null, now = 0 } = {}) {
    const cx = W / 2 + shift;
    const cy = H * (0.5 + n.tilt);
    const wall = n.palette.wall;
    const light = n.palette.light;
    const hw = (f) => ((W * n.width) / 2) * SHRINK ** f * zoom;
    const hh = (f) => H * 0.42 * SHRINK ** f * zoom;
    const quad = (pts, fill) => {
      g.fillStyle = fill;
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.fill();
    };
    const doorPolys = [];

    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = rgb(wall, 0.35);
    g.fillRect(0, 0, W, H);

    for (let i = n.steps; i >= 0; i -= 1) {
      const k = 0.5 + 0.5 * (1 - i / n.steps);
      const [x0, y0, x1, y1] = [hw(i), hh(i), hw(i + 1), hh(i + 1)];
      quad([[cx - x0, cy - y0], [cx + x0, cy - y0], [cx + x1, cy - y1], [cx - x1, cy - y1]], rgb(wall, k * 0.7)); // ceiling
      quad([[cx - x0, cy + y0], [cx + x0, cy + y0], [cx + x1, cy + y1], [cx - x1, cy + y1]], rgb(wall, k * 1.15)); // floor
      quad([[cx - x0, cy - y0], [cx - x0, cy + y0], [cx - x1, cy + y1], [cx - x1, cy - y1]], rgb(wall, k * 0.95)); // left wall
      quad([[cx + x0, cy - y0], [cx + x0, cy + y0], [cx + x1, cy + y1], [cx + x1, cy - y1]], rgb(wall, k * 0.95)); // right wall
      g.strokeStyle = rgb(light, 1, 0.1 + 0.1 * k);
      g.lineWidth = 1;
      g.strokeRect(cx - x0, cy - y0, x0 * 2, y0 * 2);
    }

    // Ceiling lamps.
    for (let l = 0; l < n.lamps; l += 1) {
      const f = 1.5 + (l * (n.steps - 3)) / Math.max(1, n.lamps);
      const on = n.flicker ? 0.55 + 0.45 * Math.sin(now / 90 + l * 3) ** 2 : 1;
      const [a, b] = [f, f + 0.35];
      quad([[cx - hw(a) * 0.35, cy - hh(a)], [cx + hw(a) * 0.35, cy - hh(a)], [cx + hw(b) * 0.35, cy - hh(b)], [cx - hw(b) * 0.35, cy - hh(b)]], rgb(light, 1, 0.9 * on));
      const glow = g.createRadialGradient(cx, cy - hh(f) * 0.8, 0, cx, cy - hh(f) * 0.8, hw(f) * 0.9);
      glow.addColorStop(0, rgb(light, 1, 0.16 * on));
      glow.addColorStop(1, rgb(light, 1, 0));
      g.fillStyle = glow;
      g.fillRect(0, 0, W, H);
    }

    // Side doors.
    for (const door of n.doors.filter((d) => d.move !== 'F')) {
      const a = door.at;
      const side = door.move === 'L' ? -1 : 1;
      const xa = cx + side * hw(a);
      const xb = cx + side * hw(a + 1);
      const mid = (f) => cy + hh(f) * 0.62;
      const top = (f) => cy + hh(f) * -0.15;
      const points = [[xa, top(a)], [xa, mid(a)], [xb, mid(a + 1)], [xb, top(a + 1)]];
      doorPolys.push({ move: door.move, points });
      quad(points, hot === door.move ? rgb(light, 0.55, 0.9) : 'rgba(2,2,3,0.96)');
      g.strokeStyle = rgb(light, 1, hot === door.move ? 0.95 : 0.4);
      g.lineWidth = 1.5;
      g.stroke();
      g.fillStyle = rgb(light, 1, 0.55);
      g.font = `${Math.max(12, hw(a + 0.5) * 0.12)}px "JetBrains Mono Variable", monospace`;
      g.textAlign = 'center';
      g.fillText(door.glyph, (xa + xb) / 2, (top(a) + mid(a)) / 2);
    }

    // The far end.
    const fw = hw(n.steps + 1);
    const fh = hh(n.steps + 1);
    const special = n.special;
    const end = [[cx - fw, cy - fh], [cx + fw, cy - fh], [cx + fw, cy + fh], [cx - fw, cy + fh]];
    doorPolys.push({ move: 'F', points: end.map(([x, y]) => [cx + (x - cx) * 3, cy + (y - cy) * 3]) });
    if (special?.id === 'threshold') {
      const bloom = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.42);
      bloom.addColorStop(0, 'rgba(255,255,250,0.95)');
      bloom.addColorStop(1, 'rgba(255,255,250,0)');
      g.fillStyle = bloom;
      g.fillRect(0, 0, W, H);
    } else {
      quad(end, hot === 'F' ? rgb(light, 0.5, 0.9) : 'rgba(0,0,0,0.97)');
      g.fillStyle = rgb(light, 1, 0.7);
      g.font = `${Math.max(10, fw * 1.4)}px "JetBrains Mono Variable", monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(special?.id === 'numbered' ? '13' : n.doors.find((d) => d.move === 'F').glyph, cx, cy);
    }

    // Depth: the vanishing point swallows light.
    const fog = g.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.6);
    fog.addColorStop(0, 'rgba(0,0,0,0.25)');
    fog.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = fog;
    g.fillRect(0, 0, W, H);
    g.restore();
    return doorPolys;
  }

  const stop = loop((dt, now) => {
    const { width: W, height: H, ctx: g } = fitCanvas(canvas, 1.5);
    g.fillStyle = '#030304';
    g.fillRect(0, 0, W, H);

    if (!anim) {
      polygons = drawNode(g, node, W, H, { hot: hover, now });
      return;
    }

    const p = clamp((now - anim.start) / MOVE_MS, 0, 1);
    const sign = anim.move === 'L' ? -1 : anim.move === 'R' ? 1 : 0;
    if (p < 0.5) {
      const k = p / 0.5;
      drawNode(g, node, W, H, { zoom: anim.move === 'B' ? 1 - k * 0.3 : 1 + k * 0.9, alpha: 1 - k, shift: -sign * k * W * 0.3, now });
    } else {
      if (!anim.swapped) {
        anim.swapped = true;
        path = anim.next;
        arrive();
      }
      const k = (p - 0.5) / 0.5;
      drawNode(g, node, W, H, { zoom: anim.move === 'B' ? 1.4 - k * 0.4 : 0.7 + k * 0.3, alpha: k, shift: sign * (1 - k) * W * 0.3, now });
    }
    polygons = [];
    if (p >= 1) {
      anim = null;
    }
  });

  arrive();
  renderPlaces();
  root.querySelector('.room-title').focus({ preventScroll: true });

  return {
    destroy() {
      stop();
      window.removeEventListener('keydown', onKey);
    },
  };
}
