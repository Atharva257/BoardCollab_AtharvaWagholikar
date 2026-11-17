/**
 * Per-property LWW-register CRDT for canvas elements.
 *
 * - An element is a map of properties; every property carries its own clock
 *   [lamport, clientId]. The higher clock wins; clientId breaks ties, so every
 *   replica converges to the same value regardless of arrival order.
 * - `deleted` is just another LWW property (a tombstone), so a late move can
 *   never resurrect a deleted element, and undo/redo of delete is a normal op.
 * - `created` (min clock seen) fixes z-order so all replicas stack identically.
 * - Applying an op is idempotent (equal clock => ignored), which makes retries
 *   after a dropped ack safe.
 *
 * All functions mutate `state` ({ byId, order }) and are safe to call on an
 * Immer draft or a plain object.
 */

export const compareClock = (a, b) => {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] === b[1]) return 0;
  return a[1] < b[1] ? -1 : 1;
};

const compareIds = (state, a, b) =>
  compareClock(state.byId[a].created, state.byId[b].created) || (a < b ? -1 : a > b ? 1 : 0);

function insertSorted(state, id) {
  let lo = 0;
  let hi = state.order.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (compareIds(state, state.order[mid], id) < 0) lo = mid + 1;
    else hi = mid;
  }
  state.order.splice(lo, 0, id);
}

export function ensureElement(state, id, type, author, clock) {
  const existing = state.byId[id];
  if (!existing) {
    state.byId[id] = { id, type, author, created: clock, data: {}, clocks: {}, deleted: false };
    insertSorted(state, id);
    return state.byId[id];
  }
  if (compareClock(clock, existing.created) < 0) {
    existing.created = clock;
    state.order.splice(state.order.indexOf(id), 1);
    insertSorted(state, id);
  }
  return existing;
}

export function setProp(el, key, value, clock) {
  if (compareClock(clock, el.clocks[key]) <= 0) return false;
  el.clocks[key] = clock;
  if (key === 'deleted') el.deleted = !!value;
  else el.data[key] = value;
  return true;
}

/** op: { id, type, props, clock: [lamport, clientId], author } */
export function applyOp(state, op) {
  const el = ensureElement(state, op.id, op.type, op.author, op.clock);
  let changed = false;
  for (const [key, value] of Object.entries(op.props)) {
    changed = setProp(el, key, value, op.clock) || changed;
  }
  return changed;
}

/** Server element: { elementId, type, data, lamport, clientId, deleted, clocks?, created? } */
export function applySnapshot(state, e) {
  const base = [e.lamport ?? 0, e.clientId ?? ''];
  const el = ensureElement(state, e.elementId ?? e.id, e.type, e.author, e.created ?? base);
  const props = { ...(e.data || {}), deleted: !!e.deleted };
  for (const [key, value] of Object.entries(props)) {
    setProp(el, key, value, e.clocks?.[key] ?? base);
  }
}
