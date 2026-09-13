/** Handlers for the commands in src/shared/commands.ts. */
import type { CommandRegistry } from './commands';
import { getWindow } from './windows';

export function registerCommands(
  registry: CommandRegistry,
  openWindow: () => Promise<unknown>,
): void {
  registry.register('app.newWindow', async () => {
    await openWindow();
  });
  registry.register('view.reload', ({ windowId }) => {
    getWindow(windowId)?.webContents.reload();
  });
  registry.register('view.toggleDevTools', ({ windowId }) => {
    getWindow(windowId)?.webContents.toggleDevTools();
  });
}
