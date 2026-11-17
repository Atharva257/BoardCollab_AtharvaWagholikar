// const { validateOps } = require('./operationBuffer');

// describe('validateOps', () => {
//   const valid = {
//     id: 'shape-1', type: 'rect', props: { x: 12, y: 18, w: 120, h: 80 },
//     clock: [1, 'client-a'], author: 'client-controlled-author-is-ignored',
//   };

//   test('accepts valid shape operations and strips client-supplied author', () => {
//     const [op] = validateOps([valid]);
//     expect(op).toEqual({ ...valid, author: undefined });
//   });

//   test('rejects batches outside the supported size', () => {
//     expect(() => validateOps([])).toThrow(/between 1 and 100/);
//     expect(() => validateOps(Array.from({ length: 101 }, () => valid))).toThrow(/between 1 and 100/);
//   });

//   test('rejects unsupported properties and types', () => {
//     expect(() => validateOps([{ ...valid, props: { html: '<script>' } }])).toThrow(/Unsupported/);
//     expect(() => validateOps([{ ...valid, type: 'unknown' }])).toThrow(/element type/);
//   });

//   test('enforces the event type for stroke batches', () => {
//     expect(() => validateOps([valid], 'stroke')).toThrow(/element type/);
//   });

//   test('rejects malformed clocks, unsafe coordinates, and invalid text', () => {
//     expect(() => validateOps([{ ...valid, clock: [0, 'client-a'] }])).toThrow(/clock/);
//     expect(() => validateOps([{ ...valid, props: { x: Infinity } }])).toThrow(/Invalid x/);
//     expect(() => validateOps([{ ...valid, type: 'text', props: { text: 12 } }])).toThrow(/Invalid text/);
//   });

//   test('accepts bounded stroke point arrays', () => {
//     const stroke = { id: 'stroke-1', type: 'stroke', props: { points: [0, 1, 2, 3] }, clock: [2, 'c'] };
//     expect(validateOps([stroke], 'stroke')).toHaveLength(1);
//     expect(() => validateOps([{ ...stroke, props: { points: [0, NaN] } }], 'stroke')).toThrow(/Invalid stroke points/);
//   });
// });


jest.mock('../models/Session', () => ({
  updateOne: jest.fn(),
}));

jest.mock('../models/Element', () => ({
  bulkWrite: jest.fn(),
}));

const Session = require('../models/Session');
const Element = require('../models/Element');
const {
  validateOps,
  OperationBuffer,
} = require('./operationBuffer');

describe('validateOps', () => {
  const valid = {
    id: 'shape-1',
    type: 'rect',
    props: { x: 12, y: 18, w: 120, h: 80 },
    clock: [1, 'client-a'],
    author: 'client-controlled-author-is-ignored',
  };

  test('accepts valid shape operations and strips client-supplied author', () => {
    const [op] = validateOps([valid]);
    expect(op).toEqual({ ...valid, author: undefined });
  });

  test('rejects batches outside the supported size', () => {
    expect(() => validateOps([])).toThrow(/between 1 and 100/);
    expect(() =>
      validateOps(Array.from({ length: 101 }, () => valid))
    ).toThrow(/between 1 and 100/);
  });

  test('rejects unsupported properties and types', () => {
    expect(() =>
      validateOps([{ ...valid, props: { html: '<script>' } }])
    ).toThrow(/Unsupported/);

    expect(() =>
      validateOps([{ ...valid, type: 'unknown' }])
    ).toThrow(/element type/);
  });

  test('enforces the event type for stroke batches', () => {
    expect(() => validateOps([valid], 'stroke')).toThrow(/element type/);
  });

  test('rejects malformed clocks, unsafe coordinates, and invalid text', () => {
    expect(() =>
      validateOps([{ ...valid, clock: [0, 'client-a'] }])
    ).toThrow(/clock/);

    expect(() =>
      validateOps([{ ...valid, props: { x: Infinity } }])
    ).toThrow(/Invalid x/);

    expect(() =>
      validateOps([
        { ...valid, type: 'text', props: { text: 12 } },
      ])
    ).toThrow(/Invalid text/);
  });

  test('accepts bounded stroke point arrays', () => {
    const stroke = {
      id: 'stroke-1',
      type: 'stroke',
      props: { points: [0, 1, 2, 3] },
      clock: [2, 'c'],
    };

    expect(validateOps([stroke], 'stroke')).toHaveLength(1);

    expect(() =>
      validateOps([
        { ...stroke, props: { points: [0, NaN] } },
      ], 'stroke')
    ).toThrow(/Invalid stroke points/);
  });
});

