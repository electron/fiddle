import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  importOldApp: vi.fn(),
  importElectronVersions: vi.fn(),
  testMode: false,
}));

vi.mock('electron', () => ({
  app: { getPath: () => '/user-data', getVersion: () => '1.0.0' },
  safeStorage: {},
}));
vi.mock('../log', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../test-mode', () => ({
  isTestMode: () => mocks.testMode,
  getCacheRoot: () => '/cache',
}));
vi.mock('./import', () => ({
  importOldApp: mocks.importOldApp,
  importElectronVersions: mocks.importElectronVersions,
}));
vi.mock('./local-storage', () => ({ readOldLocalStorage: vi.fn() }));

import { runMigration } from './index';

beforeEach(() => {
  mocks.testMode = false;
  mocks.importOldApp.mockReset();
  mocks.importElectronVersions.mockReset().mockResolvedValue([]);
});

describe('runMigration', () => {
  it('skips the import in test mode', async () => {
    mocks.testMode = true;
    expect(await runMigration()).toEqual({ firstLaunch: false, summary: {} });
    expect(mocks.importOldApp).not.toHaveBeenCalled();
  });

  it('reports no first launch when the import fails, so it runs again next time', async () => {
    mocks.importOldApp.mockRejectedValue(new Error('unreadable'));
    expect(await runMigration()).toEqual({ firstLaunch: false, summary: {} });
  });
});
