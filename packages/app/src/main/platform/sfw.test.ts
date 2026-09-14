import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { isPackaged: false } }));

const { resolveSfwEntry, SFW_ENTRY, SFW_PACKAGE_ENTRY } = await import('./sfw');

// @feature settings.socket-firewall
describe('resolveSfwEntry', () => {
  const noResolve = () => {
    throw new Error('not in node_modules');
  };

  it('uses <resources>/sfw.mjs in packaged builds', () => {
    const file = path.join('/res', SFW_ENTRY);
    expect(resolveSfwEntry({ packaged: true, resourcesPath: '/res', resolve: noResolve, exists: (f) => f === file })).toBe(file);
  });

  it('uses the package in node_modules in dev and test runs', () => {
    const resolve = (id: string) => `/repo/node_modules/${id}`;
    expect(resolveSfwEntry({ packaged: false, resourcesPath: '/res', resolve, exists: () => true })).toBe(
      `/repo/node_modules/${SFW_PACKAGE_ENTRY}`,
    );
  });

  it('is undefined when the file is missing', () => {
    expect(resolveSfwEntry({ packaged: true, resourcesPath: '/res', resolve: noResolve, exists: () => false })).toBeUndefined();
    expect(resolveSfwEntry({ packaged: false, resourcesPath: '/res', resolve: noResolve })).toBeUndefined();
  });

  it('is shipped by forge.config.ts', () => {
    expect(fs.readFileSync(path.join(import.meta.dirname, '../../../forge.config.ts'), 'utf8')).toContain(SFW_PACKAGE_ENTRY);
  });

  // The sfw package isn't installed yet (PROGRESS.md, "Deferred"); this runs once it is.
  const resolve = createRequire(import.meta.url).resolve;
  const installed = resolveSfwEntry({ packaged: false, resourcesPath: '', resolve });
  it.skipIf(installed === undefined)('finds the real sfw.mjs in node_modules', () => {
    expect(fs.readFileSync(installed!, 'utf8')).toMatch(/^#!\/usr\/bin\/env node/);
  });
});
