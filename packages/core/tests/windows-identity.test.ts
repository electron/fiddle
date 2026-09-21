import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerElectronIdentity } from '../src/windows-identity.js';

vi.mock('node:child_process');

interface PowerShellResult {
  code?: number;
  stdout?: string;
  stderr?: string;
}

/** A `powershell.exe` whose outcome `run` decides from the command it was given. */
function fakePowerShell(run: (command: string) => PowerShellResult = () => ({})) {
  return (_file: string, args?: readonly string[]) => {
    const ps = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
    });
    const { code = 0, stdout, stderr } = run(args?.[4] ?? '');
    process.nextTick(() => {
      if (stdout) ps.stdout.emit('data', Buffer.from(stdout));
      if (stderr) ps.stderr.emit('data', Buffer.from(stderr));
      ps.emit('close', code);
    });
    return ps as unknown as ReturnType<typeof spawn>;
  };
}

describe('registerElectronIdentity()', () => {
  let tmpdir: string;
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;

  beforeEach(async () => {
    tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'fiddle-core-'));
    Object.defineProperty(process, 'platform', { ...platform, value: 'win32' });
    vi.mocked(spawn).mockImplementation(fakePowerShell());
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', platform);
    vi.restoreAllMocks();
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  const commands = () => vi.mocked(spawn).mock.calls.map(([, args]) => args![4]);

  function installElectron() {
    const electronDir = path.join(tmpdir, 'electron');
    fs.mkdirSync(electronDir);
    fs.writeFileSync(path.join(electronDir, 'electron.exe'), '');
    return electronDir;
  }

  it('does nothing off Windows, or for a folder without electron.exe', async () => {
    const electronDir = installElectron();
    Object.defineProperty(process, 'platform', { ...platform, value: 'linux' });
    await registerElectronIdentity('30.0.0', electronDir);
    Object.defineProperty(process, 'platform', { ...platform, value: 'win32' });
    await registerElectronIdentity('30.0.0', tmpdir);
    expect(spawn).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(electronDir, 'AppxManifest.xml'))).toBe(false);
    expect(fs.existsSync(path.join(tmpdir, 'AppxManifest.xml'))).toBe(false);
  });

  it('unregisters the sparse packages of earlier runs before registering', async () => {
    vi.mocked(spawn).mockImplementation(
      fakePowerShell((command) =>
        command.startsWith('Get-AppxPackage')
          ? {
              stdout: 'Electron.Fiddle.MSIX_29.0.0\r\n  Electron.Fiddle.MSIX_28.0.0 \r\n',
            }
          : {},
      ),
    );

    await registerElectronIdentity('30.0.0', installElectron());

    expect(commands().slice(1)).toEqual([
      "Remove-AppxPackage -Package 'Electron.Fiddle.MSIX_29.0.0'",
      "Remove-AppxPackage -Package 'Electron.Fiddle.MSIX_28.0.0'",
      expect.stringMatching(/^Add-AppxPackage /),
    ]);
  });

  it('registers all the same when no earlier package is found, and logs a failed registration instead of throwing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(spawn).mockImplementation(
      fakePowerShell((command) =>
        command.startsWith('Get-AppxPackage')
          ? { code: 1 }
          : command.startsWith('Add-AppxPackage')
            ? { code: 1, stderr: 'Access is denied.' }
            : {},
      ),
    );

    await registerElectronIdentity('30.0.0', installElectron());

    expect(commands().map((command) => command?.split(' ')[0])).toEqual([
      'Get-AppxPackage',
      'Add-AppxPackage',
    ]);
    expect(error).toHaveBeenCalledWith(
      'Failed to register sparse package:',
      'PowerShell command failed: Access is denied.',
    );
  });

  it('logs a missing PowerShell instead of throwing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(spawn).mockImplementation(() => {
      const ps = Object.assign(new EventEmitter(), {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
      });
      process.nextTick(() => ps.emit('error', new Error('spawn powershell.exe ENOENT')));
      return ps as unknown as ReturnType<typeof spawn>;
    });

    await registerElectronIdentity('30.0.0', installElectron());

    expect(error).toHaveBeenCalledWith(
      'Failed to register sparse package:',
      'spawn powershell.exe ENOENT',
    );
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
