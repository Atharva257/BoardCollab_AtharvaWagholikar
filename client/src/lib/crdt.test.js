import { describe, expect, it } from 'vitest';
import { applyOp } from './crdt';

const fresh = () => ({ byId: {}, order: [] });
const op = (id, props, l, c = 'a', type = 'rect') => ({ id, type, props, clock: [l, c], author: c });
// Compare semantic state: object key insertion order is not part of the state.
const sortKeys = (v) => {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  return v;
};
const snapshot = (s) => JSON.stringify(sortKeys(s.order.map((id) => [id, s.byId[id].data, s.byId[id].deleted])));

function permutations(arr) {
  if (arr.length <= 1) return [arr];
  return arr.flatMap((x, i) => permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [x, ...p]));
}

describe('LWW CRDT', () => {
  const ops = [
    op('r1', { x: 0, y: 0, w: 10, h: 10 }, 1, 'a'),
    op('r1', { x: 10, y: 10 }, 2, 'a'), // A drags the square
    op('r1', { x: 50, y: 40 }, 2, 'b'), // B drags the same square concurrently
    op('r1', { stroke: '#9b2f2f' }, 3, 'b'),
    op('r2', { x: 5, y: 5, w: 1, h: 1 }, 2, 'c'),
    op('r1', { deleted: true }, 4, 'a'),
  ];

  it('converges to the same state for every delivery order', () => {
    const results = new Set(
      permutations(ops).map((p) => {
        const s = fresh();
        p.forEach((o) => applyOp(s, o));
        return snapshot(s);
      })
    );
    expect(results.size).toBe(1);
  });

  it('breaks concurrent-edit ties by clientId, not arrival order', () => {
    const s = fresh();
    applyOp(s, op('r1', { x: 0 }, 1, 'a'));
    applyOp(s, op('r1', { x: 10 }, 2, 'a'));
    applyOp(s, op('r1', { x: 50 }, 2, 'b'));
    expect(s.byId.r1.data.x).toBe(50);
  });

  it('merges different properties instead of overwriting the whole element', () => {
    const s = fresh();
    applyOp(s, op('r1', { x: 0, stroke: '#000' }, 1));
    applyOp(s, op('r1', { x: 99 }, 5, 'a')); // A moves
    applyOp(s, op('r1', { stroke: '#9b2f2f' }, 4, 'b')); // B recolours, older clock
    expect(s.byId.r1.data).toMatchObject({ x: 99, stroke: '#9b2f2f' });
  });

  it('is idempotent, so retried ops are harmless', () => {
    const s = fresh();
    const o = op('r1', { x: 1 }, 1);
    expect(applyOp(s, o)).toBe(true);
    expect(applyOp(s, o)).toBe(false);
  });

  it('does not let a late move resurrect a deleted element', () => {
    const s = fresh();
    applyOp(s, op('r1', { x: 0 }, 1));
    applyOp(s, op('r1', { deleted: true }, 5));
    applyOp(s, op('r1', { x: 20 }, 3, 'b'));
    expect(s.byId.r1.deleted).toBe(true);
  });

  it('keeps z-order identical even if a later op for an element arrives first', () => {
    const a = fresh();
    const b = fresh();
    const create1 = op('e1', { x: 0 }, 1, 'a');
    const create2 = op('e2', { x: 0 }, 2, 'b');
    const move1 = op('e1', { x: 5 }, 9, 'a');
    [move1, create2, create1].forEach((o) => applyOp(a, o));
    [create1, create2, move1].forEach((o) => applyOp(b, o));
    expect(a.order).toEqual(['e1', 'e2']);
    expect(b.order).toEqual(['e1', 'e2']);
  });
});
