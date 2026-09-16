# Electron Fiddle Rewrite: Requirements

## 1. Scope

- **Feature parity.** Every feature, setting and keyboard shortcut in the Feature catalog (§17) is included.
  - Exception: the "Block Save / Save As" setting is replaced by customizable keybindings (§3).
- **UI.** The UI is built to the new design, with an in-house design system and component library:
  - Composable React components. Every screen is built from them.
  - Visual values (color, type, spacing and so on) come from design tokens. Themes can swap the tokens at runtime.
  - Components are added as screens need them, not planned up front.
  - The implementer decides the structure, the styling approach and the component API conventions.
- **Potential additions.** These are listed in §16.

## 2. Stack and tooling

- **Versions:**
  - Latest stable TypeScript, Electron, React, Vite and Vitest.
  - Electron Forge 8 from the start (alpha today), pinned exactly and moved to stable releases as they ship.
  - Latest Node.js for development and CI.
  - `core` supports every Node.js version fiddle-core supports, so it stays a drop-in replacement.
- **Pinning.** Forge, its plugins and Vite are pinned to exact versions. Each upgrade gets its own PR.
- **TypeScript:**
  - `strict` and `verbatimModuleSyntax` everywhere, targeting the latest ES version.
  - `packages/core`: `module` and `moduleResolution` are `nodenext`. It emits ESM and `.d.ts` behind `exports`, so it can be published as a drop-in later.
  - `packages/app`: `moduleResolution: bundler`. It resolves `core` from source through a custom export condition, and `tsc -b` uses project references.
- **Package manager.** Yarn (current major) with workspaces and `nodeLinker: node-modules`. `.yarnrc.yml` sets:
  - `enableScripts: false`, with an allowlist of packages that may run install scripts (at least `electron`).
  - `npmMinimalAgeGate: 7d`.
  - Dependabot uses a cooldown.
- **Bundling.** Vite, through Forge's Vite plugin.
  - Every Vite config is a standalone file that plain `vite build` can run, so the Forge plugin can be swapped for Forge packaging of prebuilt output.
  - All runtime JS is bundled, with no externals.
  - Files that must be spawned from disk (`sfw`) are copied to an unpacked location by an explicit build step, and a test checks that they exist.
- **Code generation.** `yarn generate` is offline and idempotent.
  - It produces EIPC bindings, JSON schemas, compiled i18n catalogs and typed i18n keys.
  - `dev`, `typecheck`, `lint`, `test` and Forge's `generateAssets` all run it.
  - Generated source is committed, and CI fails if regenerating it produces a diff.
- **Bundled data.** The Electron release list and the contributors list are committed snapshots, refreshed by a scheduled bot PR. A build with no network access succeeds.
- **Quality.** ESLint and Prettier. Lint, typecheck, unit and e2e tests run in CI on macOS, Windows and Linux.

## 3. Architecture

### Packages

```
packages/
  core/  In-repo, unpublished drop-in replacement for `@electron/fiddle-core`. No Electron, no UI.
  app/   Electron app: main (including fiddle logic and the headless CLI), preload, renderer, e2e driver.
```

- **`core` is a drop-in replacement for `@electron/fiddle-core`:**
  - It starts from fiddle-core's source and keeps everything fiddle-core's `index.ts` exports.
  - It keeps the `fiddle-core` CLI: `run`, `test`, `bisect`, and the `:msix` variants.
  - fiddle-core's own test suite runs against `core` in CI. That way `electron/electron`, `chromedriver`, `mksnapshot` and `website` could switch to it without code changes.
  - Improvements are additive, and any change in behavior is opt-in:
    - Immutable per-version installs, so several versions can be installed at once.
    - Cross-process cache locks.
    - `AbortSignal` cancellation, and typed errors with stable codes.
    - Injectable endpoints.
    - Control over the child environment (the denylist, user variables) and the inspector port.
  - Fixes landing in upstream fiddle-core are ported over until `core` replaces it.
  - `core` takes every option explicitly and owns a versioned cache root (§5).
- **Fiddle logic lives in the app's main process.** These modules never import `electron`, which lint enforces, so they run under plain Node in unit tests. They cover:
  - The fiddle model and validation, and `package.json` generation.
  - Built-in examples, templates, docs examples and gists.
  - Module installs and trust checks.
  - Forge export, package and make.
- **The app owns everything app-specific:**
  - UI, themes, settings and keybindings.
  - Windows, credentials, editor type definitions and npm search.
  - Local builds, updates and crash reporting.

### Processes

- **Main process:**
  - Runs `core`, the fiddle logic, windows, menus, dialogs, the `app://` protocol, `safeStorage` and the command registry.
  - Does only async I/O. CPU-heavy work (extracting Electron, hashing) runs on a worker thread.
- **Child processes.** Fiddle runs, module installs, and Forge package and make are all child processes.
- **Renderers.** Renderers are views. Each holds Monaco models and view-only UI state.

### State

- **Ownership.**
  - Main owns all state and is its only writer.
  - Renderers read state from EIPC stores and request changes through EIPC methods.
  - Only editor text and view-only UI state live outside the stores.
- **Two stores, one pattern:**
  - **`App`**: shared, with the same value in every window.
    - Settings (including keybinding overrides) and local builds.
    - Install state and download progress for each version.
    - `releasesRev` and the GitHub login.
  - **`Window`**: one per window.
    - The fiddle's source, Electron version, modules, and files (names and visibility).
    - `fiddleRev`, `dirty` and layout.
    - Status and progress of the window's operations.
  - **Stores stay small.** EIPC pushes the whole value on every update, so bulk data (fiddle text, the release list, the console backlog) is fetched with a method. The store holds only a revision number that tells the renderer to fetch again.
