# Build ledger

## Milestones

| # | Milestone | Status |
|---|---|---|
| 0 | Branch set up, spec and design assets in place | done |
| 1 | Scaffold: Yarn workspaces, Forge 8, Vite, React, TypeScript, Vitest, ESLint, EIPC wired, app window per Lucent | in progress |
| 1 | `packages/core`: fiddle-core port with its tests green, plus additive improvements | in progress |
| 1 | Design system: tokens, fonts, icons, components, gallery | in progress |
| 2 | Main foundation: StateHub, stores, persistence, command registry, menus, protocol, security | todo |
| 2 | Fiddle logic: model, validation, templates, examples, gists, modules, Forge export, trust, deep links | todo |
| 2 | App shell to Lucent window anatomy: title bar, sidebar, sheet, tabs, Monaco, console, status bar | todo |
| 2 | Test mode, e2e driver, `yarn driver`, fixture server | todo |
| 3 | Features: run, versions, bisect, gists, settings, themes, modules, deep links, palette, session restore, onboarding | todo |
| 4 | i18n, accessibility, headless CLI, migration, Sentry, updates, packaging, CI | todo |
| 5 | Verification: acceptance checklist, feature coverage, critique passes | todo |

## Wave 2: ownership and contracts

Parallel agents share this checkout, and each owns only the files listed for its slice.

**Shared files.** Several agents append to these. Always re-read before you edit, make small append-only edits, and never reformat others' code:
- `src/shared/stores.ts`
- `src/ipc/fiddle.eipc`: one `interface <Feature>` per slice, bound in `src/main/ipc.ts`
- `src/shared/commands.ts`
- `src/main/app-commands.ts`
- `src/main/menu.ts`

**Rules for everyone:**
- Run `yarn generate` only as `flock /tmp/fiddle-2027-generate.lock yarn generate`.
- i18n strings go in your own namespace, `src/i18n/locales/en/<slice>.json`.
- Everything under `packages/app/src/`.
- Main-process strings:
  - Command labels go in `locales/en/main.json`, as small append-only keys, because `CommandDefinition.label` is typed against `main`.
  - Every other main-process string (dialogs, notices, notifications) goes in your own namespace, named `main<Slice>.json` (for example `mainDocuments.json`). Main's i18n loads these automatically. Translate with `tm('mainDocuments')(key)` from `src/main/i18n.ts`.
  - Namespace names must be valid identifiers, so use camelCase, not hyphens.
  - Never create a second i18next instance.

**Slices:**

| Slice | Owns | Provides to others |
|---|---|---|
| Shell | `renderer/App.tsx`, `renderer/shell/**`, `renderer/editor/**`, `renderer/features/files/**`, `main/popout.ts` | The layout, with slots for the components below. Monaco setup. Tabs, split and pop-out. The sidebar file tree. Theme and material classes. Mounts for DialogHost and Toaster. |
| Documents | `main/documents/**`, `renderer/features/documents/**` | Fiddle state in the `Window` store, the editor mirror, drafts, and session restore. New, open, save and save-as flows, templates, Show Me, gist and docs-example loading, and deep links. Trust approval. Unsaved-change prompts. The File menu. |
| Versions and run | `main/versions/**`, `main/run/**`, `main/bisect/**`, `main/packaging/**`, `main/types/**`, `renderer/features/{versions,run,bisect}/**` | `VersionPicker`, `RunButton`, `ConsolePane`, `RunStatus`, `VersionManager` (for Settings). Error markers for tabs, sidebar and editor. |
| Gists | `main/github/**`, `renderer/features/gists/**` | `PublishButton` and its menu. Publish, history, open-gist and sign-in dialogs. `GitHubAccountSection` (for Settings). |
| Settings | `main/persistence/**`, `main/settings/**`, `main/themes/**`, `renderer/features/settings/**` | `createJsonStore()`, the atomic JSON store everyone uses. The settings schema and defaults in `shared/settings.ts`. `SettingsPage`. Themes. Keybinding overrides. |
| App UX | `main/ux/**`, `main/modules/**`, `renderer/features/{palette,packages,onboarding}/**` | `CommandPalette`, `PackagesSection` (npm search and modules), the onboarding tour, notifications, taskbar and dock progress, the jump list and dock menu. |
| Test infrastructure | `main/test-driver/**`, `packages/app/e2e/**`, `packages/app/tools/driver*`, the fixture server | Test mode, the e2e driver, `yarn driver`, `yarn test:e2e` |

