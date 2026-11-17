const { validateOps } = require('./operationBuffer');

describe('validateOps', () => {
  const valid = {
    id: 'shape-1', type: 'rect', props: { x: 12, y: 18, w: 120, h: 80 },
    clock: [1, 'client-a'], author: 'client-controlled-author-is-ignored',
  };

  test('accepts valid shape operations and strips client-supplied author', () => {
    const [op] = validateOps([valid]);
    expect(op).toEqual({ ...valid, author: undefined });
  });

  test('rejects batches outside the supported size', () => {
    expect(() => validateOps([])).toThrow(/between 1 and 100/);
    expect(() => validateOps(Array.from({ length: 101 }, () => valid))).toThrow(/between 1 and 100/);
  });

  test('rejects unsupported properties and types', () => {
    expect(() => validateOps([{ ...valid, props: { html: '<script>' } }])).toThrow(/Unsupported/);
    expect(() => validateOps([{ ...valid, type: 'unknown' }])).toThrow(/element type/);
  });

  test('enforces the event type for stroke batches', () => {
    expect(() => validateOps([valid], 'stroke')).toThrow(/element type/);
  });

  test('rejects malformed clocks, unsafe coordinates, and invalid text', () => {
    expect(() => validateOps([{ ...valid, clock: [0, 'client-a'] }])).toThrow(/clock/);
    expect(() => validateOps([{ ...valid, props: { x: Infinity } }])).toThrow(/Invalid x/);
    expect(() => validateOps([{ ...valid, type: 'text', props: { text: 12 } }])).toThrow(/Invalid text/);
  });

  test('accepts bounded stroke point arrays', () => {
    const stroke = { id: 'stroke-1', type: 'stroke', props: { points: [0, 1, 2, 3] }, clock: [2, 'c'] };
    expect(validateOps([stroke], 'stroke')).toHaveLength(1);
    expect(() => validateOps([{ ...stroke, props: { points: [0, NaN] } }], 'stroke')).toThrow(/Invalid stroke points/);
  });
});