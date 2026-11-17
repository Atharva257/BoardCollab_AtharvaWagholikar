import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ConnectionBadge from './ConnectionBadge';

function renderBadge(connection) {
  const store = configureStore({
    reducer: {
      presence: (state = { connection }) => state,
    },
  });

  return render(
    <Provider store={store}>
      <ConnectionBadge />
    </Provider>
  );
}

describe('ConnectionBadge', () => {
  it.each([
    ['online', 'Connected'],
    ['connecting', 'Connecting'],
    ['degraded', 'Unstable connection'],
    ['offline', 'Offline, changes kept locally'],
  ])('displays %s status', (status, label) => {
    renderBadge(status);
    expect(screen.getByRole('status')).toHaveTextContent(label);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});