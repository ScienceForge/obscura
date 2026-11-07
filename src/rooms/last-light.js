import { DWELL_SPOT, LIGHT_MESSAGES, createLightModel } from '../core/lights.js';
import { clamp, h, loop } from '../engine/dom.js';
import { reducedMotion } from '../engine/motion.js';

const DPR_CAP = 1.5;
const KEY_SPEED = 560;

export function mount(container, ctx) {
  const model = createLightModel();
  let size = { width: 1, height: 1, dpr: 1 };
  let completed = Boolean(ctx.store.get().completed['OBS-0001']);
  let dirty = true;
  let hintUntil = 0;
  let droneHandle = null;

  const canvas = h('canvas', { class: 'light__canvas', 'aria-hidden': 'true' });
  const counter = h('p', { class: 'light__count' });
  const log = h('ol', { class: 'light__log', 'aria-label': 'Messages found' });
  const status = h('p', { class: 'visually-hidden', role: 'status', 'aria-live': 'polite' });
  const hintButton = h('button', { class: 'room-btn', type: 'button', onclick: showHint }, 'Show me where');
  const textButton = h('button', { class: 'room-btn', type: 'button', onclick: readAsText }, 'Read the messages as text');
  const finale = h('p', { class: 'light__finale', hidden: true }, 'The light stays on. Something else, somewhere else, has begun to answer it.');

  const hud = h('div', { class: 'light__hud' },
    h('h1', { class: 'room-title', tabindex: '-1' }, 'The Last Light'),
    h('p', { class: 'room-help' }, 'Move the light. Press and hold to narrow the beam. On a keyboard: arrow keys or WASD, and Space.'),
    counter, log, finale);
  const actions = h('div', { class: 'light__actions' }, hintButton, textButton);
  const root = h('section', { class: 'room light', 'aria-label': 'Room 001, The Last Light' }, canvas, hud, actions, status);
  container.append(root);

  const makeLayer = () => document.createElement('canvas');
  const content = makeLayer();
  const found = makeLayer();
  const mask = makeLayer();

  function prepare(layer) {
    layer.width = Math.round(size.width * size.dpr);
    layer.height = Math.round(size.height * size.dpr);
    const g = layer.getContext('2d');
    g.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    g.clearRect(0, 0, size.width, size.height);
    return g;
  }

  function drawWrapped(g, text, cx, cy, maxWidth, lineHeight) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (g.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    lines.push(line);
    const top = cy - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((l, i) => g.fillText(l, cx, top + i * lineHeight));
  }

  function messageFont() {
    return Math.round(clamp(size.width * 0.021, 17, 28));
  }

  function drawMessage(g, message, alpha) {
    const fontSize = messageFont();
    g.font = `italic ${fontSize}px "Instrument Serif", Georgia, serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = `rgba(255, 240, 205, ${alpha})`;
    drawWrapped(g, message.text, message.x * size.width, message.y * size.height, Math.min(size.width * 0.34, 380), fontSize * 1.3);
  }

  function buildWorld(g) {
    const { width: w, height: ht } = size;
    g.strokeStyle = 'rgba(150, 178, 172, 0.5)';
    g.fillStyle = 'rgba(170, 195, 190, 0.6)';
    g.lineWidth = 1;
    const panel = clamp(w / 7, 110, 190);
    for (let x = panel / 2; x < w; x += panel) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, ht);
      g.stroke();
      for (let y = 30; y < ht; y += 44) {
        g.beginPath();
        g.arc(x - 9, y, 1.4, 0, Math.PI * 2);
        g.arc(x + 9, y, 1.4, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.beginPath();
    g.ellipse(w / 2, ht * 0.84, w * 0.2, ht * 0.07, 0, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(w / 2, ht * 0.18, Math.min(w, ht) * 0.5, Math.PI, Math.PI * 2);
    g.stroke();
  }

  function rebuild() {
    const g = prepare(content);
    buildWorld(g);
    for (const message of LIGHT_MESSAGES) drawMessage(g, message, 0.95);
    rebuildFound();
    prepare(mask);
    dirty = false;
  }

  function rebuildFound() {
    const g = prepare(found);
    for (const message of LIGHT_MESSAGES) if (model.isFound(message.id)) drawMessage(g, message, 0.3);
    if (model.dwellFound) drawMessage(g, DWELL_SPOT, 0.3);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    size = { width: Math.max(1, Math.round(rect.width)), height: Math.max(1, Math.round(rect.height)), dpr: Math.min(window.devicePixelRatio || 1, DPR_CAP) };
    canvas.width = Math.round(size.width * size.dpr);
    canvas.height = Math.round(size.height * size.dpr);
    dirty = true;
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  const light = { x: 0, y: 0, tx: 0, ty: 0, radius: 0, speed: 0, focus: false };
  light.x = light.tx = size.width * 0.5;
  light.y = light.ty = size.height * 0.5;
  const baseRadius = () => clamp(Math.min(size.width, size.height) * 0.27, 120, 250);
  light.radius = baseRadius();

  const keys = new Set();
  let pointerDown = false;

  const toLocal = (event) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse' || pointerDown) {
      const p = toLocal(event);
      light.tx = p.x;
      light.ty = p.y;
    }
  });
  canvas.addEventListener('pointerdown', (event) => {
    pointerDown = true;
    canvas.setPointerCapture?.(event.pointerId);
    const p = toLocal(event);
    light.tx = p.x;
    light.ty = p.y;
    light.focus = true;
  });
  const release = () => {
    pointerDown = false;
    light.focus = false;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  const MOVE_KEYS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1] };
  const typing = (target) => target instanceof HTMLElement && target.matches('input, textarea, select, button');
  const onKeyDown = (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (MOVE_KEYS[key] && !typing(event.target)) {
      keys.add(key);
      event.preventDefault();
    } else if ((key === ' ' || key === 'Shift') && !typing(event.target)) {
      light.focus = true;
      if (key === ' ') event.preventDefault();
    }
  };
  const onKeyUp = (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    keys.delete(key);
    if (key === ' ' || key === 'Shift') light.focus = pointerDown;
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  function addToLog(message) {
    log.append(h('li', {}, message.text));
    status.textContent = `Message revealed: ${message.text}`;
  }

  function updateCounter() {
    const n = model.foundIds.length;
    counter.textContent = `${n} of ${LIGHT_MESSAGES.length} messages found`;
  }

  function complete() {
    if (!completed) {
      completed = true;
      ctx.store.dispatch({ type: 'room/complete', id: 'OBS-0001' });
    }
    finale.hidden = false;
  }

  function handleStep(result) {
    for (const id of result.found) {
      const message = LIGHT_MESSAGES.find((m) => m.id === id);
      addToLog(message);
      ctx.audio.blip(520 + LIGHT_MESSAGES.indexOf(message) * 60, 0.5, { gain: 0.06 });
      rebuildFound();
    }
    if (result.dwell) {
      ctx.store.dispatch({ type: 'fragment/find', id: 'F1' });
      status.textContent = `A message appeared where nothing was written: ${DWELL_SPOT.text}`;
      rebuildFound();
    }
    if (result.found.length) updateCounter();
    if (model.allFound) complete();
  }

  function showHint() {
    hintUntil = performance.now() + 5500;
    const remaining = LIGHT_MESSAGES.filter((m) => !model.isFound(m.id));
    status.textContent = remaining.length
      ? 'A faint arrow now points toward the nearest message you have not found.'
      : model.dwellFound
        ? 'You have found everything in this room.'
        : 'Every written message is found. One more appears only where the light holds perfectly still.';
  }

  function readAsText() {
    for (const message of LIGHT_MESSAGES) {
      if (!model.isFound(message.id)) addToLog(message);
    }
    const hadDwell = model.dwellFound;
    model.revealAll();
    if (!hadDwell) {
      ctx.store.dispatch({ type: 'fragment/find', id: 'F1' });
      log.append(h('li', {}, DWELL_SPOT.text));
    }
    rebuildFound();
    updateCounter();
    complete();
    textButton.hidden = true;
  }

  let elapsed = 0;
  const stop = loop((dt, now) => {
    if (dirty) rebuild();
    elapsed += dt;

    if (keys.size) {
      let dx = 0;
      let dy = 0;
      for (const key of keys) {
        dx += MOVE_KEYS[key][0];
        dy += MOVE_KEYS[key][1];
      }
      const len = Math.hypot(dx, dy) || 1;
      light.tx = clamp(light.tx + (dx / len) * KEY_SPEED * dt, 0, size.width);
      light.ty = clamp(light.ty + (dy / len) * KEY_SPEED * dt, 0, size.height);
    }

    const ease = reducedMotion() ? 1 : 1 - Math.exp(-11 * dt);
    const px = light.x;
    const py = light.y;
    light.x += (light.tx - light.x) * ease;
    light.y += (light.ty - light.y) * ease;
    light.speed = dt > 0 ? Math.hypot(light.x - px, light.y - py) / dt : 0;

    const wanted = baseRadius() * (light.focus ? 0.55 : 1);
    light.radius += (wanted - light.radius) * (reducedMotion() ? 1 : 1 - Math.exp(-9 * dt));
    const flicker = reducedMotion() ? 1 : 1 + Math.sin(elapsed * 17) * 0.012 + Math.sin(elapsed * 41) * 0.008;
    const radius = light.radius * flicker;

    handleStep(model.step({ x: light.x, y: light.y, radius: wanted * flicker, speed: light.speed }, size, dt));

    draw(radius, now);
    updateDrone();
  });

  function draw(radius, now) {
    const g = canvas.getContext('2d');
    g.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#040405';
    g.fillRect(0, 0, size.width, size.height);

    const ambient = g.createRadialGradient(light.x, light.y, 0, light.x, light.y, radius * 2.4);
    ambient.addColorStop(0, `rgba(255, 238, 200, ${light.focus ? 0.2 : 0.13})`);
    ambient.addColorStop(1, 'rgba(255, 238, 200, 0)');
    g.fillStyle = ambient;
    g.fillRect(0, 0, size.width, size.height);

    g.drawImage(found, 0, 0, size.width, size.height);

    const m = mask.getContext('2d');
    m.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    m.globalCompositeOperation = 'source-over';
    m.clearRect(0, 0, size.width, size.height);
    const beam = m.createRadialGradient(light.x, light.y, 0, light.x, light.y, radius);
    const peak = light.focus ? 1 : 0.9;
    beam.addColorStop(0, `rgba(255, 255, 255, ${peak})`);
    beam.addColorStop(0.4, `rgba(255, 255, 255, ${peak * 0.7})`);
    beam.addColorStop(1, 'rgba(255, 255, 255, 0)');
    m.fillStyle = beam;
    m.fillRect(0, 0, size.width, size.height);
    m.globalCompositeOperation = 'source-in';
    m.drawImage(content, 0, 0, size.width, size.height);
    g.globalCompositeOperation = 'lighter';
    g.drawImage(mask, 0, 0, size.width, size.height);
    g.globalCompositeOperation = 'source-over';

    const dwell = model.dwellProgress();
    if (dwell > 0 && dwell < 1) {
      g.save();
      g.globalAlpha = dwell * dwell * 0.9;
      drawMessage(g, DWELL_SPOT, 1);
      g.restore();
    }

    const core = g.createRadialGradient(light.x, light.y, 0, light.x, light.y, 14);
    core.addColorStop(0, 'rgba(255, 252, 240, 0.95)');
    core.addColorStop(1, 'rgba(255, 252, 240, 0)');
    g.fillStyle = core;
    g.fillRect(light.x - 14, light.y - 14, 28, 28);

    if (now < hintUntil) drawHintArrow(g, now);
  }

  function drawHintArrow(g, now) {
    const remaining = LIGHT_MESSAGES.filter((message) => !model.isFound(message.id));
    const target = remaining.length ? remaining : [DWELL_SPOT];
    let best = null;
    let bestDistance = Infinity;
    for (const t of target) {
      const d = Math.hypot(t.x * size.width - light.x, t.y * size.height - light.y);
      if (d < bestDistance) {
        bestDistance = d;
        best = t;
      }
    }
    if (!best || bestDistance < light.radius * 0.5) return;
    const angle = Math.atan2(best.y * size.height - light.y, best.x * size.width - light.x);
    const pulse = 0.5 + Math.sin(now / 220) * 0.3;
    const r = light.radius * 0.78;
    g.save();
    g.translate(light.x + Math.cos(angle) * r, light.y + Math.sin(angle) * r);
    g.rotate(angle);
    g.strokeStyle = `rgba(255, 85, 96, ${pulse})`;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-8, -8);
    g.lineTo(2, 0);
    g.lineTo(-8, 8);
    g.stroke();
    g.restore();
  }

  function updateDrone() {
    if (ctx.audio.enabled && !droneHandle) droneHandle = ctx.audio.drone({ freq: 55, gain: 0.05, cutoff: 260, noiseGain: 0.15 });
    if (droneHandle) {
      droneHandle.set({ freq: 46 + (light.x / size.width) * 36, gain: light.focus ? 0.08 : 0.045, cutoff: 200 + (1 - light.y / size.height) * 400 });
    }
  }

  updateCounter();
  if (completed) finale.hidden = false;
  hud.querySelector('.room-title').focus({ preventScroll: true });

  return {
    destroy() {
      stop();
      observer.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      droneHandle?.stop();
    },
  };
}
