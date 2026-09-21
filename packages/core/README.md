# @electron/fiddle-core (in-repo)

A trimmed port of [`@electron/fiddle-core`](https://github.com/electron/fiddle-core) that keeps
only what Electron Fiddle uses: the `Installer` (one immutable folder per version, safe for
several processes sharing a cache), `Runner.spawn`, the release list and a few file helpers. It is
private, unpublished, and built from source through the `fiddle-source` export condition.

```sh
yarn workspace @electron/fiddle-core test       # vitest, offline
yarn workspace @electron/fiddle-core typecheck
```
