import { describe, it, expect } from 'vitest';
import { getBounds, intersects, unionBounds } from './geometry';

describe('getBounds', () => {
  it('calculates rectangle bounds including stroke padding', () => {
    expect(
      getBounds({
        type: 'rect',
        data: { x: 10, y: 20, w: 100, h: 50, strokeWidth: 4 },
      })
    ).toEqual({ x1: 8, y1: 18, x2: 112, y2: 72 });
  });

  it('calculates circle bounds', () => {
    expect(
      getBounds({
        type: 'circle',
        data: { x: 50, y: 60, rx: 20, ry: 10, strokeWidth: 2 },
      })
    ).toEqual({ x1: 29, y1: 49, x2: 71, y2: 71 });
  });

  it('calculates stroke bounds using points and position', () => {
    expect(
      getBounds({
        type: 'stroke',
        data: { x: 10, y: 5, points: [0, 10, 30, 40, 20, 0], strokeWidth: 2 },
      })
    ).toEqual({ x1: 9, y1: 4, x2: 41, y2: 46 });
  });

  it('handles an empty stroke', () => {
    expect(
      getBounds({ type: 'stroke', data: { x: 5, y: 8, points: [] } })
    ).toEqual({ x1: 5, y1: 8, x2: 5, y2: 8 });
  });

  it('calculates text bounds for multiple lines', () => {
    expect(
      getBounds({
        type: 'text',
        data: { x: 10, y: 20, text: 'Hello\nWorld', fontSize: 10 },
      })
    ).toEqual({ x1: 10, y1: 20, x2: 40, y2: 45 });
  });

  it('uses default values for missing data', () => {
    expect(getBounds({ type: 'rect', data: {} })).toEqual({
      x1: -1,
      y1: -1,
      x2: 1,
      y2: 1,
    });
  });

  it('returns point bounds for an unknown element type', () => {
    expect(getBounds({ type: 'unknown', data: { x: 7, y: 9 } })).toEqual({
      x1: 7,
      y1: 9,
      x2: 7,
      y2: 9,
    });
  });

  it('returns the cached bounds for the same element object', () => {
    const element = {
      type: 'rect',
      data: { x: 1, y: 2, w: 10, h: 20 },
    };

    const first = getBounds(element);
    const second = getBounds(element);

    expect(second).toBe(first);
  });
});

describe('intersects', () => {
  const bounds = { x1: 0, y1: 0, x2: 10, y2: 10 };

  it('returns true for overlapping rectangles', () => {
    expect(intersects(bounds, { x1: 5, y1: 5, x2: 15, y2: 15 })).toBe(true);
  });

  it('returns true when rectangles touch at an edge', () => {
    expect(intersects(bounds, { x1: 10, y1: 2, x2: 20, y2: 8 })).toBe(true);
  });

  it('returns false when rectangles do not overlap', () => {
    expect(intersects(bounds, { x1: 11, y1: 11, x2: 20, y2: 20 })).toBe(false);
  });
});

describe('unionBounds', () => {
  it('combines multiple bounding boxes', () => {
    expect(
      unionBounds([
        { x1: 1, y1: 2, x2: 5, y2: 6 },
        { x1: -2, y1: 3, x2: 8, y2: 10 },
      ])
    ).toEqual({ x1: -2, y1: 2, x2: 8, y2: 10 });
  });

  it('returns infinite defaults for an empty list', () => {
    expect(unionBounds([])).toEqual({
      x1: Infinity,
      y1: Infinity,
      x2: -Infinity,
      y2: -Infinity,
    });
  });
});