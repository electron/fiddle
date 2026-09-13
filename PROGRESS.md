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

## Deferred

- **Electron's install script doesn't run** with `enableScripts: false`, despite `dependenciesMeta.electron.built`. After a fresh install, run `node node_modules/electron/install.js`. Needs a proper allowlist fix in `.yarnrc.yml` or a postinstall.
- **Packaging (§12):** AppImage and MSIX makers, signing, notarization and the GitHub publisher.
- **Not wired yet:**
  - Sentry and `update-electron-app` (installed only);
  - JSON-lines logs (`src/main/log.ts` is a console stub);
  - keybinding overrides;
  - a renderer consumer for the `Window.Command` event.
- **Lint rule** banning string literals in JSX and in menu and dialog definitions (§9).
