# Electron Fiddle (rewrite)

- **Spec:** `REQUIREMENTS.md` is the single source of truth. §17 is the feature catalog. Where §17 conflicts with §1–§16, §1–§16 win.
- **Design:** "Lucent", in `docs/design/`:
  - `lucent-handover.html` is the handover. `lucent-handover.txt` is its text.
  - `lucent-tokens.css` and `lucent-tokens.json` hold the tokens, verbatim.
  - `fonts/` has the fonts.
  - `prototype/` has the prototype's component bundle, specimens and CSS, for reference only.
- **Ledger:** `PROGRESS.md` tracks milestones, decisions and deferred items.

## Rules

- **Prefer the simple option.** Over-engineering is the main risk. If a simple option works, use it.
- **Tokens:** every colour, radius, shadow and duration in component styles comes from a `--lu-*` token. No literals.
- **Strings:** every user-visible string comes from the i18n catalog, in sentence case.
- **IPC:** only through EIPC-generated bindings. Never expose `ipcRenderer`. Errors are `FiddleError`s with a stable `code`, thrown and caught normally.
- **State:** main owns all state (`App` and `Window` stores through the `StateHub`). Renderers render and request changes.
- **Fiddle logic:** `packages/app/src/fiddle/` must not import `electron`, so it runs under plain Node in tests.
- **Tests:** no Playwright or WebDriver. End-to-end tests use the in-house driver.
- **Installs:** run `yarn install` only through `flock /tmp/fiddle-2027-yarn.lock yarn install`, because several agents share this checkout.
- **Commits:** agents don't commit. The orchestrator commits at milestones.

## Commands

Run from the repo root.

- `yarn start`: dev run. Forge serves the renderer from the Vite dev server with hot reload.
- `yarn start:xvfb`: headless dev run for agents. It builds main, preload and renderer in development mode, then starts Electron under `xvfb-run`, loading `app://main` exactly like a packaged build. Extra arguments go to Electron.
  - `FIDDLE_DEV_SCREENSHOT=/tmp/x.png FIDDLE_DEV_QUIT=1 yarn start:xvfb` saves a screenshot of the first window, then quits.
  - Logs are prefixed `[fiddle]`.
  - In this container, run it outside the Bash sandbox, because Xvfb can't start inside it.
- `yarn generate`: EIPC bindings and compiled i18n catalogs. It's offline and idempotent, and start, typecheck, lint, test, package and make all run it.
- `yarn typecheck` (`tsc -b`), `yarn lint`, `yarn format`.
- `yarn test`: every Vitest project (`core`, `app:node`, `app:jsdom`). For one project: `yarn vitest run --project app:node`.
- `yarn package`, `yarn make`: Forge 8, output in `packages/app/out/`.
- `yarn fiddle` (headless CLI) is a placeholder for now.
- `yarn test:e2e`, `yarn driver <command>`: end-to-end tests and the interactive driver. See "E2E" below.

## E2E

The full guide, with a template spec, is in `packages/app/e2e/README.md`.

- **Run.** `yarn test:e2e` builds the test build once (`packages/app/out/test-build`, Vite mode `test`), then runs every `packages/app/e2e/*.e2e.ts` in parallel forks.
  - Each spec file gets its own app, temp dir, fixture server and Xvfb display. openbox runs on the display when installed.
  - Run it outside the Bash sandbox.
  - `yarn test:e2e smoke` runs one file. `FIDDLE_E2E_SKIP_BUILD=1` reuses the last build, and `FIDDLE_E2E_VERBOSE=1` echoes the app's output.
- **Explore.** Start with `yarn driver launch`, then run `snapshot`, `click button Settings`, `type`, `press Enter`, `screenshot`, `logs` or `eval-hook`, and finish with `yarn driver quit`. Every command prints JSON, and the app stays up between commands. The full list is in the header of `packages/app/tools/driver.ts`.
- **Write a spec.** `const app = useApp()`, from `e2e/harness.ts`:
  - Find elements by role and name, for example `app().click(role('button', 'Run'))`. Queries auto-wait, so never sleep.
  - `runCommand(id)` runs a command, `stores()` reads state, and `queueDialog()` answers the next native dialog.
  - Tag each test with `@feature <id>` for `yarn features-coverage`.
