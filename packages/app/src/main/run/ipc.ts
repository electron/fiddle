import { implement, Run } from '../../ipc/main';
import type { IpcContext } from '../ipc';
import { bindVersionsIpc } from '../versions/ipc';

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
    OpenBisectCompare: () => bisect.openCompare(windowId),
  });
}
