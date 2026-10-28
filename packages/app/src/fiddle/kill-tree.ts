import { spawn, type ChildProcess } from 'node:child_process';

const KILL_GRACE_MS = 1000;

/**
 * Stops a child and everything it started. On POSIX that is SIGTERM to the
 * child's process group, then SIGKILL after a second, so the child must have
 * been spawned `detached` to lead its own group (otherwise only it is
 * signalled). On Windows it is `taskkill /T /F`, because `kill()` would end
 * only the direct child, such as the `cmd.exe` that runs npm.
 */
export function killTree(
  child: ChildProcess,
  platform: NodeJS.Platform = process.platform,
): void {
  const { pid } = child;
  const alive = () => child.exitCode === null && child.signalCode === null;
  if (platform === 'win32') {
    if (pid === undefined || !alive()) return;
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    }).on('error', () => child.kill());
    return;
  }
  const send = (signal: NodeJS.Signals) => {
    if (pid !== undefined) {
      try {
        process.kill(-pid, signal);
        return;
      } catch {
        // Not a group leader, or the group is gone.
      }
    }
    if (alive()) child.kill(signal);
  };
  send('SIGTERM');
  // The group can outlive its leader, so the timer isn't cleared when the child exits.
  setTimeout(() => send('SIGKILL'), KILL_GRACE_MS).unref();
}
