/**
 * Small pure rules for runs: result classification (§17.6 "Results"), the
 * pre-run ESM check and the generated package name. No Electron imports.
 */
import * as semver from 'semver';

export type RunResult = 'success' | 'failure' | 'invalid';

export interface RunOutcome {
  /** A pre-run check refused the run. */
  invalid?: boolean;
  /** Electron couldn't be spawned. */
  spawnFailed?: boolean;
  /** The module install failed. */
  installFailed?: boolean;
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

/** ES module entry points (`main.mjs`) need Electron 28 or later. Local builds pass. */
export function esmNeedsNewerElectron(mainEntry: string, version: string | undefined): boolean {
  if (!mainEntry.endsWith('.mjs') || version === undefined) return false;
  const parsed = semver.parse(version);
  return parsed !== null && parsed.major < 28;
}

/** A valid npm package name from a fiddle's display name, e.g. "Sparkling Pony" → "sparkling-pony". */
export function toPackageName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[._-]+|[-]+$/g, '')
    .slice(0, 214);
  return cleaned || 'fiddle';
}
