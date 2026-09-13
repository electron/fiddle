// Everything fiddle-core 2.x exported, with the same names.
export { DefaultPaths } from './paths.js';
export type { Paths } from './paths.js';
export { InstallState, Installer } from './installer.js';
export type {
  ElectronBinary,
  InstallStateEvent,
  InstallerParams,
  Mirrors,
  ProgressObject,
} from './installer.js';
export { Fiddle, FiddleFactory } from './fiddle.js';
export type { FiddleFactoryCreateOptions, FiddleSource } from './fiddle.js';
export { Runner } from './runner.js';
export type {
  BisectResult,
  RunnerOptions,
  RunnerSpawnOptions,
  TestResult,
} from './runner.js';
export { BaseVersions, ElectronVersions, SemVer, compareVersions } from './versions.js';
export type {
  ElectronVersionsCreateOptions,
  ReleaseInfo,
  SemOrStr,
  Versions,
} from './versions.js';
export { runFromCommandLine } from './command-line.js';

// Additions in 3.0.
export type { InstallLayout, InstallerOptions } from './installer.js';
export type { InspectOptions } from './runner.js';
export { FiddleCoreError, isFiddleCoreError } from './errors.js';
export type { FiddleCoreErrorCode } from './errors.js';
export { LOCK_STALE_MS, Lock, acquireLock, withLock } from './lock.js';
export type { LockInfo, LockOptions } from './lock.js';
export { ALWAYS_BLOCKED_ENV, DEFAULT_ENV_DENYLIST, buildChildEnv } from './env.js';
export type { ChildEnvOptions } from './env.js';
