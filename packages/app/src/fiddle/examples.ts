import * as path from 'node:path';

import { ErrorCode, FiddleError } from '../shared/errors';
import type { FileMap } from './files';
import { readFiddleFolder } from './folder';

/** The built-in "Show Me" examples, with their display names, in menu order (§17.4). */
export const SHOW_ME_EXAMPLES = [
  'App', 'AutoUpdater', 'BrowserView', 'BrowserWindow', 'Clipboard', 'ContentTracing', 'Cookies', 'CrashReporter',
  'Debugger', 'DesktopCapturer', 'Dialog', 'GlobalShortcut', 'IPC', 'Menu', 'NativeImage', 'Net',
  'Notification', 'PowerMonitor', 'PowerSaveBlocker', 'Screen', 'Session', 'Shell', 'SystemPreferences', 'TouchBar',
  'Tray', 'utilityProcess', 'WebContents', 'WebContentsView', 'WebFrame',
] as const;

export type ShowMeExampleName = (typeof SHOW_ME_EXAMPLES)[number];

export interface ExampleInfo {
  name: ShowMeExampleName;
  /** Folder under `static/show-me/`. */
  dir: string;
}

export function listExamples(): ExampleInfo[] {
  return SHOW_ME_EXAMPLES.map((name) => ({ name, dir: name.toLowerCase() }));
}

/** Finds an example by display name or folder name, ignoring case. */
export function findExample(name: string): ExampleInfo | undefined {
  const lower = name.toLowerCase();
  return listExamples().find((e) => e.dir === lower);
}

/** Loads `<staticDir>/show-me/<dir>/`. */
export async function loadExample(staticDir: string, name: string): Promise<FileMap> {
  const example = findExample(name);
  if (!example) throw new FiddleError(ErrorCode.notFound, `No example named "${name}"`, { name });
  return (await readFiddleFolder(path.join(staticDir, 'show-me', example.dir))).files;
}
