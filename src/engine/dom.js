const PROPERTY_KEYS = new Set(['value', 'checked', 'disabled', 'hidden', 'selected']);

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.setAttribute('class', value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (PROPERTY_KEYS.has(key)) el[key] = value;
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  append(el, children);
  return el;
}

export function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

let counter = 0;
export const uid = (prefix = 'id') => `${prefix}-${(counter += 1)}`;

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function loop(fn) {
  let id = 0;
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    fn(dt, now);
    id = requestAnimationFrame(frame);
  };
  id = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(id);
}

export function fitCanvas(canvas, maxDpr = 2) {
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const { width, height } = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(width));
  const h2 = Math.max(1, Math.round(height));
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h2 * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h2 * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width: w, height: h2, dpr, ctx };
}
