import { createSlice } from '@reduxjs/toolkit';

const initial = () => ({ users: [], cursors: {}, connection: 'connecting' });

const presenceSlice = createSlice({
  name: 'presence',
  initialState: initial,
  reducers: {
    setConnection(s, { payload }) {
      s.connection = payload;
    },
    setUsers(s, { payload }) {
      s.users = payload;
      const ids = new Set(payload.map((u) => u.userId));
      for (const id of Object.keys(s.cursors)) if (!ids.has(id)) delete s.cursors[id];
    },
    setCursor(s, { payload }) {
      s.cursors[payload.userId] = { x: payload.x, y: payload.y, username: payload.username };
    },
    resetPresence: () => initial(),
  },
});

export const { setConnection, setUsers, setCursor, resetPresence } = presenceSlice.actions;
export default presenceSlice.reducer;
