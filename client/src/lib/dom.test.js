import { describe, it, expect } from 'vitest';
import { isTyping } from './dom';

describe('isTyping', () => {
  it('returns false when the event target is missing', () => {
    expect(isTyping({ target: null })).toBe(false);
    expect(isTyping({})).toBe(false);
  });

  it.each(['INPUT', 'TEXTAREA', 'SELECT'])(
    'returns true for %s elements',
    (tagName) => {
      expect(isTyping({ target: { tagName } })).toBe(true);
    }
  );

  it('returns true for content-editable elements', () => {
    expect(isTyping({ target: { tagName: 'DIV', isContentEditable: true } })).toBe(true);
  });

  it('returns false for ordinary elements', () => {
    expect(isTyping({ target: { tagName: 'DIV', isContentEditable: false } })).toBe(false);
  });
});