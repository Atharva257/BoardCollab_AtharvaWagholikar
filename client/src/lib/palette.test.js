import { describe, it, expect } from 'vitest';
import { INK_COLORS, colorForUser } from './palette';

describe('palette', () => {
  it('provides six ink colors', () => {
    expect(INK_COLORS).toHaveLength(6);
    expect(INK_COLORS).toContain('#1d2126');
  });

  it('returns a valid hexadecimal color for a user', () => {
    expect(colorForUser('user-1')).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('returns the same color for the same user ID', () => {
    expect(colorForUser('atharva')).toBe(colorForUser('atharva'));
  });

  it('returns a color for an empty or missing user ID', () => {
    expect(colorForUser()).toBe(colorForUser(''));
    expect(colorForUser()).toMatch(/^#[0-9a-f]{6}$/i);
  });
});