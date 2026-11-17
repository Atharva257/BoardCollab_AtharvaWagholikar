import { useEffect } from 'react';
import { useDispatch, useStore } from 'react-redux';
import { isTyping } from '../lib/dom';
import { deleteElement, redo, undo } from '../store/canvasSlice';
import { select, setTool } from '../store/uiSlice';

const TOOL_KEYS = { v: 'select', p: 'pen', r: 'rect', o: 'circle', t: 'text', h: 'hand' };

export function useShortcuts() {
  const dispatch = useDispatch();
  const store = useStore();

  useEffect(() => {
    const onKey = (e) => {
      if (isTyping(e)) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') {
        e.preventDefault();
        dispatch(e.shiftKey ? redo() : undo());
        return;
      }
      if (mod && k === 'y') {
        e.preventDefault();
        dispatch(redo());
        return;
      }
      if (mod || e.altKey) return;
      if (TOOL_KEYS[k]) {
        dispatch(setTool(TOOL_KEYS[k]));
      } else if (k === 'delete' || k === 'backspace') {
        const id = store.getState().ui.selectedId;
        if (id) {
          e.preventDefault();
          dispatch(deleteElement(id));
          dispatch(select(null));
        }
      } else if (k === 'escape') {
        dispatch(select(null));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch, store]);
}