**Slot contract.** The shell imports these by these exact names. If a file doesn't exist yet when you need it, create a minimal stub that you own until its real owner replaces it.

| Component | File |
|---|---|
| `VersionPicker` | `renderer/features/versions/VersionPicker.tsx` |
| `RunButton` | `renderer/features/run/RunButton.tsx` |
| `ConsolePane` | `renderer/features/run/ConsolePane.tsx` |
| `RunStatus` | `renderer/features/run/RunStatus.tsx` (status-bar content) |
| `PublishButton` | `renderer/features/gists/PublishButton.tsx` |
| `PackagesSection` | `renderer/features/packages/PackagesSection.tsx` |
| `SettingsPage` | `renderer/features/settings/SettingsPage.tsx`, shown in the sheet when `Window.view === 'settings'` |
| `CommandPalette` | `renderer/features/palette/CommandPalette.tsx` |

**Window store fiddle contract.** Documents owns this. The shell and Versions and run consume it.
- Fields:
  - `view: 'editor' | 'settings'`
  - `fiddle: { source, name, versionRef, modules: Record<string, string>, files: { name, visible }[], activeFile, fiddleRev, dirty }`
  - `layout: { sidebar: boolean, split: string | null, consoleHeight: number, sidebarWidth: number }`
- Methods:
  - `GetFiles() -> Record<name, text>`
  - `EditFile(name, text, fiddleRev)`
  - `AddFile`, `RenameFile`, `RemoveFile`
  - `SetFileVisible`, `SetActiveFile`
  - `SetLayout`, `SetView`

## Decisions

- **Assist row:** the design includes an AI "Describe a change" row. AI is parked (§16), so the row isn't built. Its tokens stay in the token file.
- **Open design questions** (welcome and empty states, settings page layout, Windows and Linux title bars, narrow windows) are decided with the simplest layout the design system supports.
- **Scaffold versions:**
  - **TypeScript 6.0.3, not 7.0.** typescript-eslint 8.69 supports TypeScript `>=4.8.4 <6.1.0`.
  - **React 19.2.8, not 19.3.0.** 19.3.0 was published on 2026-09-09, so the 7-day age gate blocks it. The caret range picks it up once it's allowed.
  - **Vite 8.2.2 (exact), zod 4.5.x.** 8.3.0 and zod 4.6 are too new for the age gate. Forge's Vite plugin needs Vite `^8`.
  - **Forge 8.0.0-alpha.10 and its plugins** are pinned exactly.
- **Core from source.** The app resolves `@electron/fiddle-core` through the custom export condition `fiddle-source`. It isn't named `source` because `@internationalized/date`, a react-aria dependency, publishes a `source` condition that points at raw TypeScript.
- **Minimum window size is 600×600** (REQUIREMENTS §14), not the 880×560 in Lucent's sample options.
- **Dev versus headless runs.** `yarn start` uses the Vite dev server over `http://localhost`; the differences are listed in CLAUDE.md. `yarn start:xvfb` builds the app and loads `app://main` with the production CSP.
- **EIPC output is post-processed** in `tools/generate.mjs`:
  - type-only imports, for `verbatimModuleSyntax`;
  - a channel ID hashed from the schemas instead of a random UUID;
  - no timestamp.
  Without these, regeneration wouldn't be clean.
