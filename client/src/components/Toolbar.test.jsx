import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it, vi } from 'vitest';
import Toolbar from './Toolbar';
import canvas from '../store/canvasSlice';
import ui from '../store/uiSlice';
import auth from '../store/authSlice';
import presence from '../store/presenceSlice';

vi.mock('../lib/transport', () => ({ transport: { send: vi.fn(), cursor: vi.fn() } }));

function renderToolbar() {
  const store = configureStore({ reducer: { canvas, ui, auth, presence } });
  render(<Provider store={store}><Toolbar /></Provider>);
  return store;
}

describe('Toolbar', () => {
  it('changes the active drawing tool', () => {
    const store = renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: 'Rectangle' }));
    expect(store.getState().ui.tool).toBe('rect');
    expect(screen.getByRole('button', { name: 'Rectangle' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps undo and redo disabled when no local history exists', () => {
    renderToolbar();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
  });
});
