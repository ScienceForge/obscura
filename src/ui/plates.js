import { createRng, hashString } from '../core/prng.js';

/**
 * "Plates": small generated images that stand in for each entry in the
 * archive, so the index does not need any image files. Each is drawn once
 * from a seeded generator, so it looks the same every visit.
 */
export function drawPlate(canvas, entryId, { sealed = false } = {}) {
  const g = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const rng = createRng(hashString(entryId));
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#060607';
  g.fillRect(0, 0, w, h);

  if (sealed) return drawSealed(g, w, h, rng);

  switch (entryId) {
    case 'OBS-0001': return drawLight(g, w, h, rng);
    case 'OBS-0002': return drawSignal(g, w, h, rng);
    case 'OBS-0003': return drawHallway(g, w, h);
    case 'OBS-0004': return drawStars(g, w, h, rng);
    case 'OBS-0013': return drawQuiet(g, w, h);
    case 'OBS-0000': return drawOrigin(g, w, h);
    default: return drawSealed(g, w, h, rng);
  }
}

function drawLight(g, w, h, rng) {
  const x = w * (0.35 + rng() * 0.3);
  const y = h * (0.35 + rng() * 0.3);
  const glow = g.createRadialGradient(x, y, 2, x, y, h * 0.7);
  glow.addColorStop(0, 'rgba(255,244,214,0.95)');
  glow.addColorStop(0.18, 'rgba(255,236,190,0.35)');
  glow.addColorStop(1, 'rgba(255,236,190,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,0.9)';
  for (let i = 0; i < 5; i += 1) g.fillRect(rng() * w, rng() * h, 18 + rng() * 40, 1);
}

function drawSignal(g, w, h, rng) {
  g.lineWidth = 1;
  for (let row = 0; row < 7; row += 1) {
    const y = (h / 8) * (row + 1);
    g.strokeStyle = `rgba(210,40,50,${0.18 + rng() * 0.45})`;
    g.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const noise = (rng() - 0.5) * (row % 2 ? 14 : 5);
      const wave = Math.sin(x / (9 + row * 3) + row) * (row === 3 ? 12 : 3);
      g.lineTo(x, y + wave + noise);
    }
    g.stroke();
  }
}

function drawHallway(g, w, h) {
  g.strokeStyle = 'rgba(200,200,205,0.55)';
  g.lineWidth = 1;
  for (let i = 0; i < 9; i += 1) {
    const s = 0.94 ** (i * 2.4);
    const rw = w * 0.86 * s;
    const rh = h * 0.86 * s;
    g.globalAlpha = 0.9 - i * 0.09;
    g.strokeRect((w - rw) / 2, (h - rh) / 2, rw, rh);
  }
  g.globalAlpha = 1;
}

function drawStars(g, w, h, rng) {
  const points = [];
  for (let i = 0; i < 46; i += 1) {
    const x = rng() * w;
    const y = rng() * h;
    points.push([x, y]);
    g.fillStyle = `rgba(190,210,255,${0.25 + rng() * 0.6})`;
    g.fillRect(x, y, rng() > 0.9 ? 2 : 1, rng() > 0.9 ? 2 : 1);
  }
  g.strokeStyle = 'rgba(91,140,255,0.4)';
  g.beginPath();
  for (const index of [4, 11, 19, 27, 33]) g.lineTo(...points[index]);
  g.stroke();
}

function drawQuiet(g, w, h) {
  g.fillStyle = '#c8202a';
  g.shadowColor = '#c8202a';
  g.shadowBlur = 14;
  g.fillRect(w / 2 - 1.5, h / 2 - 1.5, 3, 3);
  g.shadowBlur = 0;
}

function drawOrigin(g, w, h) {
  g.strokeStyle = 'rgba(220,220,225,0.5)';
  g.lineWidth = 1;
  for (let i = 1; i <= 5; i += 1) {
    g.beginPath();
    g.arc(w / 2, h / 2, i * 14, 0.4 * i, Math.PI * 2 - 0.3 * i);
    g.stroke();
  }
}

function drawSealed(g, w, h, rng) {
  for (let y = 10; y < h; y += 9) {
    g.fillStyle = `rgba(120,120,126,${0.06 + rng() * 0.12})`;
    g.fillRect(10 + rng() * 30, y, w * (0.3 + rng() * 0.6), 3);
  }
}
