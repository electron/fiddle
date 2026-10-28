import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { isPackaged: false } }));
vi.mock('../i18n');

const { DISCLAIM_HELPER, resolveDisclaimHelper } = await import('./disclaim');

const base = {
  platform: 'darwin' as const,
  packaged: false,
  resourcesPath: '/Applications/Electron Fiddle.app/Contents/Resources',
  appPath: '/repo/packages/app',
};
const packagedHelper = path.join(base.resourcesPath, DISCLAIM_HELPER);
const devHelper = path.join(base.appPath, 'native', 'disclaim', 'build', DISCLAIM_HELPER);

describe('resolveDisclaimHelper', () => {
  it.each(['linux', 'win32'] as const)(
    'starts fiddles directly on %s, without looking for the helper',
    (platform) => {
      const isExecutable = vi.fn(() => true);
      expect(
        resolveDisclaimHelper({ ...base, platform, packaged: true, isExecutable }),
      ).toBeUndefined();
      expect(isExecutable).not.toHaveBeenCalled();
    },
  );

  it('finds the helper in the resources of a packaged build, and in the build folder in dev', () => {
    expect(
      resolveDisclaimHelper({
        ...base,
        packaged: true,
        isExecutable: (file) => file === packagedHelper,
      }),
    ).toBe(packagedHelper);
    expect(
      resolveDisclaimHelper({ ...base, isExecutable: (file) => file === devHelper }),
    ).toBe(devHelper);
  });

  it('starts fiddles directly in a dev build that has not built the helper', () => {
    expect(resolveDisclaimHelper({ ...base, isExecutable: () => false })).toBeUndefined();
  });

  it('refuses in a packaged build without a usable helper, rather than sharing the app privacy grants', () => {
    // A helper that exists elsewhere does not count.
    expect(() =>
      resolveDisclaimHelper({
        ...base,
        packaged: true,
        isExecutable: (file) => file === devHelper,
      }),
    ).toThrow(expect.objectContaining({ code: 'unavailable' }) as Error);
  });

  // The default check is on real files: a file with no execute permission, or a folder, is no helper.
  it.skipIf(process.platform === 'win32')('needs an executable file', () => {
    const resourcesPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fiddle-disclaim-'));
    try {
      const file = path.join(resourcesPath, DISCLAIM_HELPER);
      const location = { ...base, packaged: true, resourcesPath };
      fs.writeFileSync(file, '', { mode: 0o644 });
      expect(() => resolveDisclaimHelper(location)).toThrow();
      fs.chmodSync(file, 0o755);
      expect(resolveDisclaimHelper(location)).toBe(file);
      fs.rmSync(file);
      fs.mkdirSync(file);
      expect(() => resolveDisclaimHelper(location)).toThrow();
    } finally {
      fs.rmSync(resourcesPath, { recursive: true, force: true });
    }
  });
});
