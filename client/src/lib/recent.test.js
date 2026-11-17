import { beforeEach, describe, it, expect, vi } from 'vitest';
import { getRecent, addRecent } from './recent';

describe('recent rooms', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns an empty array when no recent rooms exist', () => {
    expect(getRecent()).toEqual([]);
  });

  it('adds a room to recent history', () => {
    addRecent({ roomId: 'room-1', name: 'My Room' });

    const rooms = getRecent();

    expect(rooms).toHaveLength(1);
    expect(rooms[0].roomId).toBe('room-1');
    expect(rooms[0].name).toBe('My Room');
    expect(rooms[0].ts).toEqual(expect.any(Number));
  });

  it('moves an existing room to the beginning instead of duplicating it', () => {
    addRecent({ roomId: 'room-1', name: 'Old Name' });
    addRecent({ roomId: 'room-2', name: 'Second Room' });
    addRecent({ roomId: 'room-1', name: 'Updated Name' });

    const rooms = getRecent();

    expect(rooms).toHaveLength(2);
    expect(rooms[0].roomId).toBe('room-1');
    expect(rooms[0].name).toBe('Updated Name');
  });

  it('keeps at most eight recent rooms', () => {
    for (let i = 1; i <= 10; i++) {
      addRecent({ roomId: `room-${i}`, name: `Room ${i}` });
    }

    expect(getRecent()).toHaveLength(8);
    expect(getRecent()[0].roomId).toBe('room-10');
  });

  it('returns an empty array when stored JSON is invalid', () => {
    localStorage.setItem('bc_recent', '{invalid json');

    expect(getRecent()).toEqual([]);
  });

  it('does not throw when local storage cannot be written', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });

    expect(() =>
      addRecent({ roomId: 'room-1', name: 'My Room' })
    ).not.toThrow();
  });
});