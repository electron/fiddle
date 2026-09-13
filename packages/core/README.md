# @electron/fiddle-core (in-repo)

A drop-in replacement for [`@electron/fiddle-core`](https://github.com/electron/fiddle-core),
ported from upstream v2.2.2. It is private and unpublished (`3.0.0-dev.0`).

Everything upstream's `index.ts` exports is here, with the same names and
behavior, and so is the `fiddle-core` CLI (`run`, `test`, `start`, `bisect` and
the `:msix` variants). Upstream's test suite runs against it in `tests/`. See
the [upstream README](https://github.com/electron/fiddle-core#readme) for the
base API.

```sh
yarn workspace @electron/fiddle-core test       # vitest, offline
yarn workspace @electron/fiddle-core typecheck
yarn workspace @electron/fiddle-core build      # dist/ (ESM + .d.ts)
```

`exports` has a `fiddle-source` condition that points at `src/index.ts`, for
bundlers and tests that build `core` from source. It isn't called `source`,
because some dependencies publish a `source` condition of their own.

## Additions

Every addition is opt-in. Without the new options, behavior is unchanged.

| Where                                                           | Addition                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `new Installer(paths?, options?)`                               | New `InstallerOptions` argument: `layout: 'current' \| 'per-version'` (default `'current'`), `mirror: Partial<Mirrors>` (the default mirrors), `errors` and `extract`. The old `locks` option is still accepted and ignored.                                                                                                                                                          |
| `InstallerOptions.extract?`                                     | `(zipPath, destDir, signal?) => Promise<void>`. It replaces the default extractor, which runs on the calling thread and sets `process.noAsar` while it runs. In Electron's main process, that turns off asar support for the whole app, so pass a function that extracts in a worker thread. `destDir` exists and is empty.                                                           |
| `Paths.electronVersions?`                                       | Root of the per-version layout. Defaults to a `versions` folder next to `electronInstall`.                                                                                                                                                                                                                                                                                            |
| `InstallerParams.signal?`                                       | Cancels `ensureDownloaded()` and `install()`. Concurrent calls for one version share one download and install. Each caller rejects with `aborted` as soon as its own signal aborts, and the shared work stops only once every caller has aborted. Progress goes to every caller.                                                                                                      |
| `installer.installedVersions`                                   | Every installed version. With the `current` layout, at most one.                                                                                                                                                                                                                                                                                                                      |
| `ElectronVersionsCreateOptions`                                 | `releasesUrl?`, where to fetch `releases.json`, and `errors?`.                                                                                                                                                                                                                                                                                                                        |
| `Runner.create({ errors })`                                     | See `errors` below. It's also passed to the `Installer` and `ElectronVersions` that `create()` makes.                                                                                                                                                                                                                                                                                 |
| `errors: 'typed'`                                               | On `Installer`, `ElectronVersions.create()` and `Runner.create()`. Download and extract failures are wrapped in `download-failed` and `extract-failed` errors, with the original error in `cause`, and `run()` and `bisect()` reject with `aborted` when their `signal` aborts. The default, `'legacy'`, throws the original errors and resolves `system_error` on abort, as 2.x did. |
| `RunnerOptions.childEnv?`                                       | `{ denylist?, extraDenylist?, vars? }`. The child env is `env` (or `process.env`) minus `denylist` (default `DEFAULT_ENV_DENYLIST`) and `extraDenylist`, plus `vars`. `LD_*` and `DYLD_*` are always removed. `NODE_OPTIONS` and `ELECTRON_RUN_AS_NODE` are never inherited, though `vars` can set them.                                                                              |
| `RunnerOptions.inspect?`                                        | `{ host?, port? }` adds `--inspect=host:port`. The defaults are `127.0.0.1` and `0`.                                                                                                                                                                                                                                                                                                  |
| `signal` in `RunnerSpawnOptions`                                | Also cancels the install, and kills the child's whole process tree (Electron under `xvfb-run`, say). On POSIX, the child is spawned detached, in its own process group, which gets SIGTERM, then SIGKILL after 5 seconds. On Windows, `taskkill /T /F`.                                                                                                                               |
| `FiddleCoreError`, `isFiddleCoreError()`, `ErrorMode`           | Errors that core raises itself have a stable `code`: `invalid-version`, `invalid-fiddle`, `not-installed`, `already-installing`, `download-failed`, `extract-failed`, `aborted` or `locked`.                                                                                                                                                                                          |
| `acquireLock()`, `withLock()`, `Lock`, `LOCK_STALE_MS`          | Cross-process lock files. See [Locks](#locks).                                                                                                                                                                                                                                                                                                                                        |
| `buildChildEnv()`, `DEFAULT_ENV_DENYLIST`, `ALWAYS_BLOCKED_ENV` | The env builder that `childEnv` uses. The default denylist covers tokens, API keys, `*_SECRET`, `*_PASSWORD`, `AWS_*`, `CSC_KEY_PASSWORD`, `SSH_AUTH_SOCK`, npm auth settings and `SENTRY_*`.                                                                                                                                                                                         |

## The per-version layout

This is the layout for a cache that several processes share, such as the app
and the CLI.

- A version is downloaded, extracted into a temp folder in `electronVersions`,
  then renamed into place, so it is either complete or absent. Only a folder
  that holds the Electron executable counts as installed.
- Downloads and installs always take locks, in `.locks/` under
  `electronDownloads` and `electronVersions`. The install lock is taken only
  after the download finishes.
- Temp and trash folders are named `.tmp-<version>_<host>_<pid>_<random>` and
  `.rm-…`. Before installing, under the lock, core deletes those left by a
  dead process on this host, and those older than 10 minutes from other hosts.
- `remove()` renames the folder to `.rm-…`, which counts as removed, then
  deletes it best-effort. A later sweep retries a delete that failed.
- Every rename is retried with backoff for up to 10 seconds on EPERM, EACCES
  and EBUSY, which Windows returns while a scanner has a file open.

## Locks

- A lock file is created with `O_EXCL` and holds `{ pid, hostname, startedAt }`.
  While a lock is held, its mtime is refreshed every `staleMs / 3`.
- A lock from this host is stale when its pid is dead. A lock from another host
  is stale when its mtime is older than `staleMs` (`LOCK_STALE_MS`, 10
  minutes). An unreadable lock is stale after 5 seconds.
- A waiter takes over a stale lock by renaming it to
  `<lock>.stale-<pid>-<random>` and re-reading it. It deletes the lock only if
  it's still the one it judged stale. Otherwise, it puts the lock back and
  retries.
- **Limit.** With three or more waiters at once, a lock that is put back can
  overwrite one that a third waiter took in the moment in between.

## Compatibility notes

- **Errors.** Errors that core raises itself are `FiddleCoreError`s with the
  old messages. `name` is still `'Error'` and `code` is non-enumerable, so they
  still compare equal to the old plain `Error`s. By default, download and
  extract failures are the original errors, so checks like
  `err instanceof HTTPError` still match. `errors: 'typed'` wraps them.
- **`signal`.** In 2.x, a `signal` in the spawn options only reached
  `child_process.spawn`. Now core handles it, so that it can also cancel the
  install and kill the whole process tree. As a result:
  - The child no longer emits an `error` event on abort.
  - `spawn()` rejects with `aborted` if the signal aborts before the child
    starts.
  - `run()` and `bisect()` still resolve `system_error` by default.
- **The `current` layout.**
  - After an install into `electronInstall`, core writes a
    `.fiddle-core-installed` marker. A folder without it, from a partial
    install or from 2.x, is reported as `downloaded` and re-extracted on the
    next install.
  - It never takes locks. One shared folder can't protect an Electron that is
    running from it, so use `per-version` when processes share a cache.
- **Hardening.** `releases.json` is written atomically, and `git clone` gets
  `--` before the URL.
- **Dependencies.** In-house code replaces `graceful-fs` and `simple-git`. `git`
  is run directly and must be on `PATH`, as before. `debug`, `env-paths` and
  `@electron/asar` are used as in 2.x.

## Edits to the upstream tests

`installer.test.ts`, `runner.test.ts`, `fiddle.test.ts` and `versions.test.ts`
are upstream's v2.2.2 tests. Apart from formatting and `type`-only imports,
the edits are:

- `graceful-fs` imports are now `node:fs`, because core no longer depends on
  it.
- `runner.test.ts`: the two tests that call `Runner.create()` with no options
  now pass `{ paths: { versionsCache } }`, so they read the fixture releases
  list instead of the network.
- `fiddle.test.ts`: "reads fiddles from gists" serves the gist from a local
  bare repo, using git's `url.<base>.insteadOf`, so it runs offline.

The other test files cover the additions. `two-process.test.ts` runs a second
Node process that loads core from source and installs into the same cache.