- **Store names.** The EIPC stores are named `App` and `Window`, which gives `useAppStore`, `useWindowStore`, `updateAppStore` and `updateWindowStore`. EIPC names hooks by store name alone, so two stores both called `State` would collide.
- **i18n namespaces.** `common` is the renderer's startup namespace. `main` is main's menus and dialogs.
- **Packaging and CI (§12):**
  - `forge.config.ts` carries the old app's identity and settings over. `tools/release-identity.mjs` checks them against `packages/app/build/identity.json` in CI.
  - Signing uses Azure Trusted Signing through Windows SDK's `signtool`, with no override. The `electron-windows-msix` dev-cert patch (`.yarn/patches/`) is still needed.
  - Notarization uses an App Store Connect API key (`APPLE_API_KEY`, `APPLE_API_KEY_ID` and `APPLE_API_ISSUER`), with an Apple ID as a fallback.
  - Only `build-windows` and `attest` have `id-token: write`. `attest` runs no repository code. The publish job uses `GITHUB_TOKEN` with `contents: write` instead of `electron/secret-service-action`, which needs OIDC.
- **E2E driver release check.** `tools/release-check-asar.mjs` fails the CI package smoke test and every release build if any packaged `app.asar` contains one of the driver's markers.
  - The markers are copied from `MARKERS` in `packages/app/tools/driver-release-check.ts`. Keep the two lists in sync.
  - The script is plain `.mjs`, so it runs on any Node. The `.ts` tools need type stripping, which isn't on by default in the Node 22.17 pinned in `.nvmrc`.
- **Sentry release name.** It's `Electron-Fiddle@<package.json version>`, with no `v` (`@sentry/electron`'s default). The release workflow uses the same name.