- **Test mode** (`src/main/test-mode.ts`) is on only in test builds launched with `FIDDLE_TEST_MODE=1`, which the launcher sets. Every slice must use:
  - `getEndpoints()` for every network URL (`src/shared/endpoints.ts`). In test mode these point at the fixture server in `e2e/fixtures/`, and any non-loopback request fails the test.
  - `getCacheRoot()` for the `core` cache.
  - `isTestMode()`, or `testFlags().updates`, `.sentry`, `.firstRunPrompts` and `.tour`, to skip what tests must not trigger.
  - Native dialogs through Electron's `dialog` module, so the driver can script them.
  - `shell`, protocol, recent-document and notification calls through Electron as usual. Test mode records and stubs them.
- **Test hooks.** A renderer hook goes on `window.__fiddleTest` under `import.meta.env.MODE === 'test'`. A main hook uses `registerMainTestHook()` under `TEST_BUILD`. Either way, release builds compile it out. `yarn workspace electron-fiddle driver:release-check` verifies that.
- **Harness internals.** The harness is `src/main/test-driver/` and is compiled in only when `__FIDDLE_TEST_BUILD__` is set:
  - it serves a socket at `ELECTRON_FIDDLE_DRIVER_SOCKET`;
  - it drives the page through CDP (`webContents.debugger`) and `sendInputEvent`;
  - it owns `webRequest.onBeforeRequest`, `onCompleted` and `onErrorOccurred` on every session.

## Dev differences

These apply only to `yarn start`, on an unpackaged app. `yarn start:xvfb` and packaged builds have none.

- The renderer comes from the Vite dev server (`http://localhost:<port>`) instead of `app://main`. The EIPC validator accepts that origin only when `is_packaged is false`.
- The CSP is added to dev-server responses by `webRequest` (`src/main/csp.ts`):
  - `script-src` adds `'unsafe-inline'`, for React Refresh's inline preamble.
  - `connect-src` adds `ws://localhost:<port>`, for hot reload.

## Architecture map

Paths below are in `packages/app/`.

- `src/main/index.ts`: main entry. Registers the scheme, enables the sandbox and runs startup.
- `src/main/state-hub.ts`: the `StateHub` holds the `App` and `Window` stores, bumps `rev` and fans pushes out. It's the only caller of `update*Store`. Store schemas and types live in `src/shared/stores.ts`.
- IPC:
  - The schema is `src/ipc/fiddle.eipc`, generated into `src/ipc/generated/`, which is committed.
  - Main binds each window in `src/main/ipc.ts` through `implement()` from `src/ipc/main.ts`.
  - The renderer imports only `src/ipc/renderer.ts`: `appApi`, `windowApi`, `useAppStore` and `useWindowStore`.
  - Errors cross IPC via `src/shared/error-transport.ts`.
- Commands:
  - Definitions: `src/shared/commands.ts`.
  - Registry: `src/main/commands.ts`.
  - Handlers: `src/main/app-commands.ts`.
  - Native menu: `src/main/menu.ts`.
  - The renderer calls `windowApi.RunCommand(id)`.
- Windows:
  - `src/main/window.ts`: Lucent window options, web preferences, and showing the window on `ReportReady`.
  - `src/main/windows.ts`: maps `windowId` to its `BrowserWindow`.
- Security:
  - `src/main/protocol.ts` and `bundle.ts`: `app://` serves only files in `bundle-manifest.json`.
  - `csp.ts`: the CSP. Add a Trusted Types policy name there before calling `trustedTypes.createPolicy`.
  - `security.ts`: permissions, navigation and external links.
- i18n:
  - Edit `src/i18n/locales/<locale>/<ns>.json`. Every English key needs a `description`. Then run `yarn generate`.
  - Main loads the `main` namespace (`src/main/i18n.ts`). Renderers load `common` first and other namespaces lazily (`src/i18n/renderer.ts`).
- The preload is `src/preload/index.ts`, bundled as CommonJS, and it exposes EIPC only. The renderer entry is `src/renderer/main.tsx`.
- Build:
  - `forge.config.ts`.
  - `vite.{main,preload,renderer}.config.mts`, each runnable with plain `vite build -c`.
  - `tools/generate.mjs` and `tools/start-headless.mjs`.
