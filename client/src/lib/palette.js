// Muted, print-friendly inks. Deliberately no saturated hues.
export const INK_COLORS = ['#1d2126', '#5d646c', '#9b2f2f', '#2f6b4f', '#1f4e79', '#a07a1c'];

const USER_COLORS = ['#1f4e79', '#9b2f2f', '#2f6b4f', '#8a6416', '#4b5563', '#7a3b2e', '#2d6a73', '#5c6b2f'];

export function colorForUser(id = '') {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return USER_COLORS[h % USER_COLORS.length];
}