- **Run and stop shortcut (Versions and run).** Lucent says ⌘R runs and stops. `run.toggle` is CmdOrCtrl+R, with F5 as a hidden second menu accelerator, and Reload moved to CmdOrCtrl+Shift+R.
- **Console default (Versions and run).** Lucent's default layout wins over §17.7: the console is visible at 160px. A run, package or make reopens it if it was dragged below 96px.
- **Fiddle userData (Versions and run).** Each run passes `--user-data-dir=<run dir>/user-data`, so the fiddle's userData is deleted with the run dir. "Keep user data dirs" drops the flag.
- **Runtime errors (Versions and run).** Runs always set `ELECTRON_ENABLE_LOGGING`, and Chromium's CONSOLE lines become Renderer rows. Chromium's other log lines only show with advanced logging on. CONSOLE lines carry only a line number, so a renderer error has no column unless its message includes a stack frame.
- **Trust for package, make and auto-bisect (Versions and run).** All go through `ensureTrusted`, which returns the approved fiddle; callers run that snapshot, never the window's current fiddle. Every run checks trust, auto-bisect steps included, so a fiddle swapped in mid-bisect asks again. The approval lists the modules with install scripts (npm registry `hasInstallScript`; every module if the registry can't say). Untrusted fiddles install with scripts off unless the approval allowed them. Package and make ask again when their modules need scripts and the approval left them off, and refuse if the user still doesn't allow them.
- **Security review fixes.** A window that's running, bisecting, packaging or making refuses a new fiddle ("Stop the fiddle first"); deep links open in a new window instead. `state.json` `untrustedFolders` keeps a saved untrusted fiddle's origin per folder until it's approved. The token on the clipboard never reaches the renderer: sign-in with an empty field uses it (`SignInFromClipboard`), and the renderer only learns that one is there. Custom mirrors are https only. Importing settings that change flags, variables or mirrors asks first. `NODE_OPTIONS` and `ELECTRON_RUN_AS_NODE` can't be set. `GitHubClient` allows plain-http loopback only with `allowLoopbackHttp` (test mode).
- **Release snapshot (Versions and run).** `static/releases.json` is bundled into main as a `?raw` string and used until the cache has a fresher list.
- **Platform slice** (`main/{platform,updates,crash,migration}/**`, `main/log.ts`, `renderer/features/about/**`):
  - **Startup order** in `main/index.ts` (the composition root; see CLAUDE.md): Squirrel events first, then the headless CLI, the test harness, Sentry, and last the single-instance lock (all before `ready`). After `ready` come the log file, then `runMigration()`, which must finish before any store is created (`loadSettings`, `createServices`…). Every command is registered before `installMenu`, and `startPlatform()` runs just before the windows.
  - **One-time import** (§6): `importedFrom: { version, at }` in state.json, where `version` is the app version that ran the import (the old app's version isn't recorded anywhere). Files are created only if absent, so an interrupted import can run again. The new files are sparse `settings.json`, `tourDone` in `state.json`, `local-builds.json` (`{ schemaVersion: 1, builds: [{ id, name, path, addedAt }] }`, the Versions slice's to read), `credentials/github` (through `CredentialStore`) and `themes/<old file name>.json` (Monaco `editor` kept, `common: {}`). Old Electron versions are copied into `<cache>/electron/<version>` in the background after the first launch; zips are extracted by core's per-version `Installer`. `static/import-local-storage.html` is the only file:// page (documented in `security.ts`).
  - **Old keys:** "Block Save / Save As" becomes `keybindings: { 'file.save': null, 'file.saveAs': null }`. The old DEFAULT mirror maps to the new `auto`. `isUsingSystemTheme` off maps the built-in themes to `appearance` and custom ones to `theme`. Ignored: `gitHubToken`, `known-electron-versions` and `version`.
  - **Sentry:** `IPCMode.Classic` through the app preload (`@sentry/electron/preload-namespaced`, same origin check as EIPC). Renderer events are scrubbed by main's `beforeSend`. The renderer starts its SDK only if `AppPlatform.IsCrashReportingEnabled()`. Turning "Send crash reports" off closes Sentry at once; turning it on takes effect after a restart. Native dumps from any non-renderer process are dropped.
  - **Updates:** "Beta updates" applies after a restart. The kill switch is `https://raw.githubusercontent.com/electron/fiddle/main/update-policy.json`. A blocked version shows a modal notice (Download / Quit), then quits. Linux and MSIX get a daily GitHub releases check and a toast (`AppPlatform.UpdateAvailable`).
  - **Logs:** `<userData>/logs/main.log`, `main.1.log`, `main.2.log`. Renderer code logs through `log` from `renderer/features/about`.
- **Native modules are the one exception to "no externals" (§2).** Native addons can't be bundled.
  - `@electron-internal/extract-zip` is external in `vite.main.config.mts`. Core loads it lazily (`await import()` in `defaultExtract`), so importing core never loads the addon.
  - Forge's Vite plugin doesn't copy externals (Forge #3738, still so in 8.0.0-alpha.10). `forge.config.ts`'s `packageAfterCopy` copies each module in `NATIVE_MODULES` into the app's `node_modules`, keeping only the target platform and arch's `.node`. `asar.unpack: '**/*.node'` keeps the addons out of the asar.
  - Main's CommonJS bundle defines `import.meta.url` as `__fiddleImportMetaUrl`, declared in an output banner, so bundled ESM dependencies that call `createRequire(import.meta.url)` (`@electron/get`, `@electron/asar`) keep working. A banner name can't be shadowed by a module's own `require`.
- **i18n tooling (§9):**
  - **`yarn i18n:check`** runs in CI after `yarn generate`. It fails on:
    - missing keys in a shipped locale, or keys English doesn't have;
    - placeholder or tag mismatches;
    - plural forms outside the locale's CLDR categories;
    - text over `maxLength`.
  - The unused-English-key scan only warns. Dynamic keys like `` t(`section.${id}`) `` and `t(step.title)` make it a heuristic.
  - **`yarn i18n:translate`** translates new and changed keys through the Anthropic API (`fetch`, `ANTHROPIC_API_KEY`, `claude-opus-5`, overridable with `FIDDLE_TRANSLATE_MODEL`). It uses each key's description and `maxLength`, and `src/i18n/glossary.json`.
    - State lives in `src/i18n/translations/<locale>.json`: the source hash, the translation hash, and a `reviewed` flag.
    - A human edit is detected by its hash. It becomes reviewed and is never overwritten. If its English changes, it's flagged for re-review.
    - `--dry-run [--json]` shows the work. `--from <file>` imports translations made elsewhere (for example by an agent).
    - `yarn i18n:test` tests the diffing with a mocked model.
  - **Pseudo-locales.** `yarn generate` generates `en-XA` (accented, about 40% longer) and `ar-XB` (right-to-left, mirrored) into `src/i18n/generated/`. They're in every build. Select one with the locale setting, or with `FIDDLE_LOCALE` (dev and test runs only). `<html lang dir>` follows the active language.
  - **Shipped locales:** `en`, `de` and `ja`. `de` and `ja` are unreviewed machine translations.
  - **Formatting:** `formatDate`, `formatNumber` and `formatRelative` are in `src/i18n/format.ts`. Renderers use `useFormat()`.
- **Main-process wiring.** Every service is created once in `createServices()` and passed down as one `Services` object (see CLAUDE.md, "Architecture map").
  - Quit can't hang. `app.quit()` after the unsaved-changes prompt, or after the flush on quit, runs on a later turn. Called inside a quit event's own dispatch, Electron drops it.
  - `will-quit` holds the quit only while a store has pending writes.
  - `cachePaths()` defaults to `getCacheRoot()`. Before, the app's Versions service used the OS cache even in test mode, so e2e runs installed Electron into `~/.cache/Electron Fiddle`. Then `run.e2e.ts` failed once a dev run had already cached the version.
## Deferred

- **Electron's install script doesn't run** with `enableScripts: false`, despite `dependenciesMeta.electron.built`. After a fresh install, run `node node_modules/electron/install.js`. Needs a proper allowlist fix in `.yarnrc.yml` or a postinstall.
  - **Fixed.** Electron 44 has no install script, only an `install-electron` bin, so `built` never mattered. `packages/app`'s `postinstall` now runs `install-electron`; workspace scripts still run under `enableScripts: false`. Verified: remove `node_modules/electron/dist`, run `yarn install`, and `dist/electron` is back. Release jobs install with `--mode=skip-build`, so it doesn't run where secrets are.
- **Packaging (§12, §13) still to do:**
  - The `.appinstaller` file (§13): `electron-windows-msix` 2.0.4 and Forge's MSIX maker can't generate one.
  - The upgrade test (§6): a disabled `upgrade-test` job skeleton (macOS and Windows) is in `ci.yml`. The release doesn't depend on it yet.
  - Trimming `build/entitlements.plist` (§4) waits for the helper that spawns fiddles with responsibility disclaimed.
  - Debug-ID source maps (§14): the release uploads the Linux x64 `.vite` maps with `url_prefix: '~/.vite'`, as the old app did.
  - The packaged smoke test running one fiddle offline (§11): CI only runs `yarn package` on each OS.
  - Refresh-data PRs are opened with `GITHUB_TOKEN`, so CI doesn't run on them until the PR is closed and reopened.
- **Not wired yet:**
  - Sentry and `update-electron-app` (installed only);
  - JSON-lines logs (`src/main/log.ts` is a console stub);
  - keybinding overrides.
- **The literal-string lint rules were `warn`, not `error` (§9).** `i18next/no-literal-string` (`jsx-text-only`) covers JSX text in `src/{renderer,ui}`. `no-restricted-syntax` covers literal `label`, `title`, `message`, `detail` and `buttons` values in `src/main`. Tests, the design-system gallery and generated code are excluded.
  - **Fixed.** Both are `error` in `eslint.config.js`. They had no warnings left when switched, and an AST scan found no letter-bearing JSX text in `src/{renderer,ui}`. Note that the i18next rule skips everything under an all-caps variable (`const A = () => <div>Text</div>`), so name components in PascalCase.
- **Gist share links (§17.17):** "Copy share link" copies `https://gist.github.com/<id>`. The https URL that redirects to `electron-fiddle://` needs a web endpoint. Swap it in `GitHubService.shareLink` (`src/main/github/service.ts`).
- **Versions and run:** Installer extraction still runs on the main thread (core's default); a worker needs a second Vite main entry. Socket Firewall isn't bundled, so module installs run without it and say so. The version picker has type-ahead but no search field or "copy version".

## Wave 3: integration checklist

Collected from the wave 2 reports. The orchestrator ticks these off.

- [ ] **Packaging ships `static/`.** Add `extraResource: ['static']` so the packaged app has its bundled content: Show Me, the quick-start template, `releases.json`, `contributors.json` and `import-local-storage.html`. Documents finds it through `process.resourcesPath`.
- [ ] **`contributors.json` snapshot** exists and is committed. The About panel and credits read it.
- [ ] **Versions and run to Documents:**
  - Documents gets `versions` in `initDocuments` (from `createServices`) for the default version, template majors, usable versions and Forge options, including a local build's path. **Done.**
  - Clear the console when `fiddle.fiddleRev` changes.
  - Use `ensureTrusted(windowId, op, { packagesWithInstallScripts })`. **Done:** `ensureTrusted` looks them up itself; package and make pass them with `requireScripts`.
- [x] **Gists to Documents:** `markPublished` and `markGistDeleted` go through `github/documents-bridge.ts`. Documents gets the `GitHubService` in `initDocuments`, so restored and deep-linked private gists load with the user's token.
- [x] **App UX to Documents:** modules go through `setFiddleModules`. Onboarding lives in `state.json` through `getStateStore()`.
- [ ] **Shell wiring:**
  - Mount `useDocumentDrop()` and `<Toaster>` (for update and storage toasts).
  - Add the `data-tour` anchors.
  - Route F1 to the palette.
- [x] **Tour anchors:** `data-tour` on VersionPicker, RunButton, ConsolePane and PublishButton.
- [x] **`getCacheRoot()`:** uses the OS cache dir (env-paths), not `app.getPath('cache')`.
- [ ] **Crash-reporting disclosure on first run** (§14).
- [ ] **Private gists opened from deep links** wait for GitHub sign-in (§17.4).
- [ ] **Drop a gist URL on the dock** (macOS).
- [ ] **`parseEnvEntries` reports every blocked name.** Core drops all `LD_*` and `DYLD_*` variables, but parsing only flags `LD_PRELOAD` and `DYLD_*`.
- [ ] **Headless CLI (§7).**
- [ ] **E2E specs** for each feature, plus the feature-coverage IDs.
- [ ] **i18n:** a pseudo-locale, a translation script, other locales, and the lint rule against string literals.
- [ ] **Acceptance checklist** from the Lucent handover, in both appearances.
- [ ] **i18n wiring:**
  - Shell mounts `useSyncLocale(app.locale)` from `src/i18n/renderer`, so renderer strings follow the language setting. Nothing calls `changeLanguage` yet.
  - `vitest.config.ts`: add `src/i18n/**/*.test.ts` to `app:node`.
  - `renderer/features/run/ConsolePane.tsx` passes `undefined` to `Intl.DateTimeFormat`; use the UI locale.
  - `main/themes/themes.ts` calls `localeCompare` without a locale. **Done:** it passes the UI locale.
  - Settings: hide `pseudoLocales` from the language list in packaged builds (optional).
  - `forge.config.ts`: add `CFBundleLocalizations` (see the i18n report).
  - RTL: the editor, console and file names must stay `dir="ltr"`, and chrome styles must use logical properties.
