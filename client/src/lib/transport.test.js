import { afterEach, describe, it, expect, vi } from 'vitest';
import { transport } from './transport';

let attached;

afterEach(() => {
  if (attached) transport.detach(attached);
  attached = null;
});

describe('transport', () => {
  it('does nothing when no outbox is attached', () => {
    expect(() => transport.send([{ type: 'add' }])).not.toThrow();
    expect(() => transport.cursor(10, 20)).not.toThrow();
  });

  it('forwards operations to the attached outbox', () => {
    const outbox = { push: vi.fn(), cursor: vi.fn() };
    attached = outbox;

    transport.attach(outbox);
    transport.send([{ type: 'add' }]);

    expect(outbox.push).toHaveBeenCalledWith([{ type: 'add' }]);
  });

  it('forwards cursor coordinates to the attached outbox', () => {
    const outbox = { push: vi.fn(), cursor: vi.fn() };
    attached = outbox;

    transport.attach(outbox);
    transport.cursor(100, 200);

    expect(outbox.cursor).toHaveBeenCalledWith(100, 200);
  });

  it('detaches the currently attached outbox', () => {
    const outbox = { push: vi.fn(), cursor: vi.fn() };
    attached = outbox;

    transport.attach(outbox);
    transport.detach(outbox);
    attached = null;
    transport.send([]);

    expect(outbox.push).not.toHaveBeenCalled();
  });

  it('does not detach a different outbox', () => {
    const first = { push: vi.fn(), cursor: vi.fn() };
    const second = { push: vi.fn(), cursor: vi.fn() };
    attached = first;

    transport.attach(first);
    transport.detach(second);
    transport.send([]);

    expect(first.push).toHaveBeenCalledWith([]);
  });
});