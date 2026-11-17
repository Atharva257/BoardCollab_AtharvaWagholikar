import { describe, it, expect, vi, afterEach } from 'vitest';
import { uid } from './ids';

describe('uid', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses crypto.randomUUID when available', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => 'test-uuid-123',
    });

    expect(uid()).toBe('test-uuid-123');
  });

  it('uses the fallback when randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {});

    const result = uid();

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});