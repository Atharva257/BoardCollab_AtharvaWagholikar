import { getBounds, unionBounds } from './geometry';

const FONT = '"Helvetica Neue", Arial, sans-serif';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function shapeToSvg(el) {
  const d = el.data;
  const stroke = d.stroke || '#1d2126';
  const sw = d.strokeWidth || 2;
  const line = `fill="none" stroke="${esc(stroke)}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"`;
  switch (el.type) {
    case 'stroke': {
      const pts = d.points || [];
      const pairs = [];
      for (let i = 0; i < pts.length; i += 2) pairs.push(`${pts[i]},${pts[i + 1]}`);
      return `<polyline transform="translate(${d.x || 0} ${d.y || 0})" points="${pairs.join(' ')}" ${line}/>`;
    }
    case 'rect':
      return `<rect x="${d.x || 0}" y="${d.y || 0}" width="${d.w || 0}" height="${d.h || 0}" ${line}/>`;
    case 'circle':
      return `<ellipse cx="${d.x || 0}" cy="${d.y || 0}" rx="${d.rx || 0}" ry="${d.ry || 0}" ${line}/>`;
    case 'text': {
      const fs = d.fontSize || 20;
      const lines = String(d.text || '').split('\n');
      const tspans = lines
        .map((l, i) => `<tspan x="${d.x || 0}" dy="${i === 0 ? 0 : fs * 1.25}">${esc(l) || ' '}</tspan>`)
        .join('');
      return `<text x="${d.x || 0}" y="${(d.y || 0) + fs * 0.92}" font-size="${fs}" font-family='${FONT}' fill="${esc(d.fill || stroke)}" xml:space="preserve">${tspans}</text>`;
    }
    default:
      return '';
  }
}

export function buildSvg(elements, { padding = 24, background = '#fdfdfb' } = {}) {
  const live = elements.filter((e) => !e.deleted);
  if (!live.length) return null;
  const b = unionBounds(live.map(getBounds));
  const x = Math.floor(b.x1 - padding);
  const y = Math.floor(b.y1 - padding);
  const width = Math.ceil(b.x2 - b.x1 + padding * 2);
  const height = Math.ceil(b.y2 - b.y1 + padding * 2);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}">` +
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${background}"/>` +
    live.map(shapeToSvg).join('') +
    `</svg>`;
  return { svg, width, height };
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportSvg(elements, name = 'board') {
  const out = buildSvg(elements);
  if (!out) return false;
  download(new Blob([out.svg], { type: 'image/svg+xml' }), `${name}.svg`);
  return true;
}

export async function exportPng(elements, name = 'board', scale = 2) {
  const out = buildSvg(elements);
  if (!out) return false;
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(out.svg);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = out.width * scale;
  canvas.height = out.height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, out.width, out.height);
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  download(blob, `${name}.png`);
  return true;
}
