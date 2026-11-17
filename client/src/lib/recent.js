const KEY = 'bc_recent';

export function getRecent() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function addRecent({ roomId, name }) {
  const list = getRecent().filter((r) => r.roomId !== roomId);
  list.unshift({ roomId, name, ts: Date.now() });
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 8)));
  } catch {
    /* storage full or unavailable: not critical */
  }
}
