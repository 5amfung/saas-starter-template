import { describe, expect, it, vi } from 'vitest';
import { generateSlug } from '../../src/slug';

vi.mock('random-word-slugs', () => ({
  generateSlug: vi.fn(() => 'bold-blue-sparrow'),
}));

describe('generateSlug', () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
});
