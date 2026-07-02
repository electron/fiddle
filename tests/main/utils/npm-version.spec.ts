import { afterEach, describe, expect, it, vi } from 'vitest';

import { getLatestMajorVersion } from '../../../src/main/utils/npm-version';

describe('getLatestMajorVersion', () => {
  afterEach(() => {
    vi.mocked(fetch).mockReset();
  });

  it('returns the latest version matching the major', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        versions: {
          '20.0.0': {},
          '20.5.0': {},
          '20.17.12': {},
          '22.0.0': {},
        },
      }),
    } as unknown as Response);

    const result = await getLatestMajorVersion('@types/node', 20);
    expect(result).toBe('20.17.12');
    expect(fetch).toHaveBeenCalledWith(
      'https://registry.npmjs.org/%40types%2Fnode',
      { headers: { Accept: 'application/vnd.npm.install-v1+json' } },
    );
  });

  it('throws if the registry returns a non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 503,
    } as unknown as Response);

    await expect(getLatestMajorVersion('@types/node', 20)).rejects.toThrow(
      'npm registry returned 503',
    );
  });

  it('throws if no version matches the major', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        versions: {
          '18.0.0': {},
          '22.0.0': {},
        },
      }),
    } as unknown as Response);

    await expect(getLatestMajorVersion('@types/node', 20)).rejects.toThrow(
      'No @types/node version found for major version 20',
    );
  });

  it('throws if fetch rejects', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'));

    await expect(getLatestMajorVersion('@types/node', 20)).rejects.toThrow(
      'network error',
    );
  });
});
