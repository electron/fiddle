/** Help → "Copy diagnostics". The labels stay English: maintainers read the bug reports. */
import os from 'node:os';

import { app, clipboard } from 'electron';

import { toSparse } from '../../shared/settings';
import { redactSecrets } from '../crash/scrub';
import type { StateHub } from '../state-hub';

export function copyDiagnostics(hub: StateHub): void {
  const sparse: Record<string, unknown> = { ...toSparse(hub.app.settings) };
  // Environment variables may hold secrets: only their names are kept.
  if (Array.isArray(sparse.environmentVariables)) {
    sparse.environmentVariables = (sparse.environmentVariables as string[]).map(
      (entry) => `${entry.split('=')[0]}=[redacted]`,
    );
  }
  const { electron = '?', chrome = '?', node = '?' } = process.versions;
  const lines = [
    `Electron Fiddle ${app.getVersion()}${app.isPackaged ? '' : ' (unpackaged)'}`,
    `Electron ${electron}, Chromium ${chrome}, Node ${node}`,
    `OS: ${process.platform} ${os.release()} (${process.arch})`,
    `Locale: ${hub.app.locale}`,
    `Settings changed from the defaults: ${JSON.stringify(sparse, null, 2)}`,
  ];
  clipboard.writeText(redactSecrets(lines.join('\n'), os.homedir()));
}
