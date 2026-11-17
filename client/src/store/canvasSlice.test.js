import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/transport', () => ({ transport: { send: vi.fn(), cursor: vi.fn() } }));

const { default: canvas, applyRemote, commit, redo, selectVisible, undo } = await import('./canvasSlice');

const makeStore = () => configureStore({ reducer: { canvas, auth: (s = { user: { id: 'me' } }) => s } });
const ids = (store) => selectVisible(store.getState()).map((e) => e.id);
const remoteRect = { id: 'r1', type: 'rect', props: { x: 9, y: 9, w: 2, h: 2 }, clock: [1, 'other'], author: 'other' };

describe('canvas store', () => {
  it('undo/redo only touch the local user\'s actions', () => {
    const store = makeStore();
    store.dispatch(commit([{ id: 'l1', type: 'rect', props: { x: 1, y: 1, w: 5, h: 5 } }], { record: true }));
    store.dispatch(applyRemote([remoteRect]));
    store.dispatch(commit([{ id: 'l1', type: 'rect', props: { x: 20 } }], { record: true }));
    expect(ids(store)).toEqual(['l1', 'r1']);

    store.dispatch(undo());
    expect(store.getState().canvas.byId.l1.data.x).toBe(1);
    store.dispatch(undo());
    expect(ids(store)).toEqual(['r1']); // remote element untouched
    store.dispatch(undo()); // nothing left to undo
    expect(ids(store)).toEqual(['r1']);

    store.dispatch(redo());
    store.dispatch(redo());
    expect(store.getState().canvas.byId.l1.data.x).toBe(20);
    expect(ids(store)).toEqual(['l1', 'r1']);
  });

  it('a new local edit clears the redo stack', () => {
    const store = makeStore();
    store.dispatch(commit([{ id: 'a', type: 'rect', props: { x: 0 } }], { record: true }));
    store.dispatch(undo());
    expect(store.getState().canvas.redo).toHaveLength(1);
    store.dispatch(commit([{ id: 'b', type: 'rect', props: { x: 0 } }], { record: true }));
    expect(store.getState().canvas.redo).toHaveLength(0);
  });

  it('advances the Lamport clock past remote ops so local edits win afterwards', () => {
    const store = makeStore();
    store.dispatch(applyRemote([{ ...remoteRect, props: { x: 100 }, clock: [50, 'other'] }]));
    store.dispatch(commit([{ id: 'r1', type: 'rect', props: { x: 3 } }]));
    expect(store.getState().canvas.byId.r1.data.x).toBe(3);
    expect(store.getState().canvas.lamport).toBeGreaterThan(50);
  });
});
