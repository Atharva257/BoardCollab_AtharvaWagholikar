import { createSlice } from '@reduxjs/toolkit';
import { INK_COLORS } from '../lib/palette';

const uiSlice = createSlice({
  name: 'ui',
  initialState: { tool: 'pen', color: INK_COLORS[0], strokeWidth: 4, selectedId: null },
  reducers: {
    setTool(s, { payload }) {
      s.tool = payload;
      if (payload !== 'select') s.selectedId = null;
    },
    setColor(s, { payload }) {
      s.color = payload;
    },
    setStrokeWidth(s, { payload }) {
      s.strokeWidth = payload;
    },
    select(s, { payload }) {
      s.selectedId = payload;
    },
  },
});

export const { setTool, setColor, setStrokeWidth, select } = uiSlice.actions;
export default uiSlice.reducer;
