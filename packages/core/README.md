# @electron/fiddle-core (in-repo)

A drop-in replacement for [`@electron/fiddle-core`](https://github.com/electron/fiddle-core). It is
private and unpublished.

Everything upstream's `index.ts` exports is here, with the same names and behavior, and so is the
`fiddle-core` CLI (`run`, `test`, `start`, `bisect` and the `:msix` variants). See the [upstream
README](https://github.com/electron/fiddle-core#readme) for the base API. Upstream's test suite
runs against this package in `tests/`.

```sh
yarn workspace @electron/fiddle-core test       # vitest, offline
yarn workspace @electron/fiddle-core typecheck
yarn workspace @electron/fiddle-core build      # dist/ (ESM + .d.ts)
```

`exports` has a `fiddle-source` condition that points at `src/index.ts`, for bundlers and tests
that build `core` from source. It isn't called `source`, because some dependencies publish a
`source` condition of their own.

## Additions

Every addition is opt-in. Without the new options, the API and defaults match upstream. The
options are documented on their types in `src/`:

- `InstallerOptions` (`src/installer.ts`): the `per-version` layout for a cache that several
  processes share, injectable mirrors and a custom extractor.
- `RunnerOptions` (`src/runner.ts`): control over the child environment and the inspector, and
  `AbortSignal` cancellation.
- `FiddleCoreError` (`src/errors.ts`): errors with a stable `code`, and the `errors: 'typed'` mode.
- `acquireLock()` and `withLock()` (`src/lock.ts`): cross-process lock files.