describe('OperationBuffer', () => {
  const operation = {
    id: 'shape-1',
    type: 'rect',
    props: { x: 10, y: 20, w: 100, h: 80 },
    clock: [5, 'client-a'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Element.bulkWrite.mockResolvedValue({});
    Session.updateOne.mockResolvedValue({});
  });

  test('queues operations and persists them using bulkWrite', async () => {
    const buffer = new OperationBuffer({ intervalMs: 60000 });

    expect(
      buffer.enqueue('room-1', [operation], 'user-1')
    ).toBe(true);

    expect(buffer.queue).toHaveLength(1);

    await buffer.flush();

    expect(Element.bulkWrite).toHaveBeenCalledTimes(1);
    expect(Element.bulkWrite).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          updateOne: expect.objectContaining({
            filter: {
              roomId: 'room-1',
              elementId: 'shape-1',
            },
            upsert: true,
          }),
        }),
      ]),
      { ordered: true }
    );

    expect(Session.updateOne).toHaveBeenCalledWith(
      { roomId: 'room-1' },
      expect.objectContaining({
        $max: { lamport: 5 },
      })
    );

    expect(buffer.queue).toHaveLength(0);

    await buffer.close();
  });

  test('updates the maximum Lamport clock for each room', async () => {
    const buffer = new OperationBuffer({ intervalMs: 60000 });

    const secondOperation = {
      ...operation,
      id: 'shape-2',
      clock: [9, 'client-b'],
    };

    buffer.enqueue(
      'room-1',
      [operation, secondOperation],
      'user-1'
    );

    await buffer.flush();

    expect(Session.updateOne).toHaveBeenCalledWith(
      { roomId: 'room-1' },
      expect.objectContaining({
        $max: { lamport: 9 },
      })
    );

    await buffer.close();
  });

  test('rejects operations when the pending queue limit is exceeded', async () => {
    const buffer = new OperationBuffer({
      intervalMs: 60000,
      maxPending: 1,
    });

    expect(
      buffer.enqueue('room-1', [operation], 'user-1')
    ).toBe(true);

    expect(
      buffer.enqueue('room-1', [operation], 'user-1')
    ).toBe(false);

    expect(buffer.queue).toHaveLength(1);

    await buffer.close();
  });

  test('requeues operations when MongoDB persistence fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    Element.bulkWrite
      .mockRejectedValueOnce(new Error('Temporary database failure'))
      .mockResolvedValueOnce({});

    const buffer = new OperationBuffer({ intervalMs: 60000 });

    buffer.enqueue('room-1', [operation], 'user-1');

    await buffer.flush();

    expect(buffer.queue).toHaveLength(1);

    // Cancel the retry timer so the retry is controlled by this test.
    clearTimeout(buffer.timer);
    buffer.timer = null;

    await buffer.flush();

    expect(Element.bulkWrite).toHaveBeenCalledTimes(2);
    expect(buffer.queue).toHaveLength(0);

    await buffer.close();
    errorSpy.mockRestore();
  });

  test('flushes pending operations when the buffer closes', async () => {
    const buffer = new OperationBuffer({ intervalMs: 60000 });

    buffer.enqueue('room-1', [operation], 'user-1');

    await buffer.close();

    expect(Element.bulkWrite).toHaveBeenCalledTimes(1);
    expect(buffer.queue).toHaveLength(0);
    expect(buffer.closed).toBe(true);
  });
});