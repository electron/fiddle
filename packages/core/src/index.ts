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

export type { ExtractFunction, InstallLayout, InstallerOptions } from './installer.js';
export type { InspectOptions, RunnerCreateOptions } from './runner.js';
export { FiddleCoreError, isFiddleCoreError } from './errors.js';
export type { ErrorMode, FiddleCoreErrorCode } from './errors.js';
export { LOCK_STALE_MS, Lock, acquireLock, withLock } from './lock.js';
export type { LockInfo, LockOptions } from './lock.js';
export { ALWAYS_BLOCKED_ENV, DEFAULT_ENV_DENYLIST, buildChildEnv } from './env.js';
export { copyFolder, removeBestEffort, rename as renameWithRetry } from './fs-util.js';
export type { ChildEnvOptions } from './env.js';
export { extractZip } from './extract.js';
