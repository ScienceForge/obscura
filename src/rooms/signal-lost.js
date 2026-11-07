import { TRANSMISSIONS, decode, isSolved, signalStrength } from '../core/cipher.js';
import { fitCanvas, h, loop, uid } from '../engine/dom.js';
import { reducedMotion } from '../engine/motion.js';

const STATIC = '█▓▒░#%&?/\\|';

export function mount(container, ctx) {
  const wasCompleted = Boolean(ctx.store.get().completed['OBS-0002']);
  const solved = new Set();
  const attempts = TRANSMISSIONS.map(() => ({ shift: 0, mirror: false, key: '' }));
  const hintLevel = TRANSMISSIONS.map(() => 0);
  let current = 0;
  let strength = 0;
  let droneHandle = null;
  let flickerTimer = 0;

  const unlocked = (index) => wasCompleted || index === 0 || TRANSMISSIONS.slice(0, index).every((t) => solved.has(t.id));

  const scope = h('canvas', { class: 'signal__scope', 'aria-hidden': 'true' });
  const tabs = h('div', { class: 'signal__tabs', role: 'tablist', 'aria-label': 'Transmissions' });
  const tabButtons = TRANSMISSIONS.map((t, index) =>
    h('button', { class: 'signal__tab', type: 'button', role: 'tab', id: `tab-${t.id}`, onclick: () => select(index) }, t.label.replace('TRANSMISSION ', 'TX ')),
  );
  tabs.append(...tabButtons);

  const text = h('p', { class: 'signal__text', 'aria-label': 'Transmission text' });
  const meterLabel = h('span', { class: 'signal__meter-label' });
  const meterFill = h('span', { class: 'signal__meter-fill' });
  const meter = h('div', { class: 'signal__meter', role: 'meter', 'aria-label': 'Signal strength', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, meterFill);

  const dialId = uid('dial');
  const dialValue = h('output', { class: 'signal__dial-value', for: dialId }, '0');
  const dial = h('input', { class: 'signal__dial', id: dialId, type: 'range', min: '0', max: '25', step: '1', value: '0', oninput: () => { attempts[current].shift = Number(dial.value); refresh(); } });
  const dialRow = h('div', { class: 'signal__control' }, h('label', { for: dialId }, 'Frequency offset'), dial, dialValue);

  const mirrorId = uid('mirror');
  const mirror = h('input', { type: 'checkbox', id: mirrorId, onchange: () => { attempts[current].mirror = mirror.checked; refresh(); } });
  const mirrorRow = h('div', { class: 'signal__control signal__control--switch' }, mirror, h('label', { for: mirrorId }, 'Invert phase'));

  const keyId = uid('key');
  const keyInput = h('input', { class: 'signal__key', id: keyId, type: 'text', maxLength: 8, autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', oninput: () => { attempts[current].key = keyInput.value.replace(/[^a-z]/gi, '').toUpperCase(); refresh(); } });
  const keyRow = h('div', { class: 'signal__control' }, h('label', { for: keyId }, 'Keyword'), keyInput);

  const hints = h('ul', { class: 'signal__hints' });
  const hintButton = h('button', { class: 'room-btn', type: 'button', onclick: giveHint }, 'Request a hint');
  const revealButton = h('button', { class: 'room-btn', type: 'button', hidden: true, onclick: revealAnswer }, 'Reveal the answer');
  const status = h('p', { class: 'visually-hidden', role: 'status', 'aria-live': 'polite' });
  const finale = h('p', { class: 'signal__finale', hidden: true });

  const root = h('section', { class: 'room signal', 'aria-label': 'Room 002, Signal Lost' },
    scope,
    h('div', { class: 'signal__panel' },
      h('h1', { class: 'room-title', tabindex: '-1' }, 'Signal Lost'),
      h('p', { class: 'room-help' }, 'Something is transmitting. Tune each signal until the text holds still.'),
      tabs, text,
      h('div', { class: 'signal__meter-row' }, meterLabel, meter),
      dialRow, mirrorRow, keyRow,
      h('div', { class: 'signal__buttons' }, hintButton, revealButton), hints, finale, status));
  container.append(root);

  function renderTabs() {
    TRANSMISSIONS.forEach((t, index) => {
      const open = unlocked(index);
      const button = tabButtons[index];
      button.disabled = !open;
      button.setAttribute('aria-selected', String(index === current));
      button.classList.toggle('is-current', index === current);
      button.classList.toggle('is-solved', solved.has(t.id));
      button.textContent = `${t.label.replace('TRANSMISSION ', 'TX ')}${solved.has(t.id) ? ' ✓' : open ? '' : ' (no signal)'}`;
    });
  }

  function select(index) {
    if (!unlocked(index)) return;
    current = index;
    const t = TRANSMISSIONS[current];
    const a = attempts[current];
    dial.value = String(a.shift);
    mirror.checked = a.mirror;
    keyInput.value = a.key;
    dialRow.hidden = t.method === 'keyword';
    mirrorRow.hidden = t.method !== 'mirror';
    keyRow.hidden = t.method !== 'keyword';
    renderHints();
    renderTabs();
    refresh();
  }

  function renderHints() {
    const t = TRANSMISSIONS[current];
    const level = hintLevel[current];
    hints.replaceChildren(...t.hints.slice(0, level).map((hint) => h('li', {}, hint)));
    hintButton.hidden = solved.has(t.id) || level >= t.hints.length;
    hintButton.textContent = `Request a hint (${level}/${t.hints.length})`;
    revealButton.hidden = solved.has(t.id) || level < t.hints.length;
  }

  function giveHint() {
    const t = TRANSMISSIONS[current];
    hintLevel[current] = Math.min(t.hints.length, hintLevel[current] + 1);
    renderHints();
    status.textContent = `Hint: ${t.hints[hintLevel[current] - 1]}`;
  }

  function revealAnswer() {
    const t = TRANSMISSIONS[current];
    attempts[current] = { shift: t.shift ?? 0, mirror: t.method === 'mirror', key: t.key ?? '' };
    select(current);
  }

  function refresh() {
    const t = TRANSMISSIONS[current];
    const a = attempts[current];
    dialValue.textContent = String(a.shift);
    strength = solved.has(t.id) ? 1 : signalStrength(t, a);
    const percent = Math.round(strength * 100);
    meterFill.style.width = `${percent}%`;
    meter.setAttribute('aria-valuenow', String(percent));
    meterLabel.textContent = `SIGNAL ${String(percent).padStart(3, '0')}%`;
    root.classList.toggle('is-clear', strength === 1);
    const locked = solved.has(t.id);
    dial.disabled = locked;
    mirror.disabled = locked;
    keyInput.disabled = locked;

    if (!solved.has(t.id) && isSolved(t, a)) onSolved(t);
    paintText();
  }

  function paintText() {
    const t = TRANSMISSIONS[current];
    const clear = solved.has(t.id) ? t.plain : decode(t, attempts[current]);
    if (strength >= 1 || reducedMotion()) {
      text.textContent = clear;
      return;
    }
    const noise = (1 - strength) * 0.55;
    text.textContent = [...clear].map((char) => (/[A-Z]/.test(char) && Math.random() < noise ? STATIC[Math.floor(Math.random() * STATIC.length)] : char)).join('');
  }

  function onSolved(t) {
    solved.add(t.id);
    strength = 1;
    ctx.audio.blip(660, 0.7, { gain: 0.07 });
    status.textContent = `Signal locked. The transmission reads: ${t.plain}`;
    if (t.fragment) ctx.store.dispatch({ type: 'fragment/find', id: t.fragment });
    renderHints();
    renderTabs();
    if (solved.size === TRANSMISSIONS.length) {
      ctx.store.dispatch({ type: 'room/complete', id: 'OBS-0002' });
      finale.hidden = false;
      finale.textContent = 'All three transmissions decoded. The signal is not lost. It was never lost. It was waiting to be received.';
    }
  }

  let phase = 0;
  const stop = loop((dt) => {
    phase += dt * (1 + strength * 3);
    const { width, height, ctx: g } = fitCanvas(scope, 1.5);
    g.clearRect(0, 0, width, height);
    const mid = height / 2;
    const jitter = (1 - strength) * height * 0.32;
    const wave = height * (0.06 + strength * 0.22);
    g.lineWidth = 1.5;
    g.strokeStyle = strength >= 1 ? 'rgba(241,241,238,0.95)' : `rgba(255,85,96,${0.4 + strength * 0.4})`;
    g.beginPath();
    for (let x = 0; x <= width; x += 3) {
      const noise = reducedMotion() ? 0 : (Math.random() - 0.5) * jitter;
      g.lineTo(x, mid + Math.sin(x * 0.03 + phase * 4) * wave + noise);
    }
    g.stroke();
    g.strokeStyle = 'rgba(214,214,210,0.08)';
    g.beginPath();
    g.moveTo(0, mid);
    g.lineTo(width, mid);
    g.stroke();

    if (ctx.audio.enabled && !droneHandle) droneHandle = ctx.audio.drone({ freq: 82, gain: 0.03, cutoff: 2400, noiseGain: 0.9, detune: 14 });
    droneHandle?.set({ gain: strength >= 1 ? 0.004 : 0.02 + (1 - strength) * 0.05, cutoff: 800 + strength * 2200 });
  });

  if (!reducedMotion()) flickerTimer = window.setInterval(paintText, 90);

  select(0);
  root.querySelector('.room-title').focus({ preventScroll: true });

  return {
    destroy() {
      stop();
      window.clearInterval(flickerTimer);
      droneHandle?.stop();
    },
  };
}
