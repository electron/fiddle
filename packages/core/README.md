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

`exports` has a `source` condition that points at `src/index.ts`, for bundlers
that build `core` from source.

## Additions

Every addition is opt-in. Without the new options, behavior is unchanged.

| Where | Addition |
|---|---|
| `new Installer(paths?, options?)` | New `InstallerOptions` argument: `layout: 'current' \| 'per-version'` (default `'current'`), `locks: boolean` (default `false`), and `mirror: Partial<Mirrors>`, the default mirrors. |
| `Paths.electronVersions?` | Root of the per-version layout. Defaults to a `versions` folder next to `electronInstall`. |
| `InstallerParams.signal?` | Cancels `ensureDownloaded()` and `install()`. |
| `installer.installedVersions` | Every installed version. With the `current` layout, at most one. |
| `ElectronVersionsCreateOptions.releasesUrl?` | Where to fetch `releases.json`. |
| `RunnerOptions.childEnv?` | `{ denylist?, vars? }`. The child env is `env` (or `process.env`) minus the denylist (default `DEFAULT_ENV_DENYLIST`), plus `vars`. `LD_PRELOAD` and `DYLD_*` are always removed. |
| `RunnerOptions.inspect?` | `{ host?, port? }` adds `--inspect=host:port`. The defaults are `127.0.0.1` and `0`. |
| `signal` in `RunnerSpawnOptions` | Also cancels the install. `run()` and `bisect()` reject with an `aborted` error. |
| `FiddleCoreError`, `isFiddleCoreError()` | Every error thrown has a stable `code`: `invalid-version`, `invalid-fiddle`, `not-installed`, `already-installing`, `download-failed`, `extract-failed`, `aborted` or `locked`. |
| `acquireLock()`, `withLock()`, `Lock`, `LOCK_STALE_MS` | Cross-process lock files. They are created with `O_EXCL` and hold `{ pid, hostname, startedAt }`. A lock is stale if its pid is dead (checked on the same host only) or it is older than 10 minutes. |
| `buildChildEnv()`, `DEFAULT_ENV_DENYLIST`, `ALWAYS_BLOCKED_ENV` | The env builder that `childEnv` uses. |

With the `per-version` layout, a version is extracted into a temp folder and
renamed into place, so it is either complete or absent. Removal renames it
away before deleting it. With `locks`, downloads and installs take a lock next
to their target, so two processes can share one cache. Entries stay correct
without locks too, but locks avoid duplicate downloads.

## Compatibility notes

- **Errors.** Errors are `FiddleCoreError`s with the old messages. `name` is
  still `'Error'` and `code` is non-enumerable, so they still compare equal to
  the old plain `Error`s. Download and extract failures are wrapped, with the
  original error in `cause`. Checks like `err instanceof HTTPError` from
  `@electron/get` no longer match.
- **`signal`.** In 2.x, a `signal` in the spawn options only reached
  `child_process.spawn`, and an abort resolved `system_error`. Now `run()`
  rejects with `aborted`.
- **Fix.** A new `Installer` now reports the current install as `installed`
  even when its zip is still in the downloads folder. 2.x reported
  `downloaded` and re-extracted it on the next install.
- **Hardening.** `releases.json` is written atomically, and `git clone` gets
  `--` before the URL.
- **Dependencies.** In-house code replaces:
  - `debug`. `DEBUG=fiddle-core:*` still works.
  - `env-paths`. The default paths are unchanged.
  - `graceful-fs`.
  - `simple-git`. `git` is run directly and must be on `PATH`, as before.
  - `@electron/asar`, for `packAsAsar`. The new writer has no unpack support,
    which fiddle-core never used. `@electron/asar` stays as a dev dependency so
    the tests can check archives against it.
- **Locks and staleness.** A lock older than 10 minutes counts as stale even
  if its owner is alive, so a very slow download can be duplicated. It can't
  corrupt an entry. The `current` layout has one shared folder, so locks
  serialize writes to it but can't protect an Electron that is running from
  it. Use `per-version` when processes share a cache.
