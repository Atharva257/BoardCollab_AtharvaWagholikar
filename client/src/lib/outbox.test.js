import { describe, expect, it } from 'vitest';
import { coalesce } from './outbox';

const op = (id, props, l) => ({ id, type: 'stroke', props, clock: [l, 'me'], author: 'u' });

describe('coalesce', () => {
  it('keeps only the newest value per element property', () => {
    const out = coalesce([op('s1', { points: [1] }, 1), op('s1', { points: [1, 2] }, 2), op('s1', { points: [1, 2, 3] }, 3)]);
    expect(out).toHaveLength(1);
    expect(out[0].props.points).toEqual([1, 2, 3]);
    expect(out[0].clock).toEqual([3, 'me']);
  });

  it('does not inflate the clock of properties written earlier', () => {
    const out = coalesce([op('s1', { x: 1 }, 1), op('s1', { y: 2 }, 7)]);
    const byProp = Object.fromEntries(out.flatMap((o) => Object.keys(o.props).map((k) => [k, o.clock[0]])));
    expect(byProp).toEqual({ x: 1, y: 7 });
  });
});
