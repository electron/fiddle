import {
  ChildProcess,
  execFile as cp_execFile,
  spawn,
} from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';

import { DEFAULT_TART_IMAGE } from '../constants';

export { DEFAULT_TART_IMAGE };

const execFileP = promisify(cp_execFile);

// Prefix for the ephemeral VM clones we create so they're easy to spot
// (and clean up) on the host.
const VM_NAME_PREFIX = 'electron-fiddle-';

// `tart run --dir=<tag>:<path>` exposes the host directory to the guest under
// this mount point on macOS guests.
const SHARED_MOUNT_ROOT = '/Volumes/My Shared Files';
const FIDDLE_TAG = 'fiddle';
const ELECTRON_TAG = 'electron';

// Default credentials for the Cirrus Labs base images.
const DEFAULT_SSH_USER = 'admin';
const DEFAULT_SSH_PASSWORD = 'admin';

// How long to wait for the freshly-booted VM to obtain an IP address.
const IP_WAIT_SECONDS = 120;

export interface SpawnInVMOptions {
  /** The base image to clone for this run. */
  image: string;
  /** Host path to the directory holding the fiddle's files. */
  fiddleDir: string;
  /** Host path to the directory containing the Electron build. */
  electronDir: string;
  /** Host path to the Electron executable (must live under `electronDir`). */
  execPath: string;
  /** Arguments passed to Electron after the fiddle directory. */
  flags: string[];
  /** Environment variables to export inside the guest before running. */
  env: { [key: string]: string | undefined };
  /** Optional callback used to surface progress to the renderer. */
  onStatus?: (line: string) => void;
}

/**
 * Whether `tart` can be used on this machine. `tart` only runs on
 * Apple Silicon macOS, so bail out early on every other platform.
 */
export async function isTartAvailable(): Promise<boolean> {
  if (process.platform !== 'darwin') return false;
  try {
    await execFileP('tart', ['--version']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Single-quote a string for safe interpolation into a `/bin/sh` command.
 */
function shQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * Build the command run inside the guest: `cd` into the mounted fiddle
 * directory, export the sanitized environment, then exec Electron pointed
 * at the fiddle. Using `exec` means the SSH session's lifetime tracks the
 * Electron process, so closing the session (or the process exiting) is the
 * signal we tear the VM down on.
 */
function buildRemoteCommand(opts: SpawnInVMOptions): string {
  const guestFiddleDir = path.posix.join(SHARED_MOUNT_ROOT, FIDDLE_TAG);

  // Translate the host executable path into the guest's mounted layout.
  const relExec = path
    .relative(opts.electronDir, opts.execPath)
    .split(path.sep)
    .join(path.posix.sep);
  const guestExec = path.posix.join(SHARED_MOUNT_ROOT, ELECTRON_TAG, relExec);

  const exportLines = Object.entries(opts.env)
    // Only export well-formed shell variable names with defined values so a
    // malicious key can't break out of the command we construct.
    .filter(
      ([key, val]) => val !== undefined && /^[A-Za-z_][A-Za-z0-9_]*$/.test(key),
    )
    .map(([key, val]) => `export ${key}=${shQuote(val as string)}`)
    .join('; ');

  const flags = opts.flags.map(shQuote).join(' ');
  const run = `exec ${shQuote(guestExec)} ${shQuote(guestFiddleDir)} ${flags}`;

  const prefix = exportLines ? `${exportLines}; ` : '';
  return `cd ${shQuote(guestFiddleDir)} && ${prefix}${run}`;
}

/**
 * Clone a throwaway VM, mount the fiddle and Electron build into it, boot
 * it, and run Electron over SSH. The returned {@link ChildProcess} is the
 * SSH session: its stdout/stderr stream the guest's output and killing it
 * stops the run. The VM is automatically stopped and deleted once the SSH
 * session ends.
 */
export async function spawnInVM(opts: SpawnInVMOptions): Promise<ChildProcess> {
  if (process.platform !== 'darwin') {
    throw new Error('Running in a tart VM is only supported on macOS');
  }
  if (!(await isTartAvailable())) {
    throw new Error(
      'tart was not found. Install it from https://tart.run to run fiddles in an isolated VM.',
    );
  }

  const status = opts.onStatus ?? (() => undefined);
  const name = `${VM_NAME_PREFIX}${Date.now()}-${Math.floor(
    Math.random() * 1e6,
  )}`;

  let runProcess: ChildProcess | undefined;
  let tornDown = false;

  // Best-effort teardown: stop and delete the ephemeral VM. Safe to call
  // multiple times.
  const teardown = async () => {
    if (tornDown) return;
    tornDown = true;
    try {
      await execFileP('tart', ['stop', name]);
    } catch {
      // The VM may already be stopped.
    }
    try {
      runProcess?.kill();
    } catch {
      // Ignore — the run process may have already exited.
    }
    try {
      await execFileP('tart', ['delete', name]);
    } catch {
      // The VM may already be gone.
    }
  };

  try {
    status(`Cloning VM image ${opts.image}...`);
    await execFileP('tart', ['clone', opts.image, name]);

    status('Booting isolated VM...');
    // `tart run` is long-lived — it backs the running VM. Keep the handle so
    // we can kill it during teardown.
    runProcess = spawn(
      'tart',
      [
        'run',
        name,
        '--no-graphics',
        `--dir=${FIDDLE_TAG}:${opts.fiddleDir}`,
        `--dir=${ELECTRON_TAG}:${opts.electronDir}:ro`,
      ],
      { stdio: 'ignore' },
    );

    status('Waiting for VM to come online...');
    const { stdout: ipOut } = await execFileP('tart', [
      'ip',
      name,
      '--wait',
      String(IP_WAIT_SECONDS),
    ]);
    const ip = ipOut.trim();
    if (!ip) {
      throw new Error('Timed out waiting for the VM to obtain an IP address');
    }

    status(`Running fiddle in VM at ${ip}...`);
    const remoteCommand = buildRemoteCommand(opts);
    const sshArgs = [
      '-o',
      'StrictHostKeyChecking=no',
      '-o',
      'UserKnownHostsFile=/dev/null',
      '-o',
      'LogLevel=ERROR',
      `${DEFAULT_SSH_USER}@${ip}`,
      remoteCommand,
    ];

    // Use sshpass for the image's password auth when available; otherwise
    // fall back to plain ssh (key-based auth).
    const ssh = DEFAULT_SSH_PASSWORD
      ? spawn('sshpass', ['-p', DEFAULT_SSH_PASSWORD, 'ssh', ...sshArgs])
      : spawn('ssh', sshArgs);

    // Tear the VM down once the run finishes or is killed.
    ssh.on('close', () => void teardown());
    ssh.on('error', () => void teardown());

    return ssh;
  } catch (error) {
    await teardown();
    throw error;
  }
}
