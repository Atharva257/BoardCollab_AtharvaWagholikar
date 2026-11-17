import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { buildSvg, exportSvg, exportPng } from './export';

describe('buildSvg', () => {
  it('returns null when there are no elements', () => {
    expect(buildSvg([])).toBeNull();
  });

  it('returns null when all elements are deleted', () => {
    expect(
      buildSvg([{ type: 'rect', deleted: true, data: { x: 1, y: 2 } }])
    ).toBeNull();
  });

  it('exports rectangles into SVG', () => {
    const result = buildSvg([
      {
        type: 'rect',
        data: { x: 10, y: 20, w: 100, h: 50, stroke: '#123456' },
      },
    ]);

    expect(result.svg).toContain('<svg');
    expect(result.svg).toContain('<rect x="10" y="20" width="100" height="50"');
    expect(result.svg).toContain('stroke="#123456"');
    expect(result.width).toBeGreaterThan(100);
    expect(result.height).toBeGreaterThan(50);
  });

  it('exports circles as ellipses', () => {
    const result = buildSvg([
      { type: 'circle', data: { x: 30, y: 40, rx: 15, ry: 20 } },
    ]);

    expect(result.svg).toContain('<ellipse cx="30" cy="40" rx="15" ry="20"');
  });

  it('exports freehand strokes as polylines', () => {
    const result = buildSvg([
      { type: 'stroke', data: { x: 5, y: 10, points: [0, 0, 20, 30] } },
    ]);

    expect(result.svg).toContain('<polyline');
    expect(result.svg).toContain('points="0,0 20,30"');
    expect(result.svg).toContain('translate(5 10)');
  });

  it('exports multiline text and escapes XML characters', () => {
    const result = buildSvg([
      {
        type: 'text',
        data: {
          x: 10,
          y: 20,
          text: 'A < B & "C"\nSecond line',
          fontSize: 16,
          fill: '#333',
        },
      },
    ]);

    expect(result.svg).toContain('&lt;');
    expect(result.svg).toContain('&amp;');
    expect(result.svg).toContain('&quot;');
    expect(result.svg).toContain('Second line');
    expect(result.svg).toContain('<tspan');
  });

  it('omits deleted elements and supports custom options', () => {
    const result = buildSvg(
      [
        { type: 'rect', deleted: true, data: { x: 0, y: 0, w: 10, h: 10 } },
        { type: 'rect', data: { x: 10, y: 10, w: 10, h: 10 } },
      ],
      { padding: 5, background: '#ffffff' }
    );

    expect(result.svg).toContain('fill="#ffffff"');
    expect(result.svg).toContain('<rect x="10"');
    expect(result.svg).not.toContain('<rect x="0"');
  });

  it('ignores unsupported element types', () => {
    const result = buildSvg([
      { type: 'unknown', data: { x: 10, y: 10 } },
    ]);

    expect(result.svg).toContain('<svg');
  });
});

describe('exportSvg', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:test-url'),
      revokeObjectURL: vi.fn(),
    });

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns false when there is nothing to export', () => {
    expect(exportSvg([])).toBe(false);
  });

  it('downloads an SVG file with the requested name', () => {
    expect(
      exportSvg(
        [{ type: 'rect', data: { x: 1, y: 2, w: 30, h: 40 } }],
        'test-board'
      )
    ).toBe(true);

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });
});

describe('exportPng', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns false when there is nothing to export', async () => {
    expect(await exportPng([])).toBe(false);
  });

  it('creates and downloads a PNG image', async () => {
    class MockImage {
      async decode() {}

      set src(value) {
        this.source = value;
      }
    }

    const drawImage = vi.fn();
    const scale = vi.fn();

    vi.stubGlobal('Image', MockImage);

    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:png-url'),
      revokeObjectURL: vi.fn(),
    });

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      scale,
      drawImage,
    });

    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob(['png-data'], { type: 'image/png' }));
    });

    const result = await exportPng(
      [{ type: 'rect', data: { x: 1, y: 2, w: 30, h: 40 } }],
      'test-board',
      2
    );

    expect(result).toBe(true);
    expect(scale).toHaveBeenCalledWith(2, 2);
    expect(drawImage).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });
});