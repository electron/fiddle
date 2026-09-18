import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { extractsWithoutAddon, isTargetAddon } from './native-addons';

describe('isTargetAddon', () => {
  it('matches the platform and architecture, and the ABI suffix', () => {
    expect(isTargetAddon('index.linux-x64-gnu.node', 'linux', 'x64')).toBe(true);
    expect(isTargetAddon('index.win32-x64-msvc.node', 'win32', 'x64')).toBe(true);
    expect(isTargetAddon('index.linux-arm64-gnu.node', 'linux', 'x64')).toBe(false);
    expect(isTargetAddon('index.win32-arm64-msvc.node', 'win32', 'x64')).toBe(false);
  });

  it('takes the universal macOS addon for every macOS architecture', () => {
    for (const arch of ['x64', 'arm64', 'universal']) {
      expect(isTargetAddon('index.darwin-universal.node', 'darwin', arch)).toBe(true);
    }
    expect(isTargetAddon('index.darwin-universal.node', 'linux', 'x64')).toBe(false);
  });

  it('maps Forge armv7l to the addon napi-rs calls arm', () => {
    expect(isTargetAddon('index.linux-arm-gnueabihf.node', 'linux', 'armv7l')).toBe(true);
    expect(isTargetAddon('index.linux-arm-gnueabihf.node', 'linux', 'arm64')).toBe(false);
    expect(isTargetAddon('index.linux-arm64-gnu.node', 'linux', 'armv7l')).toBe(false);
  });

  it('leaves out musl addons and other files', () => {
    expect(isTargetAddon('index.linux-x64-musl.node', 'linux', 'x64')).toBe(false);
    expect(isTargetAddon('binding.js', 'linux', 'x64')).toBe(false);
  });

  it('finds one addon for every release target, except those core extracts without one', () => {
    const dir = path.dirname(
      createRequire(import.meta.url).resolve('@electron-internal/extract-zip'),
    );
    const addons = fs.readdirSync(dir).filter((file) => file.endsWith('.node'));
    const targets = [
      ['darwin', 'x64'],
      ['darwin', 'arm64'],
      ['win32', 'x64'],
      ['win32', 'ia32'],
      ['linux', 'x64'],
      ['linux', 'arm64'],
      ['linux', 'armv7l'],
    ] as const;
    for (const [platform, arch] of targets) {
      const found = addons.filter((file) => isTargetAddon(file, platform, arch));
      expect(found, `${platform}-${arch}`).toHaveLength(
        extractsWithoutAddon(platform, arch) ? 0 : 1,
      );
    }
  });
});

describe('extractsWithoutAddon', () => {
  it('is true only for win32-ia32', () => {
    expect(extractsWithoutAddon('win32', 'ia32')).toBe(true);
    expect(extractsWithoutAddon('win32', 'x64')).toBe(false);
    expect(extractsWithoutAddon('linux', 'ia32')).toBe(false);
  });
});
