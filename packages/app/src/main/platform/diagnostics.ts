/** Help → "Copy diagnostics". The labels stay English: maintainers read the bug reports. */
import os from 'node:os';

import { app, clipboard } from 'electron';

import { toSparse, type Settings } from '../../shared/settings';
import { redactSecrets } from '../crash/scrub';
import type { StateHub } from '../state-hub';

interface DiagnosticsInput {
  appVersion: string;
  packaged: boolean;
  versions: { electron?: string; chrome?: string; node?: string };
  os: { platform: string; release: string; arch: string };
  locale: string;
  settings: Settings;
}

function diagnosticsText(input: DiagnosticsInput, home: string): string {
  const sparse: Record<string, unknown> = { ...toSparse(input.settings) };
  // Environment variables may hold secrets: only their names are kept.
  if (Array.isArray(sparse.environmentVariables)) {
    sparse.environmentVariables = (sparse.environmentVariables as string[]).map(
      (entry) => `${entry.split('=')[0]}=[redacted]`,
    );
  }
  const { versions, os: system } = input;
  const lines = [
    `Electron Fiddle ${input.appVersion}${input.packaged ? '' : ' (unpackaged)'}`,
    `Electron ${versions.electron ?? '?'}, Chromium ${versions.chrome ?? '?'}, Node ${versions.node ?? '?'}`,
    `OS: ${system.platform} ${system.release} (${system.arch})`,
    `Locale: ${input.locale}`,
    `Settings changed from the defaults: ${JSON.stringify(sparse, null, 2)}`,
  ];
  return redactSecrets(lines.join('\n'), home);
}

export function copyDiagnostics(hub: StateHub): void {
  clipboard.writeText(
    diagnosticsText(
      {
        appVersion: app.getVersion(),
        packaged: app.isPackaged,
        versions: process.versions,
        os: { platform: process.platform, release: os.release(), arch: process.arch },
        locale: hub.app.locale,
        settings: hub.app.settings,
      },
      os.homedir(),
    ),
  );
}
