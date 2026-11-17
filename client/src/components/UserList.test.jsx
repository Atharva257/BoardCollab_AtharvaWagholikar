import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import UserList from './UserList';

function renderUserList(users, user) {
  const store = configureStore({
    reducer: {
      presence: (state = { users }) => state,
      auth: (state = { user }) => state,
    },
  });

  return render(
    <Provider store={store}>
      <UserList />
    </Provider>
  );
}

describe('UserList', () => {
  it('renders all users when there are fewer than five', () => {
    renderUserList(
      [
        { userId: '1', username: 'Atharva' },
        { userId: '2', username: 'Alex' },
        { userId: '3', username: 'Sam' },
      ],
      { id: '1', username: 'Atharva' }
    );

    expect(screen.getByText('3 online')).toBeInTheDocument();
    expect(screen.getByTitle('Atharva (you)')).toBeInTheDocument();
    expect(screen.getByTitle('Alex')).toBeInTheDocument();
    expect(screen.getByTitle('Sam')).toBeInTheDocument();
  });

  it('shows the current user when the presence list is empty', () => {
    renderUserList([], { id: '1', username: 'Atharva' });

    expect(screen.getByText('1 online')).toBeInTheDocument();
    expect(screen.getByTitle('Atharva (you)')).toBeInTheDocument();
  });

  it('renders an empty list when there are no users', () => {
    renderUserList([], null);

    expect(screen.getByText('0 online')).toBeInTheDocument();
    expect(screen.getByLabelText('0 in this room')).toBeInTheDocument();
  });

  it('shows only five avatars when more than five users are online', () => {
    const users = Array.from({ length: 8 }, (_, i) => ({
      userId: String(i + 1),
      username: `User${i + 1}`,
    }));

    renderUserList(users, { id: '1', username: 'User1' });

    expect(screen.getByText('8 online')).toBeInTheDocument();
    expect(screen.getByText('+3')).toBeInTheDocument();

    for (let i = 1; i <= 5; i++) {
      expect(screen.getByTitle(`User${i}${i === 1 ? ' (you)' : ''}`))
        .toBeInTheDocument();
    }

    expect(screen.queryByTitle('User6')).not.toBeInTheDocument();
  });

  it('uses the first letter of each username as the avatar', () => {
    renderUserList(
      [{ userId: '1', username: 'atharva' }],
      { id: '1', username: 'atharva' }
    );

    expect(screen.getByTitle('atharva (you)')).toHaveTextContent('A');
  });
});