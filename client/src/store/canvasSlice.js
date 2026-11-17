import { createSelector, createSlice } from '@reduxjs/toolkit';
import { applyOp, applySnapshot } from '../lib/crdt';
import { uid } from '../lib/ids';
import { transport } from '../lib/transport';

const HISTORY_LIMIT = 200;

const initial = () => ({
  byId: {},
  order: [], // element ids sorted by creation clock (z-order, identical on every replica)
  lamport: 0,
  clientId: uid(),
  undo: [], // local user's actions only: { items: [{ id, type, undo, redo }] }
  redo: [],
});

const canvasSlice = createSlice({
  name: 'canvas',
  initialState: initial,
  reducers: {
    resetCanvas: (state) => ({ ...initial(), clientId: state.clientId }),
    hydrate(state, { payload }) {
      state.byId = payload.byId || {};
      state.order = payload.order || [];
      state.lamport = Math.max(state.lamport, payload.lamport || 0);
    },
    loadSnapshot(state, { payload }) {
      let max = payload.lamport || 0;
      for (const e of payload.elements || []) {
        applySnapshot(state, e);
        if (e.lamport > max) max = e.lamport;
      }
      state.lamport = Math.max(state.lamport, max);
    },
    applyRemote(state, { payload: ops }) {
      for (const op of ops) {
        applyOp(state, op);
        if (op.clock[0] > state.lamport) state.lamport = op.clock[0]; // Lamport receive rule
      }
    },
    localApplied(state, { payload: { ops, entry } }) {
      for (const op of ops) applyOp(state, op);
      if (ops.length) state.lamport = Math.max(state.lamport, ops[ops.length - 1].clock[0]);
      if (entry) {
        state.undo.push(entry);
        if (state.undo.length > HISTORY_LIMIT) state.undo.shift();
        state.redo = [];
      }
    },
    recordHistory(state, { payload: entry }) {
      state.undo.push(entry);
      if (state.undo.length > HISTORY_LIMIT) state.undo.shift();
      state.redo = [];
    },
    shiftHistory(state, { payload: kind }) {
      if (kind === 'undo') {
        const e = state.undo.pop();
        if (e) state.redo.push(e);
      } else {
        const e = state.redo.pop();
        if (e) state.undo.push(e);
      }
    },
  },
});

export const { resetCanvas, hydrate, loadSnapshot, applyRemote, localApplied, recordHistory, shiftHistory } =
  canvasSlice.actions;

/**
 * Apply local changes optimistically and send them to peers.
 * items: [{ id, type, props }]. With record=true the change becomes one entry
 * on this user's undo stack (remote ops are never recorded, so undo/redo is
 * isolated per user by construction).
 */
export const commit = (items, { record = false } = {}) => (dispatch, getState) => {
  const { canvas, auth } = getState();
  let lamport = canvas.lamport;
  const ops = [];
  const entryItems = [];
  for (const it of items) {
    lamport += 1;
    ops.push({ id: it.id, type: it.type, props: it.props, clock: [lamport, canvas.clientId], author: auth.user?.id });
    if (!record) continue;
    const el = canvas.byId[it.id];
    if (!el) {
      entryItems.push({ id: it.id, type: it.type, undo: { deleted: true }, redo: { deleted: false } });
    } else {
      const undo = {};
      for (const k of Object.keys(it.props)) {
        const before = k === 'deleted' ? el.deleted : el.data[k];
        if (before !== undefined) undo[k] = before;
      }
      entryItems.push({ id: it.id, type: it.type, undo, redo: it.props });
    }
  }
  dispatch(localApplied({ ops, entry: record ? { items: entryItems } : null }));
  transport.send(ops);
  return ops;
};

// Undo/redo emit *new* ops with fresh clocks, so they converge like any other edit.
export const undo = () => (dispatch, getState) => {
  const entry = getState().canvas.undo.at(-1);
  if (!entry) return;
  dispatch(shiftHistory('undo'));
  dispatch(commit(entry.items.map((i) => ({ id: i.id, type: i.type, props: i.undo }))));
};

export const redo = () => (dispatch, getState) => {
  const entry = getState().canvas.redo.at(-1);
  if (!entry) return;
  dispatch(shiftHistory('redo'));
  dispatch(commit(entry.items.map((i) => ({ id: i.id, type: i.type, props: i.redo }))));
};

export const deleteElement = (id) => (dispatch, getState) => {
  const el = getState().canvas.byId[id];
  if (el && !el.deleted) dispatch(commit([{ id, type: el.type, props: { deleted: true } }], { record: true }));
};

export const clearAll = () => (dispatch, getState) => {
  const { byId, order } = getState().canvas;
  const items = order.filter((id) => !byId[id].deleted).map((id) => ({ id, type: byId[id].type, props: { deleted: true } }));
  if (items.length) dispatch(commit(items, { record: true }));
};

export const selectVisible = createSelector(
  [(s) => s.canvas.byId, (s) => s.canvas.order],
  (byId, order) => order.map((id) => byId[id]).filter((e) => !e.deleted)
);

export default canvasSlice.reducer;
