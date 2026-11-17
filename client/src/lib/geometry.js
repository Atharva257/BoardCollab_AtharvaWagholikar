const cache = new WeakMap(); // element objects are immutable (Immer), so identity is a valid cache key

export function getBounds(el) {
  const hit = cache.get(el);
  if (hit) return hit;
  const d = el.data;
  const x = d.x || 0;
  const y = d.y || 0;
  const pad = (d.strokeWidth || 2) / 2;
  let b;
  switch (el.type) {
    case 'stroke': {
      const pts = d.points || [];
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      for (let i = 0; i < pts.length; i += 2) {
        if (pts[i] < x1) x1 = pts[i];
        if (pts[i] > x2) x2 = pts[i];
        if (pts[i + 1] < y1) y1 = pts[i + 1];
        if (pts[i + 1] > y2) y2 = pts[i + 1];
      }
      b = pts.length
        ? { x1: x1 + x - pad, y1: y1 + y - pad, x2: x2 + x + pad, y2: y2 + y + pad }
        : { x1: x, y1: y, x2: x, y2: y };
      break;
    }
    case 'rect':
      b = { x1: x - pad, y1: y - pad, x2: x + (d.w || 0) + pad, y2: y + (d.h || 0) + pad };
      break;
    case 'circle':
      b = { x1: x - (d.rx || 0) - pad, y1: y - (d.ry || 0) - pad, x2: x + (d.rx || 0) + pad, y2: y + (d.ry || 0) + pad };
      break;
    case 'text': {
      const lines = String(d.text || '').split('\n');
      const fs = d.fontSize || 20;
      const w = Math.max(...lines.map((l) => l.length), 1) * fs * 0.6;
      b = { x1: x, y1: y, x2: x + w, y2: y + lines.length * fs * 1.25 };
      break;
    }
    default:
      b = { x1: x, y1: y, x2: x, y2: y };
  }
  cache.set(el, b);
  return b;
}

export const intersects = (b, v) => b.x2 >= v.x1 && b.x1 <= v.x2 && b.y2 >= v.y1 && b.y1 <= v.y2;

export function unionBounds(list) {
  return list.reduce(
    (u, b) => ({ x1: Math.min(u.x1, b.x1), y1: Math.min(u.y1, b.y1), x2: Math.max(u.x2, b.x2), y2: Math.max(u.y2, b.y2) }),
    { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity }
  );
}
