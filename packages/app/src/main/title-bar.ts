/**
 * macOS: double-clicking empty title bar space follows System Settings > Desktop
 * & Dock. The title bar is ours, so the renderer reports the double-click.
 */
import { systemPreferences, type BrowserWindow } from 'electron';

export function titleBarDoubleClick(win: BrowserWindow | undefined): void {
  if (!win || process.platform !== 'darwin') return;
  const action = systemPreferences.getUserDefault('AppleActionOnDoubleClick', 'string');
  if (action === 'Minimize') win.minimize();
  else if (action === 'None') return;
  // "Maximize" (zoom) is also the default when the preference was never set.
  else if (win.isMaximized()) win.unmaximize();
  else win.maximize();
}
