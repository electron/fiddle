import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  GetPackageVersions:
    vi.fn<(name: string) => Promise<{ latest: string; versions: string[] }>>(),
}));

vi.mock('../../../ipc/renderer', () => ({
  modulesApi: { GetPackageVersions: mocks.GetPackageVersions },
}));

import { loadVersions } from './PackagesSection';

const list = (...versions: string[]) => ({ latest: versions[0]!, versions });

beforeEach(() => {
  vi.useFakeTimers();
  mocks.GetPackageVersions.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('loadVersions', () => {
  it('shares one request between rows', async () => {
    mocks.GetPackageVersions.mockResolvedValue(list('1.0.0'));
    const [a, b] = await Promise.all([loadVersions('shared'), loadVersions('shared')]);
    expect(a).toBe(b);
    expect(mocks.GetPackageVersions).toHaveBeenCalledTimes(1);
  });

  it('asks again once main would have refreshed its own list', async () => {
    mocks.GetPackageVersions.mockResolvedValueOnce(list('1.0.0')).mockResolvedValueOnce(
      list('1.1.0', '1.0.0'),
    );
    expect((await loadVersions('aging')).latest).toBe('1.0.0');

    vi.advanceTimersByTime(4 * 60_000);
    expect((await loadVersions('aging')).latest).toBe('1.0.0');

    vi.advanceTimersByTime(2 * 60_000);
    expect((await loadVersions('aging')).latest).toBe('1.1.0');
    expect(mocks.GetPackageVersions).toHaveBeenCalledTimes(2);
  });

  it('retries after a failure', async () => {
    mocks.GetPackageVersions.mockRejectedValueOnce(
      new Error('offline'),
    ).mockResolvedValueOnce(list('2.0.0'));
    await expect(loadVersions('flaky')).rejects.toThrow('offline');
    expect((await loadVersions('flaky')).latest).toBe('2.0.0');
  });
});