- **Changes.**
  - The renderer calls a typed method (`setSetting`, `setVersion`, `addFile`, `setLayout`, and so on) or runs a command.
  - Main validates the change (with the fiddle logic's rules), updates the store, persists persisted fields, and pushes the result.
- **Optimistic updates.** Renderers show changes immediately. Main stays the only source of truth.
  - Each store carries a `rev` that increases by one with every change main applies.
  - The renderer adds each change to a pending list and shows the latest store value with the pending changes replayed on top, using React's `useOptimistic` or an equivalent.
  - Each change method returns the store `rev` that includes the change. The renderer drops the pending entry once the store it has received reaches that `rev`, so the pending value is never overwritten by a stale push.
  - If main rejects a change, the call throws a `FiddleError`. The entry is dropped, the view falls back to the store value, and the error is shown.
  - Main applies changes in the order they arrive, and the last write wins. Other windows see a change when main pushes it.
  - Settings, layout, file-list and version-selection changes are optimistic. Starting an operation shows its pending state immediately, and the real status and progress come from main.
  - Continuous input stays local until it's committed: form fields on change or blur, splitters at the end of a drag.
- **Fan-out.**
  - One `StateHub` in main holds `App` and a `Map<windowId, Window>`, and it is the only caller of `update*Store`.
  - It sends `App` changes to every registered window and `Window` changes to their own window, coalescing pushes within a tick.
  - A window is unregistered when it is `destroyed`.
- **Window identity.** Main assigns each window a UUID `windowId` and binds every interface with `.for(webContents)`. Handlers close over that ID, so renderers never send one.
- **Reload.**
  - The webContents, its bindings and all of main's state, including running operations, survive a reload.
  - The reloaded renderer reads both stores, then fetches its files and the console backlog.
  - Only view state, undo history and cursor positions are lost.
- **Editor text:**
  - **Mirror.** Monaco models are the working copy. After each change the renderer sends the file's text with `editFile(name, text, fiddleRev)`, at most once per frame. Main keeps a mirror of every file and derives `dirty` by comparing the mirror with the last save.
  - **Sync.** The renderer keeps its Monaco models in step with `Window.files`, fetching text for new names with `getFiles` and disposing models whose names are gone.
  - **Loading a fiddle.** A new fiddle replaces the mirror and increments `fiddleRev`, and edits that carry an old `fiddleRev` are discarded. Startup, reload, load, add and rename all use this path.
  - **Consumers.** Save, publish, run and package read the mirror in main, so menus, deep-link prompts and the e2e driver never have to ask a renderer for text.
  - **After saving.** Save and publish reset the last-saved baseline and delete the draft.
- **Operations:**
  - **Start and cancel.** Starting an operation returns an `operationId`. Main holds its `AbortController`, and `cancel(operationId)` aborts it.
  - **Status and progress.** These are updated at most 10 times per second, in the store that owns the operation:
    - Run, bisect and package go in `Window`.
    - Downloads go in `App`.
  - **Closing a window** aborts that window's operations, but not downloads.
  - **Output.** Output is an `output` event, batched every 16 ms and capped at the source, and every line carries a sequence number. Main keeps the last 1000 lines per window for `getOutput()`, and renderers drop lines they already have.
- **Persistence:**
  - `App` → `settings.json` (keybinding overrides included) and `local-builds.json`. Releases and installs live in the `core` cache.
  - `Window` → a session entry in `state.json` (source, version, modules, layout). While the window is dirty, its mirror is saved as a draft.
  - Never persisted: operations, progress, output and view state. Credentials never enter a store.
- **Startup:**
  - Unless session restore is off, main reopens every window in `state.json` under its `windowId`. A window that had unsaved changes comes back with its draft.
  - Drafts from windows that aren't reopened are offered for restore.
  - A window is shown once its renderer reports both stores `ready`.

| EIPC primitive | Used for |
|---|---|
| Stores `App`, `Window` | All shared and per-window state, including operation status and progress |
| Methods | Change requests, commands, `editFile`, bulk fetches (`getFiles`, `getReleases`, `getOutput`), starting and cancelling operations |
| Events | `output` (batched logs), and `command` for handlers that act on Monaco or view state |

### Commands

- **Registry.** Every user action is a command in one registry in the app, with:
  - an ID and an i18n label key;
  - an accelerator for each platform;
  - an enablement predicate;
  - a handler.
- **Enablement.** Predicates are pure functions of `(App, Window)`. Main evaluates them for native menus, and renderers run the same code against their stores.
- **Handlers.** Handlers run in main. The few that act on Monaco or view state (format, toggle minimap, clear console) go to the window as a `command` event.
- **Invocation.** Native menus, context menus, the command palette, shortcuts, Monaco keybindings and the e2e tests invoke commands by ID.
- **Keybindings are customizable:**
  - Default keybindings live in the registry.
  - Only overrides are stored, under `keybindings` in `settings.json`: `{ [commandId]: accelerator | null }`. `null` unbinds a command.
  - Overrides can be scoped by context (editor, console, running).
  - Conflicts are detected.
  - Old "Block Save / Save As" settings become `null` overrides for Save and Save As.
- **Operation descriptors.** Every fiddle and `core` operation has one descriptor with zod input and output schemas and its error codes. CLI flags are generated from the descriptors.

### IPC

- **EIPC is the only path.**
  - IPC is defined in EIPC schemas (electron-ipc.com, `@marshallofsound/ipc`).
  - The generated bindings are the only IPC path. The one documented exception is Sentry's renderer transport (§14).
  - `ipcRenderer` is never exposed.
- **Errors.** App code on both sides uses ordinary `throw` and `try`/`catch`.
  - Errors are `FiddleError`s, with a stable `code` (shared with `core`), a `message` and optional `details`.
  - IPC can't carry an error's class or properties, so the transport layer carries them in one place:
    - Main wraps every handler, so a thrown error is serialized as `{ code, message, details }`. Unexpected errors become `code: "internal"`, and their stack is logged in main.
    - The renderer's binding wrapper re-throws that as a `FiddleError`.
  - A rejected optimistic change is handled by catching the call's error.
- **Validation.**
  - Every interface requires `origin is "app://main"` and `is_main_frame is true`.
  - Handlers still check what payloads mean, such as path containment and ID formats.
- **Dev and production differences.** Any difference in origins or CSP between dev and production is listed explicitly, and the dev-only behavior requires `is_packaged is false`.

## 4. Security

### Electron checklist

- **Web preferences:**
  - Every renderer runs with `nodeIntegration` off, `contextIsolation` on, `sandbox` on (`app.enableSandbox()`) and `nodeIntegrationInSubFrames` off.
  - `webSecurity` stays on.
  - Never used: `allowRunningInsecureContent`, experimental features, `enableBlinkFeatures`, `<webview>`.
- **Loading content:**
  - App content comes from `app://` via `protocol.handle`, registered as `standard`, `secure`, `supportFetchAPI` and `codeCache`. It is never registered with `bypassCSP`, and service workers are off.
  - The handler serves only files listed in the bundle manifest, each with the correct MIME type and `nosniff`.
  - `file://` is never loaded. The only exception is the one-time import (§6).
- **CSP.** Sent as a response header on every response, including worker scripts:
  - `default-src 'none'`, `script-src 'self'`, `worker-src 'self'`
  - `style-src 'self' 'unsafe-inline'` (Monaco needs inline styles)
  - `font-src 'self'`, `img-src 'self' data:`, `connect-src 'self'`
  - `frame-src 'none'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`, `frame-ancestors 'none'`
  - `require-trusted-types-for 'script'`, with the policy names listed and enumerated by a test.
  - An e2e test checks that Monaco's workers actually start.
- **Untrusted content.** Gist files, console output, gist descriptions and npm search results are only ever rendered as text or inside Monaco, never as HTML. Imported theme tokens are validated as colors and font names.
- **Permissions:**
  - Permission request and check handlers deny by default, and each grant is listed individually (for example, clipboard write).
  - Device requests, `setDisplayMediaRequestHandler` and `select-*-device` events are denied.
  - The spellchecker is off.
- **Navigation:**
  - `will-navigate`, `will-redirect` and `will-frame-navigate` block navigation.
  - `setWindowOpenHandler` denies new windows.
  - `will-attach-webview` blocks webviews.
- **External links.** `shell.openExternal` accepts only parsed http(s) URLs, and only after the user confirms.
- **Preload.** The preload checks `location.origin` and exposes nothing on other origins. Stores never carry secrets.
- **Fuses:**
  - Off: RunAsNode, `NODE_OPTIONS`, the `--inspect` CLI arguments, GrantFileProtocolExtraPrivileges.
  - On: OnlyLoadAppFromAsar, embedded asar integrity, cookie encryption.
- **Electron version.** Stay on a supported major. A patched release ships within 14 days of an Electron security release for that major.

### Trust model

- **Origins.** Every fiddle has an origin: `local`, `example`, `gist:<owner>/<id>@<sha>`, or `electron:<tag>/<path>`. A fiddle with a remote origin is untrusted until the user approves it.
- **Code-executing operations:** run, module install, auto-bisect, package and make.
- **First approval.** The first code-executing operation on an untrusted fiddle shows a native main-process dialog with its origin, files and dependencies.
- **Triggers.** Code-executing operations start only from the Run command (button, F5, menu, context menu), from auto-bisect, or from that native dialog.

### Fiddle processes

- **Environment:**
  - Built from the parent environment minus a denylist: `*_TOKEN`, `*_API_KEY`, `GITHUB_TOKEN`, `GH_TOKEN`, `NPM_TOKEN`, `NODE_AUTH_TOKEN`, `SENTRY_*`, the e2e driver variable, and app-internal variables.
  - Variables the user sets explicitly are then added, except `LD_PRELOAD` and `DYLD_*`.
  - `core` owns this code.
- **Inspector.** Binds to `127.0.0.1:0` (a random port), and the port is shown in the console.
- **Run directories.** Created with `mkdtemp` (mode 0700). Cleanup deletes only directories the run created.
- **Modules:**
  - A module must be a registry package name that passes npm naming rules, plus a semver range or dist-tag. Any other spec is rejected and listed in the load result.
  - Untrusted fiddles install with `--ignore-scripts`, unless the user allows scripts in the run approval. The approval lists the packages that have install scripts.
  - The Socket Firewall setting discloses that package names are sent to Socket.
- **macOS privacy permissions:**
  - A small signed helper spawns fiddle processes with responsibility disclaimed, so they don't inherit Electron Fiddle's privacy grants. This is verified on each supported macOS version.
  - The app drops the device and personal-data entitlements that only fiddles needed.
  - Settings has a "Reset privacy permissions" action.

### Credentials and GitHub

- **Sign-in.** Same as today:
  - Personal access token only: `ghp_` followed by 36 characters, or `github_pat_` followed by 22, `_`, then 59.
  - The token must have the `gist` scope. Sign-in fails with a specific message for a bad format, a missing scope or an invalid token.
  - The sign-in form links to GitHub's new-token page with the `gist` scope prefilled, and fills the field from the clipboard if the clipboard holds something token-shaped.
- **Token handling:**
  - The token stays in main. Renderers only know the login name.
  - It is sent only over https to `api.github.com` and the gist raw host, and `Authorization` is dropped on any cross-host redirect.
  - A check at startup deletes the token on a 401 or 403. If the check fails for any other reason, such as being offline, the token is kept.
  - Signing out deletes it.
- **Storage:**
  - `<userData>/credentials/github`, encrypted with async `safeStorage`.
  - On Linux, if the backend is `basic_text` or `unknown`, the token lasts only for the session unless the user explicitly accepts plaintext storage.
  - If decryption fails, the user is signed out with a notice and the file is kept.
- **Headless CLI.** It never reads the stored token, and uses `GITHUB_TOKEN` instead.

### Release integrity

- **Releases:**
  - Immutable GitHub releases, with a build-provenance attestation for every artifact.
  - A ruleset controls who can create `v*` tags.
  - The `release` environment requires a reviewer.
- **CI:**
  - Jobs that hold secrets or `id-token: write` never run dependency lifecycle scripts.
  - Only the Windows signing job can request OIDC tokens.
  - Actions are pinned by SHA, and every job gets minimal permissions.
- **Artifacts:**
  - The `sfw` binary is pinned by checksum.
  - The release job fails if the e2e driver is in `app.asar`.

## 5. Data model

### Locations

| Store | Path |
|---|---|
| Settings, including keybinding overrides | `<userData>/settings.json` |
| State: window sessions, recent items, first-run flags, `importedFrom` | `<userData>/state.json` |
| Local builds `{ id, name, path, addedAt }` | `<userData>/local-builds.json` |
| Credentials | `<userData>/credentials/` |
| Drafts | `<userData>/drafts/<windowId>.json` |
| Themes | `<userData>/themes/*.json` |
| Logs | `<userData>/logs/` |
| `core` cache: `electron/<version>/`, `releases.json`, `templates/`, `types/` | `<OS cache dir>/Electron Fiddle/cache-v1/` |

### Rules

- **Version references.** A version reference is a typed union: `{ kind: "release", version }` or `{ kind: "local", id }`.
- **File format.** Every file is JSON with a `schemaVersion`. Its schema is also the source of its TypeScript type.
- **Sparse settings.** Settings store only values that differ from the defaults, and the defaults live in code.
- **Invalid data:**
  - A JSON parse failure means the file is corrupt, and the corruption flow below applies.
  - A schema failure is handled per key: the invalid key is dropped in memory, logged and left on disk.
  - Schemas are loose, and unknown keys are kept unchanged.
- **Migrations:**
  - Additive changes don't bump `schemaVersion`.
  - A breaking change bumps it and gets a pure migration (`vN → vN+1`), tested with fixtures from every released version.
  - A file with a newer `schemaVersion` is opened read-only, and the user is told that changes won't be saved.
- **Writes:**
  - Each file has one serialized write queue that coalesces to the latest state.
  - Each write goes to a unique temp file, is fsynced, then renamed into place. On POSIX the directory is fsynced too.
  - On Windows, the rename is retried with backoff for up to 10 seconds on EPERM, EACCES or EBUSY.
  - The current file is copied to `.bak` before the swap.
- **Reads and corruption:**
  - Reads try the file, then `.bak`, then the defaults.
  - A corrupt file is moved to `<name>.corrupt-<timestamp>.json`, and the user is told.
- **Flushing.** Pending writes are flushed on quit (quit is held until the flush finishes), on `session-end`, and on `powerMonitor` `shutdown`.
- **Cache:**
  - Electron versions live in immutable per-version directories, filled by download, then extraction to a temp dir, then a rename. An entry is either complete or absent.
  - Locks are created with `O_EXCL` and store `{ pid, hostname, startedAt }`. A lock is stale when its PID is dead or it is older than 10 minutes.
  - The app and the CLI can use the cache at the same time, and tests cover this.
  - Deleting the cache never loses user data.
- **Drafts:**
  - A draft is written 500 ms after the last edit, and at most every 5 seconds during continuous editing.
  - Drafts are offered for restore after a crash, and deleted once the fiddle is saved, published or discarded.

## 6. Migration and continuity

- **One-time import.** The first launch runs an import that:
  - is idempotent;
  - finishes before any new settings are written;
  - records `importedFrom: { version, at }`;
  - never moves or deletes old files.
- **Old settings:**
  - Read from the old app's `file://` localStorage.
  - The reader is a hidden, sandboxed window with no preload and no IPC. It loads a blank page shipped in the asar, reads values with `executeJavaScript`, and is then destroyed.
  - Unknown keys are logged and ignored.
- **Other data:**
  - Electron versions are copied or hard-linked from `<userData>/electron-bin` into the cache.
  - Local builds are read from `local-versions.json` and given IDs.
  - The GitHub token is decrypted from `.github-credentials` and re-encrypted into `credentials/github`. The old file is left in place. Decryption works because the app identity is unchanged.
  - Themes are read from `~/.electron-fiddle/themes/`. Their Monaco editor colors are kept, and UI tokens come from the new design.
- **Identity checks in CI:**
  - `packages/app/package.json` keeps `name: electron-fiddle` and `productName: Electron Fiddle`.
  - CI asserts that these match the previous release: the deb, rpm and AppImage names, the nupkg ID, `CFBundleIdentifier`, the userData path, and the safeStorage service name.
- **Upgrade test in CI (macOS and Windows):**
  1. Install the latest published release.
  2. Seed it with fixture data, including an encrypted token.
  3. Update to the candidate through Squirrel from a local feed.
  4. Verify the import and that the credentials decrypt.
  5. Update the candidate to candidate+1.

  The test blocks publishing.

## 7. Headless CLI

- **Where it lives.** The CLI is a headless mode of the app's main process. It runs the same fiddle logic and `core` as the UI, so it behaves the same.
  - In the repo: `yarn fiddle <command>`, against the dev build.
  - From an installed app: `electron-fiddle --headless <command>` on macOS and Linux. On Windows this needs the console launcher from §16.
- **Headless mode:**
  - It is parsed before `requestSingleInstanceLock()`.
  - It never takes the lock, creates no windows and hides the Dock icon.
  - It never checks for updates or sends crash reports.
  - It never reads or writes the app's stores. Options come from flags, with the same defaults as the app.
  - It shares the `core` cache with the app.
- **Output and environment:**
  - Commands are generated from operation descriptors (§3).
  - Every command supports `--json`, and the JSON output carries a `schemaVersion`.
  - The locale comes from `LC_ALL`, `LC_MESSAGES` or `LANG`.
  - Network requests use `net.fetch`, so the system proxy and certificate store apply.
- **`run <fiddle>`:**
  - `<fiddle>` is a folder, a gist, `example:<name>` or `electron:<tag>/<path>`.
  - Options: `--version`, `--electron-path`, `--flag`, `--env`, `--module`, `--pm`, `--logging`.
  - The CLI exits with the fiddle's exit code.
  - Running a remote fiddle requires `--trust` or interactive confirmation.
- **Other commands:** `bisect`, `versions list|download|remove`, `gist load|publish|update|delete|history`, `export [--forge]`, `package`, `make`.
- **GitHub token.** Read from `GITHUB_TOKEN`. Stored app credentials are never used.

## 8. Deep links

- **Compatibility.** Every link the current app accepts keeps working, with the same meaning:

  | Link | Loads |
  |---|---|
  | `electron-fiddle://gist/<id>` | That gist |
  | `electron-fiddle://gist/<owner>/<id>` | That gist. The owner is informational |
  | `electron-fiddle://electron/<tag>/<path…>` | That folder of `electron/electron` at `<tag>` (used by the docs' "Open in Fiddle" links, e.g. `electron/v30.0.0/docs/fiddles/...`) |

  - On gist links, an optional `?revision=<sha>` loads that revision. Other query parameters, a trailing slash and a fragment are ignored.
  - The scheme and host are case-insensitive.
- **Grammar.** Links are parsed in main.
  - `<id>` is 32 hex characters, in any case.
  - `<owner>` is a valid GitHub login.
  - `<sha>` is 40 hex characters.
  - `<tag>` is an optional `v` followed by a semver version, and sets the Electron version.
  - `<path…>` is one or more segments. Empty segments, `.`, `..` and encoded separators are rejected.
  - Anything else shows an error that names the link.
- **Owner mismatch.** If the owner in the link doesn't match the gist's real owner, the confirmation shows a warning. The link isn't refused, because renamed accounts keep their old links.
- **Unknown hosts** show "This link needs a newer version of Electron Fiddle". New link forms are only ever added. Existing forms never change meaning.
- **Delivery:**
  - macOS: `open-url`, queued until the app is ready.
  - Windows and Linux: `argv`, both at cold start and on `second-instance`, on every platform.
  - A dev-mode equivalent exists.
  - An `electron-fiddle:` URL in `argv` is never treated as anything else.
- **Behavior:**
  - A link opens in the focused window if that window has no unsaved changes. Otherwise it opens in a new window.
  - Only one deep-link prompt can be pending at a time.
  - The native confirmation shows the owner's login, the description, the revision SHA, the files and the dependencies. Exactly that SHA is loaded: the one in the link, or else the latest revision when the prompt is shown.
- **Registration:**
  - macOS: via the app bundle.
  - Windows: Squirrel, and a `uap:Protocol` entry in the MSIX manifest.
  - Linux: the deb and rpm desktop entries. The AppImage offers to install a desktop entry.
- **Tests:**
  - A fixture list of real-world links (docs "Open in Fiddle" links, gist links with and without an owner) is parsed in unit tests.
  - E2E covers cold start and warm start for every package type.

## 9. Internationalization

- **Catalog:**
  - Every user-visible string lives in the catalog, with English as the source.
  - It covers the renderer, native menus (role items get explicit labels), dialogs, notifications, errors, the update prompt (`makeUserNotifier` with catalog strings) and human-readable CLI output.
- **Format:**
  - `i18next` and `react-i18next`, with i18next JSON v4 messages and CLDR plural rules.
  - Keys are typed. Sentences are never built by concatenating strings.
  - Every key has a description. Menu and button keys also have a maximum length.
- **Loading.** Startup never loads or parses a full catalog.
  - At build time, catalogs are compiled into small per-locale, per-namespace modules.
  - A window loads only the active locale's startup namespace before first paint. Other namespaces load lazily.
  - Main loads only its own namespace (menus and dialogs).
- **Never translated:** anything written to disk or GitHub, `--json` output, and error codes.
- **Locale selection:**
  - From `app.getPreferredSystemLanguages()`, with a setting to override it.
  - English is the fallback, key by key.
  - The fiddle logic and the headless CLI take an explicit `locale`.
- **Switching language:**
  - App strings and menus update immediately.
  - Monaco's language bundle (`nls.messages`) and Chromium's `--lang` apply after a relaunch, which the app offers.
- **Formatting and direction:**
  - Every `Intl` call passes the UI locale explicitly.
  - In right-to-left locales, the app chrome is mirrored using CSS logical properties. The editor, console and file names stay left-to-right.
- **Translation:**
  - LLMs do the translation.
  - `yarn i18n:translate` translates new and changed English keys, using key descriptions and a glossary of terms that stay untranslated or have fixed translations.
  - A bot PR runs it whenever English strings change.
- **Human corrections:**
  - Human corrections arrive as ordinary PRs.
  - Human-edited strings are marked as reviewed, and the translator never overwrites them. If the English source changes, they are flagged for re-review.
- **CI:**
  - Fails on missing or unused keys, placeholder or tag mismatches, and invalid plurals.
  - A pseudo-locale (accented, 40% longer, plus a right-to-left variant) runs in e2e.
  - A lint rule bans string literals in JSX and in menu and dialog definitions.
- **Packaging.** macOS declares the shipped locales in `CFBundleLocalizations`.

## 10. Accessibility

- **Target.** WCAG 2.2 AA.
- **Screen readers:**
  - A "Screen reader optimized" setting (auto, on or off). Auto follows `app.isAccessibilitySupportEnabled()` and its change event, and sets Monaco's `accessibilitySupport`.
  - Accessibility Help and an Accessible View are available for the editor and the console.
  - Streaming console output is announced when it completes, not line by line.
- **Keyboard:**
  - A tab-focus mode moves focus out of the editor, so the editor never traps the keyboard.
  - Every drag has a keyboard alternative and a single-click alternative.
- **Focus and motion:**
  - Focus is always visible and never obscured.
  - `prefers-reduced-motion` is respected.
- **Toasts:**
  - Toasts never cover the focused element.
  - Toasts with actions don't auto-dismiss.
  - A notification list keeps past toasts.
- **Contrast:**
  - Built-in high-contrast dark and light themes follow OS high contrast and `forced-colors`.
  - Imported themes below 4.5:1 for text or 3:1 for UI get a warning.
- **Zoom.** At 200% zoom in a 1280×800 window, nothing is lost.

## 11. Testing

- **Goal.** An agent can build, launch, drive and inspect the app and get a clear pass or fail. It must be fast and need no human help.
- **Unit and component tests.** Vitest, run with `yarn test`. `core` also runs fiddle-core's ported test suite.
- **End-to-end tests.** `yarn test:e2e` runs against a real build of the app, using a driver built in-house (no Playwright). The tests must achieve:
  - **Speed.** One command. The app is ready for its first interaction within seconds, and tests run in parallel.
  - **Driving the app like a user.** Find elements by accessible role and name. Click, type and press keys. Invoke commands by ID. Answer native dialogs.
  - **Seeing what the user sees.** Read an accessibility-tree snapshot, screenshots, window titles, console output, the state stores and the logs.
  - **Exploring.** The same capabilities are also available from a CLI that prints JSON. An agent can drive a running dev build interactively, not only through test files.
  - **No flakiness.** Tests wait for conditions and never sleep for fixed times. Background throttling is off.
  - **Isolation:**
    - Temporary userData and cache directories.
    - No real network: every endpoint points at local fixtures, and any other request fails the test.
    - OS side effects are stubbed.
    - Randomness, locale and time zone are fixed.
    - Fiddles run offline on an Electron that's already installed.
  - **Diagnosable failures.** A failure reports the step, the query, an accessibility snapshot, a screenshot and the logs, so it can be understood without rerunning it.
  - **Every platform.** Headless on Linux CI, and on macOS and Windows.
  - **Kept out of releases.** Test-only hooks are compiled only into test builds. CI checks that they're absent from release builds.
  - **Real keystrokes.** On each OS, at least one test presses real OS-level keys for the core shortcuts.
- **Coverage.** Every Feature catalog bullet has a stable ID. CI fails if any ID has no test that references it.
- **External checks:**
  - A nightly job checks the fixtures against the live services.
  - Before publishing, the packaged app is launched on each OS and runs one fiddle offline.

## 12. Packaging, signing and release

- **App identity.** Unchanged:
  - Product name "Electron Fiddle", executable `electron-fiddle`.
  - Bundle ID `com.electron.fiddle`, category `public.app-category.developer-tools`.
  - Protocol `electron-fiddle`.
  - Windows company name "Electron Community".
- **Build matrix:**
  - macOS: x64 and arm64.
  - Windows: x64 and ia32.
  - Linux: x64, arm64 and armv7l.
- **Windows:**
  - **Squirrel:** app name `electron-fiddle`, `noMsi`, a loading GIF and a setup icon.
    - Setup file: `electron-fiddle-<version>-win32-<arch>-setup.exe`.
    - Shortcuts and the protocol handler are re-registered on `--squirrel-updated`.
  - **MSIX:** identity `ElectronCommunity.ElectronFiddle`.
    - Publisher `CN=OpenJS Foundation, O=OpenJS Foundation, L=San Francisco, S=California, C=US`, which must match the certificate subject.
    - Ships an `.appinstaller` file.
  - **Signing:** Azure Trusted Signing.
    - CI signs in with OIDC (`azure/login`), and the Trusted Signing dlib uses that session.
    - SHA-256 hashes, timestamped with `http://timestamp.acs.microsoft.com`.
    - Account `OpenJS-CodeSigning`, profile `Electron`, endpoint `https://eus.codesigning.azure.net`.
    - With no signing variables set, builds are unsigned. With only some set, the build fails.
- **macOS:**
  - **Package:** zip.
  - **Signing:** hardened runtime, with `Developer ID Application: OpenJS Foundation, Inc. (UY52UFTVTM)`.
    - Helper apps are signed without entitlements.
    - The designated requirement accepts team IDs `UY52UFTVTM` and `LT94ZKYDCJ`. Accepting the second has a documented end date.
  - **Entitlements:** only what the app itself needs (§4).
  - **Notarization:** in CI, with an App Store Connect API key.
- **Linux:**
  - deb, rpm and AppImage.
  - Categories Development and Utility, and MIME type `x-scheme-handler/electron-fiddle`.
  - 1024px PNG and SVG icons.
- **Release flow:**
  - A `v*` tag starts it.
  - Each platform runs `publish --dry-run`. A final `--from-dry-run` creates a draft GitHub release on `electron/fiddle` with generated notes.
  - Tests, the upgrade test (§6) and the packaged smoke test (§11) must pass first.

## 13. Updates and rollout

- **Stable updates.** `update-electron-app` via `update.electronjs.org`, backed by GitHub releases on `electron/fiddle`.
  - Checks every hour, with the first check 10 seconds after launch.
  - The update prompt uses catalog strings.
  - Off in dev and test mode.
- **Beta updates.** Beta builds ship as GitHub prereleases, which `update.electronjs.org` never serves. A "Beta updates" setting switches the update source to a `StaticStorage` feed.
- **Rewrite rollout:**
  - The rewrite ships as a beta for at least 4 weeks.
  - Before any stable publish, Sentry release health for the beta must show at least 99.5% crash-free sessions.
- **Kill switch.** At startup the app fetches `update-policy.json` (`{ blockedVersions, minVersion, message }`). A blocked version shows a blocking notice.
- **Rollback.** A rollback is published as a higher-versioned build of the last good code. That code must stay buildable and signable.
- **MSIX and Linux:**
  - MSIX updates through `.appinstaller` (on launch, every 24 hours).
  - On Linux and MSIX, the app checks the GitHub releases API once a day and shows a non-modal "Update available" link.
  - MSIX installs keep their cache inside the MSIX container, and the docs say so.

## 14. Crash reporting, logs and performance

- **Sentry.** Runs in main and the renderer, with org `electronjs` and project `electron-fiddle`.
  - **Opt-out.** A "Send crash reports" setting is read before `Sentry.init` and disclosed on first run. Sentry is off in dev, in test and in headless mode.
  - **Integrations.** An explicit allowlist. `IPCMode.Classic` goes through the app's own preload.
  - **PII.** `sendDefaultPii` is off. The project doesn't store IP addresses. Console and net breadcrumbs are off.
  - **Scrubbing.** `beforeSend` and `beforeBreadcrumb` replace the home directory with `~`, strip gist IDs and URL query strings, and redact token patterns. A test verifies that fiddle contents, console output and env are never attached.
  - **Native crashes.** Main-process native crash dumps are never uploaded. Renderer dumps are uploaded only with the user's consent for each crash.
  - **Release naming.** The release string comes from `package.json` with no `v`, in both the Sentry setup and CI.
  - **Source maps.** Every build job uploads Debug-ID source maps.
- **Logs:**
  - Main writes JSON-lines logs to `<userData>/logs/`, rotating at 5 MB × 3. Entries have levels, and secrets are redacted.
  - Renderer logs are forwarded to main over EIPC.
  - The Help menu has Open Logs Folder and Copy Diagnostics (versions, OS, and settings without secrets).
- **Performance:**
  - Monaco and heavy panels load lazily. Long lists are virtualized.
  - The app is fully usable at the 600×600 minimum window size.

## 15. Dependencies

- **When to add one.** Only when it's obviously the right choice. Anything that fits in one small source file is written in-house. Every new dependency, dev dependencies included, needs a one-line justification in its PR.
- **Allowed at runtime:**

  | Dependency | Used for |
  |---|---|
  | `electron`, `react`, `react-dom` | Platform |
  | `react-aria-components` | Accessible, internationalized interactive primitives under the in-house design system |
  | `monaco-editor` | Code editor |
  | `@marshallofsound/ipc` | IPC (EIPC) |
  | `zod` | Operation descriptors, persisted-data schemas, EIPC `zod_reference` types |
  | `@electron/get`, `@electron-internal/extract-zip` | Electron downloads and extraction in `core` |
  | `semver` | Version ranges and sorting |
  | `i18next`, `react-i18next` | Translation |
  | `prettier` (standalone) | Formatting in the editor |
  | `@sentry/electron` | Crash reporting |
  | `update-electron-app` | Auto-update |
  | `sfw` | Installs through Socket Firewall |

- **`core`'s dependencies** start as fiddle-core's, and are trimmed to fit this policy.
- **Allowed for development:** Forge and its makers and plugins, Vite, Vitest, jsdom, TypeScript, ESLint, Prettier.
- **Written in-house:**
  - Visual components, split panes and list virtualization.
  - GitHub and npm-search clients built on `fetch`.
  - The e2e driver, Squirrel startup handling and shell-env loading.
  - Debounce, env-string parsing and the random-name word list.

## 16. Potential additions

- **AI integration.** Needs its own design pass. Scope includes:
  - Pluggable providers, with Claude first and an OpenAI-compatible adapter for other and local models.
  - An in-app assistant whose tools are fiddle operations. Each tool has a risk class and approval per call, and edits are reviewed as diffs.
  - Usage and cost visibility, and managed-policy controls.
- **MCP:**
  - `fiddle mcp`, a headless command that exposes operations as MCP tools. Tools are generated from operation descriptors, and remote sources and gist writes stay behind explicit flags.
  - An attach mode that drives the running app.
  - The assistant as an MCP client.
  - External agents over the Agent Client Protocol.
- **Console launcher.** A console-subsystem `fiddle.exe` on Windows, and a shell script on macOS and Linux, runs `--headless` and passes stdio and exit codes through.
- **Replace fiddle-core.** Publish `core` as the next major of `@electron/fiddle-core` and move its consumers over.
- **macOS window tabs.**
- **First run.** One screen for language, theme and optional setup, before the tour offer.
- **fiddle-core features to surface:**
  - Running a fiddle with a Windows app identity (`runWithIdentity`).
  - Running fiddles from a git repo URL.

## 17. Feature catalog

The features below describe the current app plus additions for the rewrite. Where anything here conflicts with §1–§16, §1–§16 win.

A desktop app for writing, running, sharing and packaging small Electron experiments ("fiddles").

### 1. Workspace

- A window contains:
  - A multi-file code editor. {#workspace.editor}
  - An output console. {#workspace.console}
  - A file list, grouped into Main, Preload, Renderer and Other (§17.3), and an npm module list. {#workspace.sidebar}
  - Controls for version, run, bisect and sharing. {#workspace.controls}
- Panels can be resized and hidden. {#workspace.panels}
- Multiple windows are supported, each with its own fiddle, Electron version and run. Settings stay in sync across windows. {#workspace.multi-window}
- The window title shows when there are unsaved changes. {#workspace.title-dirty}
- On macOS, double-clicking empty title bar space follows the system preference (minimize or zoom). {#workspace.mac-titlebar-dblclick}

### 2. Editors

- One code editor (Monaco) per visible file. {#editor.per-file}
- Panes can be rearranged, resized, maximized and hidden. Hiding a pane keeps its content. The layout can be reset. {#editor.panes}
- Each open file has a tab. Closing a tab hides its file, which stays in the file list. Dragging a tab onto the editor opens it in the main pane or in a second pane beside it. {#editor.tabs}
- Each pane shows an error or warning indicator taken from the editor's diagnostics. {#editor.diagnostics}
- Editor defaults: soft wrap on, minimap off, 2-space tabs. {#editor.defaults}
  - Soft wrap and minimap can be toggled per window. The toggles aren't saved. {#editor.wrap-minimap-toggle}
- Font family and size are configurable. Changes apply after a reload, and a "reload all windows" action is provided. {#editor.font}
- IntelliSense uses type definitions for the selected Electron version:
  - `electron.d.ts` from unpkg (`electron` or `electron-nightly`), cached per version and cleared when that version is removed. {#editor.types-electron}
  - `@types/node` for that Electron's Node version, cached. If the exact version doesn't exist, the newest in the same major is used. {#editor.types-node}
  - Local builds read `<build>/gen/electron/tsc/typings/electron.d.ts` and reload live when it changes. {#editor.types-local}
- Prettier formatting for JS, HTML and CSS: current document, selection, or all open editors. {#editor.format}
- Go to/Peek Definition, Find References. {#editor.navigation}
- Clicking a link in an editor or in the console asks before opening it in the browser. {#editor.link-confirm}

### 3. Fiddle file model

- Allowed extensions: `.cjs .js .mjs .html .css .json` (any case). Names with path separators are rejected. {#files.extensions}
- Files can be added, renamed, deleted, shown and hidden. {#files.operations}
- Clicking a hidden file in the file list shows it and focuses it. {#files.show-hidden-on-click}
- **Groups:** the file list groups files by name alone (any case); a file's group changes nothing about how it runs. Main, Preload and Renderer always show; Other shows only when it has files. {#files.groups}
  - Main: the main entry, and helper scripts named `main-*` or `main.*`, such as `main-menu.js`. Helpers don't count as main entries.
  - Preload: `preload.js` (`.cjs`, `.mjs`) and scripts named `preload-*` or `preload.*`.
  - Renderer: every `.html` and `.css` file, `renderer.js` (`.cjs`, `.mjs`) and scripts named `renderer-*` or `renderer.*`.
  - Other: everything else, such as `.json` files, `utils.js` or `worker.js`.
- Each group head has an add button (besides the list's own "Add file"). It opens the new-file prompt with a one-line hint of the group's names and a free name filled in: the group's own name (`preload.js`, `renderer.js`), else the first free `preload-2.js`, `preload-3.js`, …; Main gets `main-2.js` onward, since the entry exists, and Other starts empty. The typed name decides the group, and validation is the same as for any new file. {#files.add-in-group}
- **Validation rules:**
  - No duplicate names. {#files.no-duplicates}
  - `package.json` and `package-lock.json` are reserved. {#files.reserved-names}
  - Exactly one main entry point (`main.js`, `main.cjs` or `main.mjs`). {#files.one-main}
  - The main entry can't be deleted. {#files.main-undeletable}
- An empty `main.js` is added when a folder, template or example has no main entry, and before publishing a gist. {#files.add-main}
- New files get a placeholder comment for their language. Files that are empty or contain only the placeholder load hidden. {#files.placeholder}
- **Unsaved changes:**
  - Tracked by comparing every file's content, hidden files included, with the last save. {#files.dirty-tracking}
  - Replacing the fiddle, closing the window or quitting with unsaved edits asks for confirmation. {#files.dirty-confirm}
- **Generated `package.json`** (for save, publish, run, package and make):
  - Fields: name, productName, description (a fixed placeholder, because Forge's deb, rpm and Squirrel makers need one), keywords (empty), main = the entry file, version "1.0.0", author (from settings), `start: "electron ."`. {#files.pkg-fields}
  - `dependencies` = the modules. {#files.pkg-deps}
  - `devDependencies.electron` (or `electron-nightly`) = the selected version. {#files.pkg-electron}
- **Project name:** the local folder name, or a random 3-word name. {#files.project-name}

### 4. Starting points and loading

- **Default template:**
  - Downloaded per major version from `github.com/electron/minimal-repro/archive/<major>-x-y.zip` and cached in `<userData>/Templates`. When minimal-repro has no branch for a major yet (a 404), the miss is remembered for a day, so the archive isn't requested again on every new fiddle and launch. {#load.template-download}
  - Unreleased majors, majors without a minimal-repro branch, local builds and failed downloads use a bundled quick-start (main, preload, index.html, renderer). {#load.template-fallback}
- **New fiddle:** the template for the current version. Clears the modules and the console. {#load.new-fiddle}
- **New test:** the `test-template` branch of minimal-repro. {#load.new-test}
- **Changing version:** if the fiddle is an unedited template, the new version's template replaces it. {#load.template-swap}
- **Built-in API examples ("Show Me"):** each API below has a bundled, runnable example. The one currently loaded is marked. {#load.examples}
  - App, AutoUpdater, BrowserView, BrowserWindow, Clipboard, ContentTracing, Cookies, CrashReporter.
  - Debugger, DesktopCapturer, Dialog, GlobalShortcut, IPC, Menu, NativeImage, Net.
  - Notification, PowerMonitor, PowerSaveBlocker, Screen, Session, Shell, SystemPreferences, TouchBar.
  - Tray, utilityProcess, WebContents, WebContentsView, WebFrame.
- **Load a gist by URL or ID:**
  - Accepts `gist.github.com/[user/]<id>` or a bare ID. The first 32-hex substring is used. {#load.gist-id-parse}
  - Shows the URL of the gist currently loaded. {#load.gist-url-shown}
  - Opened from the File menu (CmdOrCtrl+Shift+O), an icon button in the title bar left of Publish, or the gist menu. {#load.gist-open-button}
  - Fills the field, selected, from the clipboard if the clipboard holds nothing but a gist URL or ID. Main reads the clipboard. {#load.gist-open-clipboard}
- **Electron docs examples:**
  - Take a path and a tag, e.g. `docs/fiddles/...` at `v30.0.0`. {#load.docs-example}
  - Files are fetched from `electron/electron` at that tag and laid over the starter template. {#load.docs-example-files}
  - The matching version is selected and downloaded if needed. If its release channel is hidden, the app offers to enable it. {#load.docs-example-version}
- **Deep links (`electron-fiddle://`):**
  - `gist/<id>`, `gist/<owner>/<id>`, and `electron/<tag>/<path>`. {#load.deep-link}
  - Deep links and docs examples ask for confirmation before loading, because the code is untrusted. {#load.deep-link-confirm}
  - A private gist waits until the GitHub sign-in is restored. {#load.deep-link-private}
- **Loading a gist:**
  - Works while signed out, for public gists. Truncated large files are fetched in full. {#load.gist-public}
  - A specific revision can be loaded. {#load.gist-revision}
  - Unsupported files are skipped, and the app asks before adding unknown supported files. A gist with no supported files is an error. {#load.gist-files}
  - `package.json` dependencies become modules. With no `package.json`, the previous modules are kept. {#load.gist-modules}
  - An `electron` dependency sets the version, with range prefixes stripped. The current version is kept, with a warning, if that version is invalid, unreleased, or can't run on this OS/architecture. {#load.gist-version}
- **Opening a local folder** (Open dialog, OS recent documents, macOS open-file):
  - Reads the supported top-level files. `package.json` sets the modules and version as for gists; only semver validity is checked. {#load.folder}
  - Invalid JSON shows an error, and the rest of the folder still loads. {#load.folder-invalid-json}
- **Offline:** load errors say the computer seems to be offline. {#load.offline}

### 5. Saving and exporting

- **Save and Save As:**
  - Save writes to the current folder, asking for one the first time. Save As always asks. {#save.save}
  - The folder picker can create folders. {#save.create-folder}
  - The user is warned before overwriting a folder that already contains supported files. {#save.overwrite-warning}
- **What is written:**
  - Files with empty content are deleted from disk. {#save.empty-files}
  - Every save writes a `.gitignore` (`node_modules`, `out`). {#save.gitignore}
- **Save as Forge Project** also adds Electron Forge config:
  - `license: MIT`. {#save.forge-license}
  - `@electron-forge/cli` and the squirrel, zip (darwin), deb and rpm makers. {#save.forge-makers}
  - start, package, make and publish scripts. {#save.forge-scripts}
  - `forceABI` for nightlies, and `plugin-local-electron` for local builds. {#save.forge-local}
- **Gist ↔ folder link:**
  - Saving to a new folder unlinks the gist. {#save.unlink-gist}
  - Publishing a gist unlinks the folder. {#save.unlink-folder}
  - Deleting a gist marks the fiddle unsaved. {#save.gist-delete-dirty}

### 6. Running

- **Run/Stop control states:** checking, downloading (with progress), unzipping, installing modules, ready, running. {#run.states}
- **Starting a run:**
  - Only a click on the Run control, the Run menu item (F5), the context menu or auto-bisect can start a run. Fiddle code and page scripts can't trigger one. {#run.start}
  - The Run menu item is disabled while the focused window is running. A second run in the same window is ignored. {#run.single}
- **Steps:**
  1. Open the console, clearing it first if that's enabled. {#run.open-console}
  2. Write the files and `package.json` to a new temp dir. {#run.temp-dir}
  3. If the fiddle has modules, install them with `npm install -S` or `yarn add`. Socket Firewall wrapping is optional. {#run.install-modules}
  4. Spawn `electron <dir> --inspect <user flags>`, with the app's env plus the user's env vars. {#run.spawn}
- **Environment variables:**
  - Entries that can't be parsed show an error and are skipped. Empty flag and env entries are dropped. {#run.env-parse}
  - Blocked: `LD_PRELOAD`, `DYLD_INSERT_LIBRARIES`, `DYLD_FRAMEWORK_PATH`, `DYLD_LIBRARY_PATH`. {#run.env-blocked}
  - "Advanced logging" sets `ELECTRON_ENABLE_LOGGING`, `ELECTRON_DEBUG_NOTIFICATIONS` and `ELECTRON_ENABLE_STACK_DUMPING`. {#run.advanced-logging}
- **Output:** reports the start (version and app name), streams stdout and stderr, then reports the exit code or signal. {#run.output}
- **Results:**
  - Success: exit code 0. {#run.result-success}
  - Failure: non-zero exit, a signal, a spawn failure, or a module install failure. {#run.result-failure}
  - Invalid: the pre-run checks fail (see below). {#run.result-invalid}
- **Pre-run checks that refuse the run:**
  - The selected version is unusable, e.g. not downloaded or a missing local build. {#run.check-version}
  - `main.mjs` on Electron below 28. {#run.check-esm}
  - Modules need installing but the package manager is missing. The error links to install instructions. {#run.check-pm}
- **Stop:** SIGTERM, then SIGKILL after 1 second. {#run.stop}
- **Cleanup:** the temp dir is deleted. The fiddle's userData dir is deleted too, unless "keep user data dirs" is on. {#run.cleanup}
- **Package / Make (Electron Forge):**
  - Opens the console and requires the package manager. {#run.package-console}
  - Applies the Forge transform, then runs `<pm> install` (through Socket Firewall when that setting is on, as for a run's modules) and `<pm> run package|make`. {#run.package-steps}
  - Reveals `out/` in the file manager. {#run.package-reveal}

### 7. Output console

- Hidden by default. Opens automatically on run, package and make. Can be toggled, or hidden by dragging its splitter closed. {#console.visibility}
- Read-only lines with timestamps. Keeps the last 1000 entries and auto-scrolls. {#console.lines}
- Filters out Node inspector banner lines. On Windows, output is buffered line by line. {#console.filter-banner}
- Can be cleared with a shortcut (while the console has focus), from the context menu, or automatically on each run (setting). {#console.clear}

### 8. Electron versions

- **Release list:**
  - Bundled with the app, cached in userData. {#versions.bundled-list}
  - Refreshed from electronjs.org at startup and on demand. {#versions.refresh}
- **Channels:** Stable, Beta (includes alpha), Nightly. {#versions.channels}
- **Obsolete versions:** majors older than the oldest supported major. The `NUM_STABLE_BRANCHES=N` env var overrides the cutoff to the last N stable majors. {#versions.obsolete}
- **Downloads:**
  - Any single version can be downloaded or deleted. Files are stored in `<userData>/electron-bin`. {#versions.download}
  - "Download all" fetches the versions currently visible, one at a time, and can be stopped. {#versions.download-all}
  - "Delete all" removes every download and unregisters every local build except the active version. {#versions.delete-all}
  - Progress and install state (missing, downloading, downloaded, installing, installed) show wherever the version appears. {#versions.install-state}
- **Platform limits:** versions a platform can't run are disabled (macOS arm64 below 11, Windows arm64 below 6.0.8). {#versions.platform-limits}
- **Version picker:**
  - Searchable. Local builds come first, then releases newest first. Within the same x.y.z: nightly < alpha < beta < stable. {#versions.picker}
  - Can copy a version number. {#versions.picker-copy}
  - Disabled while running or bisecting. {#versions.picker-disabled}
- **Local builds:**
  - Added by picking a folder, which must contain an Electron binary. {#versions.local-add}
  - A name is suggested from the path, e.g. "gn/main - testing". {#versions.local-name}
  - Picking an already registered folder offers to switch to it. {#versions.local-duplicate}
  - A build whose binary is missing is marked unavailable. {#versions.local-missing}
  - Stored in `<userData>/local-versions.json`. {#versions.local-storage}
- **Selection:**
  - The last-used version is remembered. The default is the latest stable. {#versions.selection-default}
  - An unknown or failed version shows an error and falls back to the first usable one. {#versions.selection-fallback}
  - The active version can't be removed. {#versions.active-undeletable}
- **Download mirrors:**
  - Default: GitHub releases. {#versions.mirror-default}
  - China: npmmirror.com, which is the default when the locale is zh-CN. {#versions.mirror-china}
  - Custom: two URLs, one for releases and one for nightlies. {#versions.mirror-custom}
- **Offline:** going back online retries the current version's download. {#versions.offline-retry}

### 9. Bisect

- **Range:** choose a known-good (earlier) version and a known-bad (later) version from the visible version list. {#bisect.range}
  - Defaults: the 11th visible version and the newest. {#bisect.range-defaults}
  - The earlier version must be older than the later one. {#bisect.range-order}
- **Manual:**
  - Switches to the midpoint version. The user marks it Good or Bad, or Skips it, which picks a random version in the range. {#bisect.manual-step}
  - Each step stops the running fiddle. {#bisect.manual-stop}
  - Ends by showing the good...bad range and `github.com/electron/electron/compare/v<good>...v<bad>`. {#bisect.manual-result}
- **Auto:**
  - A binary search that runs the fiddle on each version. Exit code 0 counts as good. {#bisect.auto}
  - Every step is logged. An invalid run aborts the bisect. {#bisect.auto-log}
  - Both ends are re-verified, then the range and the compare URL are reported. {#bisect.auto-verify}

### 10. npm modules

- Search npm through Algolia: top 5 results, debounced, with matches highlighted. {#modules.search}
- A chosen search result is added at its latest version. {#modules.add}
- Each module's version can be changed from its full version list. Modules can be removed. {#modules.edit}
- Non-semver versions such as `*` are normalized to the latest. {#modules.normalize}
- npm or yarn is found on PATH. On macOS and Linux the PATH comes from the login shell. {#modules.find-pm}

### 11. GitHub and gists

- **Sign-in:**
  - Personal access token only (`ghp_…` or `github_pat_…`), with the `gist` scope. {#gist.sign-in-token}
  - Offers a link to GitHub's new-token page with that scope prefilled. {#gist.sign-in-link}
  - Fills the field from the clipboard if the clipboard holds something that looks like a token. {#gist.sign-in-clipboard}
- **Token storage:**
  - Encrypted with OS safe storage in `<userData>/.github-credentials` (mode 0600). Sign-in fails if encryption is unavailable. {#gist.token-encrypted}
  - The UI only knows the login name. {#gist.token-login-only}
  - The startup check deletes the token on a 401 or 403. When the check fails for other reasons, such as being offline, the token is kept. {#gist.token-startup-check}
  - Signing out deletes it. {#gist.sign-out}
- **Publish:**
  - Asks for a description (1–256 characters, default "Electron Fiddle Gist"). {#gist.publish-description}
  - The gist can be secret or public. Secret is the default, and the choice is remembered. {#gist.publish-visibility}
- **Publish as revision** (setting): creates the gist from the default template first, then updates it with the real files, so the gist history shows a diff. {#gist.publish-revision}
- **Update:** syncs the files and deletes remote files that were removed locally. {#gist.update}
- **Delete:** deletes the gist. {#gist.delete}
- Publish, update and delete prompt for sign-in first if needed. {#gist.sign-in-prompt}
- **Results:**
  - Success offers "copy link". {#gist.result-copy-link}
  - Failure shows the GitHub error and a hint about connectivity or ownership. {#gist.result-error}
- **Limits:** 300 files, 10 MB per file. {#gist.limits}
- **Revision history:**
  - Lists revisions ("Created", "Revision N") with SHA, date and +/− counts, and marks the active one. {#gist.history}
  - Revisions with no changes are hidden, except the first. {#gist.history-hide-empty}
  - Any revision can be loaded. {#gist.history-load}

### 12. Themes

- Built-in dark and light themes. Can follow the OS light/dark setting live. {#themes.builtin}
- **Custom themes** are JSON files in `~/.electron-fiddle/themes/`: {#themes.custom}
  - `name` and `isDark`. {#themes.custom-meta}
  - `editor`: Monaco theme data. {#themes.custom-editor}
  - `common`: UI color and font tokens, applied as CSS variables. {#themes.custom-tokens}
- **Theme actions:**
  - Import a Monaco theme JSON (must have `base` or `rules`). {#themes.import}
  - Create a theme file from the current theme. {#themes.create}
  - Open the themes folder. {#themes.open-folder}
- A theme also sets the native light/dark mode. {#themes.native-mode}

### 13. Settings

Settings are saved locally and sync live across windows. {#settings.persist-sync}

| Area | Setting | Default |
|---|---|---|
| Appearance | Follow system light/dark | on {#settings.follow-system} |
| | Theme | built-in dark {#settings.theme} |
| | Editor font family / size (+ reload windows) | unset {#settings.editor-font} |
| Console | Clear console on run | off {#settings.clear-console} |
| GitHub | Sign in / out | — {#settings.github-account} |
| | Publish as revision | on {#settings.publish-revision} |
| | Gist visibility | secret {#settings.gist-visibility} |
| | Show gist revision history | on {#settings.gist-history} |
| | package.json author | OS username {#settings.package-author} |
| Shortcuts | Block Save / Save As (so a fiddle can use those keys itself) | off {#settings.block-save} |
| Electron | Mirror: Default / China / Custom | locale-based {#settings.mirror} |
| | Release channels shown: Stable, Beta, Nightly (the current version's channel can't be unchecked) | Stable + Beta {#settings.channels} |
| | Show not-downloaded versions | on {#settings.show-not-downloaded} |
| | Show obsolete versions | off {#settings.show-obsolete} |
| | Version manager: filter, download/delete each, download all/stop, delete all, add local build, refresh list | — {#settings.version-manager} |
| Execution | Keep user data dirs | off {#settings.keep-user-data} |
| | Advanced Electron logging | off {#settings.advanced-logging} |
| | Extra Electron flags (list) | empty {#settings.electron-flags} |
| | Environment variables (list of `KEY=value`) | empty {#settings.env-vars} |
| | Package manager: npm / yarn | npm {#settings.package-manager} |
| | Use Socket Firewall for installs | on {#settings.socket-firewall} |
| Credits | Contributor list (from `static/contributors.json`) | — {#settings.credits} |

### 14. Keyboard shortcuts

| Action | Shortcut |
|---|---|
| New Fiddle | CmdOrCtrl+N {#keys.new-fiddle} |
| New Test | CmdOrCtrl+T {#keys.new-test} |
| New Window | CmdOrCtrl+Shift+N {#keys.new-window} |
| Open | CmdOrCtrl+O {#keys.open} |
| Open gist | CmdOrCtrl+Shift+O {#keys.open-gist} |
| Save | CmdOrCtrl+S {#keys.save} |
| Save As | CmdOrCtrl+Shift+S {#keys.save-as} |
| Preferences | CmdOrCtrl+, {#keys.preferences} |
| Run Fiddle | F5 {#keys.run} |
| Clear console (console focused) | CmdOrCtrl+K {#keys.clear-console} |
| Toggle Bisect Helper | CmdOrCtrl+Shift+B {#keys.bisect} |
| Toggle DevTools | CmdOrCtrl+Option+I {#keys.devtools} |
| Reload | CmdOrCtrl+R {#keys.reload} |
| Actual size / Zoom in / Zoom out | CmdOrCtrl+0 / CmdOrCtrl+Plus / CmdOrCtrl+- {#keys.zoom} |
| Full screen | Ctrl+Cmd+F (macOS), F11 (others) {#keys.fullscreen} |
| Minimize / Close window | CmdOrCtrl+M / CmdOrCtrl+W {#keys.minimize-close} |
| Undo / Redo / Select All (routed to the editor) | CmdOrCtrl+Z / Shift+CmdOrCtrl+Z / CmdOrCtrl+A {#keys.edit} |
| Cut / Copy / Paste | standard {#keys.clipboard} |
| Hide / Hide Others / Quit (macOS) | Cmd+H / Cmd+Shift+H / Cmd+Q {#keys.mac-app} |
| Close Settings | Esc {#keys.close-settings} |
| Confirm input dialog | Enter {#keys.confirm-dialog} |
| New file name: create / cancel | Enter / Esc {#keys.new-file-name} |

**Menu actions with no shortcut:**
- Publish to Gist, Save as Forge Project, Package, Make installers. {#keys.menu-file}
- Toggle soft wrap, Toggle minimap. {#keys.menu-editor}
- Show welcome tour, Open the project/Electron repos and the issue tracker, About. {#keys.menu-help}

**Context menu:**
- Everywhere: Run, Clear Console, Cut/Copy/Paste. {#keys.context-menu}
- In editors, also: definition, reference and format commands. {#keys.context-menu-editor}
- In dev mode, also: Inspect Element. {#keys.context-menu-inspect}

### 15. Onboarding

- First launch offers a guided tour of the main UI areas. An optional extra segment walks through the main, HTML and renderer files. {#onboarding.tour}
- The offer returns on each launch until the tour is dismissed or finished. {#onboarding.offer-repeat}
- The tour can be replayed from Help. {#onboarding.replay}

### 16. App platform behavior

- **Instances and windows:**
  - Single instance: a second launch forwards any `electron-fiddle://` argument to the running app. {#platform.single-instance}
  - Closing the last window quits the app, except on macOS. {#platform.quit-last-window}
  - Quitting with unsaved changes asks for confirmation. {#platform.quit-confirm}
- **Navigation:** in-app navigation and `window.open` are blocked. http(s) links open in the default browser. {#platform.navigation}
- **Protocol registration for `electron-fiddle://`:**
  - macOS: via the app bundle. {#platform.protocol-mac}
  - Linux: via the deb/rpm desktop entry. {#platform.protocol-linux}
  - Windows: via the Squirrel install. {#platform.protocol-windows}
- **macOS first run:** offers to move the app to /Applications. {#platform.mac-move}
- **Auto-update** from GitHub releases (`electron/fiddle`): checks every hour, with the first check 10 seconds after launch. {#platform.auto-update}
- **Crash reporting:** Sentry, off in dev mode. {#platform.crash-reporting}
- **About panel:** app and Electron versions, contributors, website. {#platform.about}
- **Distribution:**
  - Windows: Squirrel installer and MSIX. {#platform.dist-windows}
  - macOS: signed, notarized zip. {#platform.dist-mac}
  - Linux: deb, rpm, AppImage. {#platform.dist-linux}

### 17. New in the rewrite

- **Command palette.** CmdOrCtrl+Shift+P searches commands (showing their keybindings), files, versions and examples. Monaco's F1 palette is merged into it. {#new.palette}
- **Session restore.** Reopens every window from the last session, with its fiddle, version and layout. A setting turns it off (default on). {#new.session-restore}
- **Windows:**
  - Opening a folder that's already open focuses its window. {#new.focus-open-folder}
  - Recent items are mirrored to the Windows jump list and the macOS dock menu. {#new.recent-items}
  - Long operations show progress on the taskbar or dock icon. {#new.taskbar-progress}
  - A system notification is sent when a long operation finishes while the app is in the background. {#new.notification}
- **Opening and sharing:**
  - Dropping a folder or a gist URL on a window or on the dock icon opens it. {#new.drop-open}
  - "Copy share link" produces an https URL. The URL redirects to `electron-fiddle://`, and shows the gist if the app isn't installed. {#new.share-link}
  - Deep links accept an optional `?revision=<sha>`. {#new.deep-link-revision}
- **Settings:**
  - Search. {#new.settings-search}
  - Values that differ from their default are marked, and each can be reset. {#new.settings-reset}
  - "Open settings.json". {#new.settings-open-json}
  - Import and export. {#new.settings-import-export}
