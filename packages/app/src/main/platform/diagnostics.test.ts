/** Help > Copy diagnostics: what goes on the clipboard, with secrets and the home folder redacted. */
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { defaultSettings } from '../../shared/settings';

const writeText = vi.hoisted(() => vi.fn<(text: string) => void>());
vi.mock('electron', () => ({
  app: { getVersion: () => '1.2.3', isPackaged: false },
  clipboard: { writeText },
}));

import { copyDiagnostics } from './diagnostics';

describe('copyDiagnostics', () => {
  it('copies the versions, the OS and only the changed settings, with variable values and the home folder redacted', () => {
    const hub = {
      app: {
        locale: 'fr',
        settings: {
          ...defaultSettings,
          packageManager: 'yarn',
          environmentVariables: ['GITHUB_TOKEN=ghp_secret', 'DEBUG=1'],
          customMirrorElectron: `file://${path.join(os.homedir(), 'mirror')}/`,
        },
      },
    };
    copyDiagnostics(hub as never);
    const text = writeText.mock.calls[0]![0];
    expect(text).toContain('Electron Fiddle 1.2.3 (unpackaged)');
    expect(text).toContain(`Node ${process.versions.node}`);
    expect(text).toContain(`OS: ${process.platform} ${os.release()} (${process.arch})`);
    expect(text).toContain('Locale: fr');
    expect(text).toContain('"packageManager": "yarn"');
    expect(text).toContain('"GITHUB_TOKEN=[redacted]"');
    expect(text).toContain('"DEBUG=[redacted]"');
    expect(text).not.toContain('ghp_secret');
    expect(text).toContain('file://~');
    expect(text).not.toContain(os.homedir());
    // Defaults are left out.
    expect(text).not.toContain('electronLogging');
  });
});
