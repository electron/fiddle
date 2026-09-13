/** Handlers for `run.toggle`, `run.package`, `run.make` and `bisect.toggle`. */
import { Run } from '../../ipc/main';
import type { CommandRegistry } from '../commands';
import { packageFiddle } from '../packaging/service';
import { getWindow } from '../windows';
import { getRunServices } from './index';

export function registerRunCommands(registry: CommandRegistry): void {
  registry.register('run.toggle', ({ windowId }) => {
    if (windowId) getRunServices().runs.toggle(windowId);
  });
  for (const task of ['package', 'make'] as const) {
    registry.register(`run.${task}`, async ({ windowId }) => {
      if (windowId) await packageFiddle(windowId, task, getRunServices());
    });
  }
  // Stops a bisect in progress; otherwise the window shows the range dialog.
  registry.register('bisect.toggle', ({ windowId }) => {
    if (!windowId) return;
    const { bisect } = getRunServices();
    if (bisect.isActive(windowId)) {
      bisect.stop(windowId);
      return;
    }
    const contents = getWindow(windowId)?.webContents;
    if (contents) Run.getDispatcher(contents)?.dispatchShowBisect();
  });
}
