import { describe, expect, it, vi } from 'vitest';
import { generateSlug } from '@/auth/core/slug';

vi.mock('random-word-slugs', () => ({
  generateSlug: vi.fn(() => 'bold-blue-sparrow'),
}));

describe('generateSlug', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.doMock('random-word-slugs', () => ({
      generateSlug: vi.fn(() => 'bold-blue-sparrow'),
    }));
    vi.resetModules();
  });

  it('returns three random-word-slugs words plus a 4-char base36 suffix', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.123456789);

    const slug = generateSlug();

    expect(slug).toMatch(/^[a-z]+-[a-z]+-[a-z]+-[a-z0-9]{4}$/);
  });

  it('returns lowercase output', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.987654321);

    const slug = generateSlug();

    expect(slug).toEqual(slug.toLowerCase());
  });

  it('produces different values across calls', () => {
    const randomSpy = vi.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0.111111111).mockReturnValueOnce(0.222222222);

    const slug1 = generateSlug();
    const slug2 = generateSlug();

    expect(slug1).not.toBe(slug2);
  });

  it('loads the real random-word-slugs helper when unmocked', async () => {
    vi.doUnmock('random-word-slugs');
    vi.resetModules();

    const { generateSlug: realGenerateSlug } = await import('@/auth/core/slug');

    const slug = realGenerateSlug();

    expect(slug).toMatch(/^[a-z]+-[a-z]+-[a-z]+-[a-z0-9]{4}$/);
    expect(slug).not.toBe('bold-blue-sparrow');
  });
});
