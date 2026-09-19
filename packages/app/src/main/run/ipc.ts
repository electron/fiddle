import { shell } from 'electron';

import { implement, Run } from '../../ipc/main';
import { messageBox } from '../dialogs';
import { tm } from '../i18n';
import type { IpcContext } from '../ipc';
import { bindVersionsIpc } from '../versions/ipc';

const t = tm('mainRun');

export function bindRunIpc(ctx: IpcContext): void {
  const { contents, windowId, services } = ctx;
  const { runs, bisect } = services;

  bindVersionsIpc(ctx);

  implement(Run, contents, {
    GetOutput: () => runs.output(windowId),
    ClearOutput: () => runs.clear(windowId),
    StartBisect: (good, bad, auto) => bisect.start(windowId, good, bad, auto),
    BisectGood: () => bisect.mark(windowId, 'good'),
    BisectBad: () => bisect.mark(windowId, 'bad'),
    BisectSkip: () => bisect.mark(windowId, 'skip'),
    StopBisect: () => bisect.stop(windowId),
    OpenBisectCompare: async () => {
      const url = bisect.compareUrl(windowId);
      if (!url) return;
      const { response } = await messageBox(windowId, {
        type: 'question',
        message: t('openCompareMessage'),
        detail: url,
        buttons: [t('openCompareButton'), t('cancel')],
        defaultId: 0,
        cancelId: 1,
      });
      if (response === 0) await shell.openExternal(url);
    },
  });

  // Closing a window aborts its operations (but not downloads).
  contents.once('destroyed', () => {
    bisect.stop(windowId);
    runs.disposeWindow(windowId);
  });
}
