import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const platform = process.platform;

function setPlatform(value: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value, configurable: true });
}

/** `extractZip` with the addon stubbed as `native`, or as failing to load when that is an Error. */
async function load(
  native: ((zip: string, opts: { dir: string }) => Promise<void>) | Error,
) {
  const execFile = vi.fn(
    (
      _file: string,
      _args: string[],
      _opts: object,
      done: (error: Error | null) => void,
    ) => done(null),
  );
  vi.doMock('node:child_process', () => ({ execFile }));
  if (native instanceof Error) {
    vi.doMock('@electron-internal/extract-zip', () => {
      throw native;
    });
  } else {
    vi.doMock('@electron-internal/extract-zip', () => ({ extract: native }));
  }
  const { extractZip } = await import('../src/extract.js');
  return { extractZip, execFile };
}

describe('extractZip', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    setPlatform(platform);
    vi.doUnmock('node:child_process');
    vi.doUnmock('@electron-internal/extract-zip');
  });

  it('extracts with the native addon when it loads', async () => {
    setPlatform('win32');
    const native = vi.fn(async () => {});
    const { extractZip, execFile } = await load(native);
    await extractZip('C:\\in.zip', 'C:\\out');
    expect(native).toHaveBeenCalledWith('C:\\in.zip', { dir: 'C:\\out' });
    expect(execFile).not.toHaveBeenCalled();
  });

  it('does not retry an archive the addon failed to extract', async () => {
    setPlatform('win32');
    const { extractZip, execFile } = await load(async () => {
      throw new Error('bad archive');
    });
    await expect(extractZip('C:\\in.zip', 'C:\\out')).rejects.toThrow('bad archive');
    expect(execFile).not.toHaveBeenCalled();
  });

  it('falls back to tar.exe on Windows when the addon does not load', async () => {
    setPlatform('win32');
    vi.stubEnv('SystemRoot', 'C:\\Windows');
    const { extractZip, execFile } = await load(new Error('Cannot find native binding'));
    const signal = new AbortController().signal;
    await extractZip('C:\\in.zip', 'C:\\out', signal);
    expect(execFile).toHaveBeenCalledWith(
      'C:\\Windows\\System32\\tar.exe',
      ['-xf', 'C:\\in.zip', '-C', 'C:\\out'],
      { windowsHide: true, signal },
      expect.any(Function),
    );
    vi.unstubAllEnvs();
  });

  it('reports the load failure on other platforms', async () => {
    setPlatform('linux');
    const { extractZip, execFile } = await load(new Error('Cannot find native binding'));
    await expect(extractZip('/in.zip', '/out')).rejects.toThrow();
    expect(execFile).not.toHaveBeenCalled();
  });
});
