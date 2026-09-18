import path from 'node:path';

// napi-rs calls 32-bit ARM `arm`, Forge calls it `armv7l`.
const NAPI_ARCH: Record<string, string> = { armv7l: 'arm' };

/**
 * Whether a napi-rs addon file (`index.<platform>-<arch>[-<abi>].node`, or
 * `index.<platform>-universal.node`) is the one Forge's `platform` and `arch`
 * need. Electron runs on glibc only, so musl addons never match.
 */
export function isTargetAddon(file: string, platform: string, arch: string): boolean {
  const tag = /^index\.(.+)\.node$/.exec(path.basename(file))?.[1];
  if (!tag) return false;
  const target = `${platform}-${NAPI_ARCH[arch] ?? arch}`;
  return (
    tag === `${platform}-universal` ||
    tag === target ||
    (tag.startsWith(`${target}-`) && !tag.endsWith('-musl'))
  );
}

/**
 * Targets `@electron-internal/extract-zip` ships no addon for. Core extracts
 * with Windows' `tar.exe` there (`extractZip` in packages/core/src/extract.ts).
 */
const TARGETS_WITHOUT_ADDON = new Set(['win32-ia32']);

export function extractsWithoutAddon(platform: string, arch: string): boolean {
  return TARGETS_WITHOUT_ADDON.has(`${platform}-${arch}`);
}
