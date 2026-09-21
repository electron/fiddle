import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  importOldApp: vi.fn(),
  importElectronVersions: vi.fn(),
  cacheRoot: vi.fn(() => '/cache'),
  userData: '/user-data',
  testMode: false,
}));

vi.mock('electron', () => ({
  app: { getPath: () => mocks.userData, getVersion: () => '1.0.0' },
  safeStorage: {},
}));
vi.mock('../log', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../test-mode', () => ({
  isTestMode: () => mocks.testMode,
  getCacheRoot: mocks.cacheRoot,
}));
vi.mock('./import', () => ({
  importOldApp: mocks.importOldApp,
  importElectronVersions: mocks.importElectronVersions,
}));
vi.mock('./local-storage', () => ({ readOldLocalStorage: vi.fn() }));

import { log } from '../log';
import { importElectronVersionsInBackground, runMigration } from './index';

beforeEach(() => {
  mocks.testMode = false;
  mocks.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'fiddle-migration-'));
  vi.mocked(log.warn).mockClear();
  mocks.importOldApp.mockReset();
  mocks.importElectronVersions.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  fs.rmSync(mocks.userData, { recursive: true, force: true });
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

describe('importElectronVersionsInBackground', () => {
  const marker = () => path.join(mocks.userData, 'electron-versions-imported');

  it('does nothing in test mode', () => {
    mocks.testMode = true;
    importElectronVersionsInBackground();
    expect(mocks.importElectronVersions).not.toHaveBeenCalled();
  });

  it('leaves the copy for another launch when there is no cache folder', () => {
    mocks.cacheRoot.mockImplementationOnce(() => {
      throw new Error('no home directory');
    });
    importElectronVersionsInBackground();
    expect(mocks.importElectronVersions).not.toHaveBeenCalled();
    expect(fs.existsSync(marker())).toBe(false);
  });

  it('runs on every launch until a copy has finished, then stops', async () => {
    mocks.importElectronVersions.mockRejectedValueOnce(new Error('cut short'));
    importElectronVersionsInBackground();
    await vi.waitFor(() => expect(log.warn).toHaveBeenCalledOnce());
    expect(fs.existsSync(marker())).toBe(false);

    mocks.importElectronVersions.mockResolvedValueOnce(['30.0.0']);
    importElectronVersionsInBackground();
    await vi.waitFor(() => expect(fs.existsSync(marker())).toBe(true));
    expect(mocks.importElectronVersions).toHaveBeenCalledTimes(2);
    expect(mocks.importElectronVersions).toHaveBeenCalledWith(
      path.join(mocks.userData, 'electron-bin'),
      path.join('/cache', 'electron'),
    );

    importElectronVersionsInBackground();
    expect(mocks.importElectronVersions).toHaveBeenCalledTimes(2);
  });
});
