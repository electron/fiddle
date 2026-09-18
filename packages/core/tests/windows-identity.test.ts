import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerElectronIdentity } from '../src/windows-identity.js';

vi.mock('node:child_process');

function fakePowerShell() {
  const ps = Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
  });
  process.nextTick(() => ps.emit('close', 0));
  return ps as unknown as ReturnType<typeof spawn>;
}

describe('registerElectronIdentity()', () => {
  let tmpdir: string;
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;

  beforeEach(async () => {
    tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'fiddle-core-'));
    Object.defineProperty(process, 'platform', { ...platform, value: 'win32' });
    vi.mocked(spawn).mockImplementation(fakePowerShell);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', platform);
    vi.restoreAllMocks();
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  it('quotes paths for PowerShell and escapes the display name for XML', async () => {
    const electronDir = path.join(tmpdir, "it's $(evil) `here`");
    fs.mkdirSync(electronDir);
    fs.writeFileSync(path.join(electronDir, 'electron.exe'), '');

    await registerElectronIdentity('1.0.0 <a&b> $& $1', electronDir);

    const manifest = fs.readFileSync(path.join(electronDir, 'AppxManifest.xml'), 'utf8');
    expect(manifest).toContain('Electron (1.0.0 &#60;a&#38;b&#62; $&#38; $1) MSIX');
    expect(manifest).not.toContain('$DISPLAY_NAME$');

    const commands = vi.mocked(spawn).mock.calls.map(([, args]) => args![4]);
    const quoted = (p: string) => `'${p.replaceAll("'", "''")}'`;
    expect(commands.at(-1)).toBe(
      `Add-AppxPackage -ExternalLocation ${quoted(electronDir)} -Register ${quoted(
        path.join(electronDir, 'AppxManifest.xml'),
      )}`,
    );
  });
});
