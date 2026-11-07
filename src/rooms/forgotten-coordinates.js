import {
  FAINT_ZOOM,
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
} from '../core/starmap.js';
import { clamp, fitCanvas, h, loop } from '../engine/dom.js';
import { reducedMotion } from '../engine/motion.js';

const MIN_ZOOM = 0.7;
const MAX_ZOOM = 9;
const HINTS = [
  'Faint things only resolve when you look closely.',
  'Three forgotten stars each carry a piece of a coordinate. They sit beside Vesper, Halcyon and Mirelle.',
  'Zoom in beside each of those three. Together the pieces give right ascension hours, minutes, and declination.',
];

export function mount(container, ctx) {
  const stars = generateStars();
  const named = stars.filter((s) => s.name);
  const foundPieces = new Set();
  let completed = Boolean(ctx.store.get().completed['OBS-0004']);
  let revealed = false;
  let selected = null;
  let hintLevel = 0;
  let size = { width: 1, height: 1 };

  const view = { x: -150, y: 0, zoom: 1 };
  let fly = null;

  const canvas = h('canvas', { class: 'map__canvas', tabindex: '0', role: 'application', 'aria-label': 'Star chart. Arrow keys pan, plus and minus zoom, Enter inspects the nearest star.' });
  const readout = h('p', { class: 'map__readout' });
  const info = h('div', { class: 'map__info', role: 'status', 'aria-live': 'polite' }, h('p', { class: 'map__info-empty' }, 'Select a star to read its entry.'));
  const pieces = h('ul', { class: 'map__pieces', 'aria-label': 'Recovered coordinate pieces' });
  const hints = h('ul', { class: 'map__hints' });
  const message = h('p', { class: 'map__message', role: 'status', 'aria-live': 'polite' });
  const coordInput = h('input', { class: 'map__input', type: 'text', id: 'coords', autocomplete: 'off', spellcheck: 'false', maxLength: 30, placeholder: '00h 00m +00°', 'aria-describedby': 'coords-help' });
  const form = h('form', { class: 'map__form', onsubmit: tune },
    h('label', { for: 'coords' }, 'Tune to coordinates'), coordInput, h('button', { class: 'room-btn', type: 'submit' }, 'Tune'));
  const catalogue = h('details', { class: 'map__catalogue' }, h('summary', {}, 'Catalogued stars'), h('ul', {}, named.map((star) => h('li', {}, h('button', { class: 'link', type: 'button', onclick: () => { flyTo(star.x, star.y, 3); select(star); } }, star.name)))));
  const hintButton = h('button', { class: 'room-btn', type: 'button', onclick: giveHint }, 'Hint');
  const readButton = h('button', { class: 'room-btn', type: 'button', hidden: true, onclick: readPieces }, 'Read the coordinate pieces as text');

  const hud = h('div', { class: 'map__hud' },
    h('h1', { class: 'room-title', tabindex: '-1' }, 'Forgotten Coordinates'),
    h('p', { class: 'room-help' }, 'Drag to move, scroll or pinch to zoom. Some things only resolve up close.'),
    readout, pieces, info);
  const foot = h('div', { class: 'map__foot' }, form, h('p', { class: 'visually-hidden', id: 'coords-help' }, 'Type right ascension hours, minutes and declination, for example 04h 17m minus 39.'), message, h('div', { class: 'map__tools' }, hintButton, readButton, catalogue), hints);
  const root = h('section', { class: 'room map', 'aria-label': 'Room 004, Forgotten Coordinates' }, canvas, hud, foot);
  container.append(root);

  const scale = () => (Math.min(size.width, size.height) / 2300) * view.zoom;
  const toScreen = (x, y) => [(x - view.x) * scale() + size.width / 2, (y - view.y) * scale() + size.height / 2];
  const toWorld = (sx, sy) => [(sx - size.width / 2) / scale() + view.x, (sy - size.height / 2) / scale() + view.y];

  function clampView() {
    view.zoom = clamp(view.zoom, MIN_ZOOM, MAX_ZOOM);
    view.x = clamp(view.x, -WORLD * 1.05, WORLD * 1.05);
    view.y = clamp(view.y, -WORLD * 1.05, WORLD * 1.05);
  }

  function flyTo(x, y, zoom) {
    if (reducedMotion()) {
      Object.assign(view, { x, y, zoom });
      clampView();
      return;
    }
    fly = { from: { ...view }, to: { x, y, zoom }, start: performance.now(), ms: 1100 };
  }

  const faintVisible = () => view.zoom >= FAINT_ZOOM * 0.85;
  const faintSelectable = () => view.zoom >= FAINT_ZOOM;

  function renderPieces() {
    pieces.replaceChildren(...FORGOTTEN.map((f) => h('li', { class: foundPieces.has(f.id) ? 'is-found' : '' }, foundPieces.has(f.id) ? f.piece : '— — —')));
  }

  function renderInfo() {
    if (!selected) return;
    const coords = formatCoords(worldToCoords(selected.x, selected.y));
    let title = selected.name ?? selected.id.replace(/-\d+$/, '');
    let body = selected.name ? 'Catalogued. Nothing unusual has been recorded.' : 'Catalogued. Nothing unusual has been recorded.';
    let clue = null;
    if (selected.forgotten) {
      title = 'UNCATALOGUED OBJECT';
      body = `Near ${selected.forgotten.near}. It was not on the chart until you looked.`;
      clue = selected.forgotten.clue;
    }
    if (selected.target) {
      title = 'THE FORGOTTEN COORDINATE';
      body = 'A star that was never charted. It is catalogued now.';
    }
    info.replaceChildren(...[h('p', { class: 'map__info-title' }, title), h('p', { class: 'map__info-line' }, coords), h('p', {}, body), clue ? h('p', { class: 'map__info-clue' }, clue) : null].filter(Boolean));
  }

  function select(star) {
    selected = star;
    if (star.forgotten && !foundPieces.has(star.forgotten.id)) {
      foundPieces.add(star.forgotten.id);
      renderPieces();
      ctx.audio.blip(740, 0.5, { gain: 0.06 });
      message.textContent = `A piece of a coordinate: ${star.forgotten.piece}`;
    }
    renderInfo();
  }

  function inspectAt(sx, sy) {
    const [wx, wy] = toWorld(sx, sy);
    const radius = 16 / scale();
    if (faintSelectable()) {
      for (const f of FORGOTTEN) {
        const p = forgottenPosition(f);
        if (Math.hypot(p.x - wx, p.y - wy) <= radius) return select({ id: f.id, x: p.x, y: p.y, mag: 0.2, forgotten: f });
      }
    }
    if (revealed) {
      const t = coordsToWorld(TARGET);
      if (Math.hypot(t.x - wx, t.y - wy) <= radius) return select({ id: 'TARGET', x: t.x, y: t.y, mag: 1, target: true });
    }
    const star = nearestStar(stars, wx, wy, radius, (s) => s.mag > 0.12 || view.zoom > 2);
    if (star) select(star);
    return undefined;
  }

  function tune(event) {
    event.preventDefault();
    const coords = parseCoordinates(coordInput.value);
    if (!coords) {
      message.textContent = `Coordinates not understood. Try something like ${formatCoords(TARGET).replace('−', '-')}.`;
      return;
    }
    const world = coordsToWorld(coords);
    flyTo(world.x, world.y, isTarget(coords) ? 5 : 3.2);
    if (!isTarget(coords)) {
      message.textContent = `Nothing answers at ${formatCoords(coords)}. The chart there is only sky.`;
      ctx.audio.burst(0.3, { freq: 600, gain: 0.05 });
      return;
    }
    ignite();
  }

  function ignite() {
    revealed = true;
    ctx.audio.discovery();
    message.textContent = 'Something answers. A star that was never charted is lit.';
    ctx.store.dispatch({ type: 'fragment/find', id: 'F4' });
    if (!completed) ctx.store.dispatch({ type: 'room/complete', id: 'OBS-0004' });
    completed = true;
    const t = coordsToWorld(TARGET);
    selected = { id: 'TARGET', x: t.x, y: t.y, mag: 1, target: true };
    renderInfo();
  }

  function giveHint() {
    hintLevel = Math.min(HINTS.length, hintLevel + 1);
    hints.replaceChildren(...HINTS.slice(0, hintLevel).map((text) => h('li', {}, text)));
    message.textContent = `Hint: ${HINTS[hintLevel - 1]}`;
    hintButton.textContent = hintLevel >= HINTS.length ? 'No more hints' : `Hint (${hintLevel}/${HINTS.length})`;
    hintButton.disabled = hintLevel >= HINTS.length;
    readButton.hidden = hintLevel < HINTS.length;
  }

  function readPieces() {
    for (const f of FORGOTTEN) foundPieces.add(f.id);
    renderPieces();
    message.textContent = `The three pieces: ${FORGOTTEN.map((f) => f.clue).join('; ')}. Enter them together as one coordinate.`;
    readButton.hidden = true;
  }

  const pointers = new Map();
  let dragMoved = 0;
  let pinchStart = null;

  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    dragMoved = 0;
    fly = null;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.zoom };
    }
  });
  canvas.addEventListener('pointermove', (event) => {
    const prev = pointers.get(event.pointerId);
    if (!prev) return;
    const next = { x: event.clientX, y: event.clientY };
    pointers.set(event.pointerId, next);
    if (pointers.size === 2 && pinchStart) {
      const [a, b] = [...pointers.values()];
      view.zoom = pinchStart.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinchStart.dist);
      clampView();
      return;
    }
    dragMoved += Math.abs(next.x - prev.x) + Math.abs(next.y - prev.y);
    view.x -= (next.x - prev.x) / scale();
    view.y -= (next.y - prev.y) / scale();
    clampView();
  });
  const endPointer = (event) => {
    const wasSingle = pointers.size === 1;
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (wasSingle && dragMoved < 6 && event.type === 'pointerup') {
      const rect = canvas.getBoundingClientRect();
      inspectAt(event.clientX - rect.left, event.clientY - rect.top);
    }
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    const [bx, by] = toWorld(sx, sy);
    view.zoom *= Math.exp(-event.deltaY * 0.0016);
    clampView();
    const [ax, ay] = toWorld(sx, sy);
    view.x += bx - ax;
    view.y += by - ay;
    clampView();
  }, { passive: false });

  const onKey = (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target instanceof HTMLElement && event.target.matches('input, textarea, select, button, summary')) return;
    const step = 140 / scale();
    const actions = {
      ArrowLeft: () => { view.x -= step * 0.4; },
      ArrowRight: () => { view.x += step * 0.4; },
      ArrowUp: () => { view.y -= step * 0.4; },
      ArrowDown: () => { view.y += step * 0.4; },
      '+': () => { view.zoom *= 1.2; },
      '=': () => { view.zoom *= 1.2; },
      '-': () => { view.zoom /= 1.2; },
      Enter: () => inspectAt(size.width / 2, size.height / 2),
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    fly = null;
    action();
    clampView();
  };
  window.addEventListener('keydown', onKey);

  const resizeObserver = new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect();
    size = { width: Math.max(1, rect.width), height: Math.max(1, rect.height) };
  });
  resizeObserver.observe(canvas);

  function drawGrid(g) {
    g.lineWidth = 1;
    g.font = '10px "JetBrains Mono Variable", monospace';
    g.fillStyle = 'rgba(140, 160, 210, 0.45)';
    for (let w = -WORLD; w <= WORLD; w += WORLD / 4) {
      const [sx] = toScreen(w, 0);
      g.strokeStyle = 'rgba(91, 140, 255, 0.07)';
      g.beginPath();
      g.moveTo(sx, 0);
      g.lineTo(sx, size.height);
      g.stroke();
      const hour = worldToCoords(w, 0);
      g.textAlign = 'left';
      if (sx > 4 && sx < size.width - 40) g.fillText(`${String(hour.h).padStart(2, '0')}h`, sx + 4, size.height - 10);
    }
    for (let w = -WORLD; w <= WORLD; w += WORLD / 3) {
      const [, sy] = toScreen(0, w);
      g.strokeStyle = 'rgba(91, 140, 255, 0.07)';
      g.beginPath();
      g.moveTo(0, sy);
      g.lineTo(size.width, sy);
      g.stroke();
      const dec = worldToCoords(0, w).dec;
      g.textAlign = 'left';
      if (sy > 16 && sy < size.height - 4) g.fillText(`${dec >= 0 ? '+' : '−'}${Math.abs(dec)}°`, 8, sy - 4);
    }
  }

  const stop = loop((dt, now) => {
    if (fly) {
      const p = clamp((now - fly.start) / fly.ms, 0, 1);
      const e = 1 - (1 - p) ** 3;
      view.x = fly.from.x + (fly.to.x - fly.from.x) * e;
      view.y = fly.from.y + (fly.to.y - fly.from.y) * e;
      view.zoom = fly.from.zoom * (fly.to.zoom / fly.from.zoom) ** e;
      clampView();
      if (p >= 1) fly = null;
    }

    const { width, height, ctx: g } = fitCanvas(canvas, 1.5);
    size = { width, height };
    g.fillStyle = '#020306';
    g.fillRect(0, 0, width, height);
    drawGrid(g);

    const s = scale();
    const sizeBoost = Math.min(1.8, Math.sqrt(view.zoom));
    for (const star of stars) {
      const [sx, sy] = toScreen(star.x, star.y);
      if (sx < -20 || sy < -20 || sx > width + 20 || sy > height + 20) continue;
      const twinkle = reducedMotion() ? 1 : 0.85 + 0.15 * Math.sin(now / 700 + star.x);
      const r = (0.5 + star.mag * 1.5) * sizeBoost;
      g.fillStyle = `rgba(200, 215, 255, ${(0.18 + star.mag * 0.75) * twinkle})`;
      g.fillRect(sx - r / 2, sy - r / 2, r, r);
      if (star.name) {
        g.strokeStyle = 'rgba(200, 215, 255, 0.4)';
        g.beginPath();
        g.arc(sx, sy, 7, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = 'rgba(214, 214, 210, 0.7)';
        g.font = '11px "JetBrains Mono Variable", monospace';
        g.textAlign = 'left';
        g.fillText(star.name.toUpperCase(), sx + 12, sy + 4);
      }
    }

    if (faintVisible()) {
      const fade = clamp((view.zoom - FAINT_ZOOM * 0.85) / (FAINT_ZOOM * 0.3), 0, 1);
      for (const f of FORGOTTEN) {
        const p = forgottenPosition(f);
        const [sx, sy] = toScreen(p.x, p.y);
        const pulse = reducedMotion() ? 0.6 : 0.5 + 0.5 * Math.sin(now / 450);
        const got = foundPieces.has(f.id);
        g.fillStyle = got ? 'rgba(91, 140, 255, 0.95)' : `rgba(200, 215, 255, ${0.2 * fade + pulse * 0.25 * fade})`;
        g.fillRect(sx - 1.5, sy - 1.5, 3, 3);
        if (got) {
          g.strokeStyle = 'rgba(91, 140, 255, 0.7)';
          g.beginPath();
          g.arc(sx, sy, 9 + pulse * 2, 0, Math.PI * 2);
          g.stroke();
        }
      }
    }

    if (revealed) {
      const t = coordsToWorld(TARGET);
      const [sx, sy] = toScreen(t.x, t.y);
      const pulse = reducedMotion() ? 1 : 0.7 + 0.3 * Math.sin(now / 380);
      const glow = g.createRadialGradient(sx, sy, 0, sx, sy, 60 * pulse);
      glow.addColorStop(0, 'rgba(255, 85, 96, 0.95)');
      glow.addColorStop(0.2, 'rgba(255, 85, 96, 0.35)');
      glow.addColorStop(1, 'rgba(255, 85, 96, 0)');
      g.fillStyle = glow;
      g.fillRect(sx - 70, sy - 70, 140, 140);
    }

    if (selected) {
      const [sx, sy] = toScreen(selected.x, selected.y);
      g.strokeStyle = 'rgba(241, 241, 238, 0.85)';
      g.lineWidth = 1;
      g.strokeRect(sx - 12, sy - 12, 24, 24);
    }

    g.strokeStyle = 'rgba(214, 214, 210, 0.25)';
    g.beginPath();
    g.moveTo(width / 2 - 8, height / 2);
    g.lineTo(width / 2 + 8, height / 2);
    g.moveTo(width / 2, height / 2 - 8);
    g.lineTo(width / 2, height / 2 + 8);
    g.stroke();

    const c = worldToCoords(view.x, view.y);
    readout.textContent = `${formatCoords(c)}  ×${(view.zoom).toFixed(1)}${faintSelectable() ? '  · close enough to resolve faint objects' : ''}`;
    return s;
  });

  renderPieces();
  root.querySelector('.room-title').focus({ preventScroll: true });

  return {
    destroy() {
      stop();
      resizeObserver.disconnect();
      window.removeEventListener('keydown', onKey);
    },
  };
}
