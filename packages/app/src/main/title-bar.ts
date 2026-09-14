/**
 * macOS: double-clicking empty title bar space does what System Settings >
 * Desktop & Dock > "Double-click a window's title bar to" says (§17.1).
 * The title bar is ours (`titleBarStyle: 'hiddenInset'`), so the renderer
 * reports the double-click and this applies the preference.
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
