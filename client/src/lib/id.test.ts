import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClientId } from './id';

describe('createClientId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses crypto.randomUUID when available', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => '11111111-2222-4333-8444-555555555555',
    });

    expect(createClientId()).toBe('11111111-2222-4333-8444-555555555555');
  });

  it('falls back without throwing when crypto.randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {});

    const first = createClientId();
    const second = createClientId();

    expect(first).toMatch(/^tmp-/);
    expect(second).toMatch(/^tmp-/);
    expect(first).not.toBe(second);
  });
});
