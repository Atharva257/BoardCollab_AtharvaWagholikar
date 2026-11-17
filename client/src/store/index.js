import { configureStore } from '@reduxjs/toolkit';
import auth from './authSlice';
import canvas from './canvasSlice';
import presence from './presenceSlice';
import ui from './uiSlice';

export const store = configureStore({
  reducer: { auth, canvas, presence, ui },
  // The dev-only invariant checks walk the whole tree on every action, which
  // is prohibitive with thousands of elements. Immer still guarantees immutability.
  middleware: (getDefault) => getDefault({ immutableCheck: false, serializableCheck: false }),
});
