import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../api/client';

const KEY = 'bc_auth';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export const authenticate = createAsyncThunk('auth/authenticate', async ({ mode, ...body }, { rejectWithValue }) => {
  try {
    return await api(`/api/auth/${mode}`, { method: 'POST', body });
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

const saved = load();

const authSlice = createSlice({
  name: 'auth',
  initialState: { token: saved.token || null, user: saved.user || null, status: 'idle', error: null },
  reducers: {
    logout(state) {
      state.token = null;
      state.user = null;
      localStorage.removeItem(KEY);
    },
    clearAuthError(state) {
      state.error = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(authenticate.pending, (s) => {
      s.status = 'loading';
      s.error = null;
    });
    b.addCase(authenticate.fulfilled, (s, { payload }) => {
      s.status = 'idle';
      s.token = payload.token;
      s.user = payload.user;
      localStorage.setItem(KEY, JSON.stringify({ token: payload.token, user: payload.user }));
    });
    b.addCase(authenticate.rejected, (s, { payload }) => {
      s.status = 'idle';
      s.error = payload || 'Request failed';
    });
  },
});

export const { logout, clearAuthError } = authSlice.actions;
export default authSlice.reducer;
