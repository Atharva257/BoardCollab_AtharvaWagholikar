import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Protected from './Protected';

function renderProtected(token, initialPath = '/board') {
  const store = configureStore({
    reducer: {
      auth: (state = { token }) => state,
    },
  });

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route
            path="/board"
            element={
              <Protected>
                <h1>Board content</h1>
              </Protected>
            }
          />
          <Route path="/login" element={<h1>Login page</h1>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

describe('Protected', () => {
  it('renders children when a token exists', () => {
    renderProtected('valid-token');

    expect(screen.getByRole('heading', { name: 'Board content' }))
      .toBeInTheDocument();
  });

  it('redirects to login when no token exists', () => {
    renderProtected(null);

    expect(screen.getByRole('heading', { name: 'Login page' }))
      .toBeInTheDocument();
  });

  it('redirects to login when the token is empty', () => {
    renderProtected('');

    expect(screen.getByRole('heading', { name: 'Login page' }))
      .toBeInTheDocument();
  });
});