import * as semver from 'semver';

import type { InstallStateValue } from '../../shared/stores';

export type RunResult = 'success' | 'failure' | 'invalid';

export interface RunOutcome {
  /** A pre-run check refused the run. */
  invalid?: boolean;
  /** Electron couldn't be spawned. */
  spawnFailed?: boolean;
  /** The module install failed. */
  installFailed?: boolean;
  /** The user stopped the run. Electron may still exit with code 0 on SIGTERM. */
  stopped?: boolean;
  code?: number | null;
  signal?: string | null;
}

/** Success is exit code 0; a signal, spawn failure or install failure is a failure. */
export function classifyRun(outcome: RunOutcome): RunResult {
  if (outcome.invalid) return 'invalid';
  if (outcome.spawnFailed || outcome.installFailed) return 'failure';
  if (outcome.signal) return 'failure';
  return outcome.code === 0 ? 'success' : 'failure';
}

/**
 * What an auto bisect step learns from a run: true for good (exit code 0),
 * false for bad, undefined when the run says nothing about the version (it was
 * refused or stopped, or the module install or the spawn failed).
 */
export function bisectVerdict(outcome: RunOutcome): boolean | undefined {
  if (outcome.invalid || outcome.stopped || outcome.installFailed || outcome.spawnFailed)
    return undefined;
  return classifyRun(outcome) === 'success';
}

/**
 * The Run control's status while the chosen version installs, from core's
 * install state: downloading, then unzipping. Other states don't change it.
 */
export function installRunStatus(
  state: InstallStateValue,
): 'downloading' | 'unzipping' | undefined {
  if (state === 'downloading') return 'downloading';
  if (state === 'downloaded' || state === 'installing') return 'unzipping';
  return undefined;
}

/** ES module entry points (`main.mjs`) need Electron 28 or later. Local builds pass. */
export function esmNeedsNewerElectron(
  mainEntry: string,
  version: string | undefined,
): boolean {
  if (!mainEntry.toLowerCase().endsWith('.mjs') || version === undefined) return false;
  const parsed = semver.parse(version);
  return parsed !== null && parsed.major < 28;
}

export { toPackageName } from '../../fiddle/package-json';
