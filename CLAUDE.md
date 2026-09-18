# Electron Fiddle (rewrite)

- **Design:** "Lucent", in `docs/design/`:
  - `lucent-handover.html` is the design system reference: principles, materials, layout, components and specimens.
  - `lucent-tokens.css` and `lucent-tokens.json` hold the tokens, verbatim.
  - `fonts/` has the fonts.

## Rules

- **Prefer the simple option.** Over-engineering is the main risk. If a simple option works, use it.
- **Tokens:** every colour, radius, shadow and duration in component styles comes from a `--lu-*` token. No literals.
- **Strings:** every user-visible string comes from the i18n catalog, in sentence case. Edit `packages/app/src/i18n/locales/<locale>/<ns>.json`, give every English key a `description`, then run `yarn generate`.
- **IPC:** only through EIPC-generated bindings. Never expose `ipcRenderer`. Errors are `FiddleError`s with a stable `code`, thrown and caught normally.
- **State:** main owns all state (`App` and `Window` stores through the `StateHub`). Renderers render and request changes.
- **Fiddle logic:** `packages/app/src/fiddle/` must not import `electron`, so it runs under plain Node in tests.
- **Persistence:** `createJsonStore()` for every JSON file, and `writeAtomic()` for any other file main replaces.
- **CSP:** add a Trusted Types policy name in `src/main/csp.ts` before calling `trustedTypes.createPolicy`.
- **Dev tooling:** new dev-only commands are marked `devOnly` in `src/shared/commands.ts` and go in the Develop menu.
- **Tests:** no Playwright or WebDriver. End-to-end tests use the in-house driver.
- **Installs:** run `yarn install` only through `flock /tmp/fiddle-2027-yarn.lock yarn install`, because several agents share this checkout.
- **Git:** pull before you start changing code, and pull with rebase before you commit. Commit when asked.
  - Stage your own files by name. Several agents share this checkout, so leave their changes out.
  - `origin` uses SSH, which the Bash sandbox blocks. Fetch `https://github.com/electron/fiddle.git fiddle-2027` instead, then rebase onto `FETCH_HEAD`.

## Commands

Run from the repo root.

- `yarn start`: dev run. Forge serves the renderer from the Vite dev server with hot reload.
- `yarn start:xvfb`: headless dev run for agents. It builds main, preload and renderer in development mode, then starts Electron under `xvfb-run`, loading `app://main` exactly like a packaged build. Extra arguments go to Electron.
  - `FIDDLE_DEV_SCREENSHOT=/tmp/x.png FIDDLE_DEV_QUIT=1 yarn start:xvfb` saves a screenshot of the first window, then quits.
  - `FIDDLE_DEV_MENU_DUMP=1` logs the application menu and the context menus' templates.
  - Logs are prefixed `[fiddle]`.
  - In this container, run it outside the Bash sandbox, because Xvfb can't start inside it.
- `yarn generate`: EIPC bindings and compiled i18n catalogs. It's offline and idempotent, and start, typecheck, lint, test, package and make all run it.
- `yarn typecheck` (`tsc -b`), `yarn lint`, `yarn format`.
- `yarn test`: every Vitest project (`core`, `app:node`, `app:jsdom`). For one project: `yarn vitest run --project app:node`.
- `yarn package`, `yarn make`: Forge 8, output in `packages/app/out/`.
- `yarn fiddle <command>`: the headless CLI against the dev build. See "Headless CLI" below.
- `yarn test:e2e`, `yarn driver <command>`: end-to-end tests and the interactive driver. See "E2E" below.

## E2E

The full guide, with a template spec, is in `packages/app/e2e/README.md`.

- **Run.** `yarn test:e2e` builds the test build once (`packages/app/out/test-build`, Vite mode `test`), then runs every `packages/app/e2e/*.e2e.ts` in parallel forks. Each spec file gets its own app, temp dir and fixture server.
  - Run it outside the Bash sandbox (on macOS, in the Terminal panel: Electron can't start in the sandbox).
  - `yarn test:e2e smoke` runs one file. `FIDDLE_E2E_SKIP_BUILD=1` reuses the last build, and `FIDDLE_E2E_VERBOSE=1` echoes the app's output.
  - `FIDDLE_E2E_WORKERS=<n>` sets the parallelism. On macOS the app runs in the background and never takes focus. `FIDDLE_E2E_FOREGROUND=1` shows the windows in front.
- **Explore.** Start with `yarn driver launch`, then run `snapshot`, `click button Settings`, `type`, `press Enter`, `screenshot`, `logs` or `eval-hook`, and finish with `yarn driver quit`. Every command prints JSON, and the app stays up between commands. The full list is in the header of `packages/app/tools/driver.ts`.
- **Write a spec.** `const app = useApp()`, from `e2e/harness.ts`:
  - Find elements by role and name, for example `app().click(role('button', 'Run'))`. Queries auto-wait, so never sleep.
  - `runCommand(id)` runs a command, `stores()` reads state, and `queueDialog()` answers the next native dialog.
  - A key the page doesn't handle never reaches the native menu, so shortcuts under test go through the renderer's keybinding dispatcher.
- **Test mode** (`src/main/test-mode.ts`) is on only in test builds launched with `FIDDLE_TEST_MODE=1`, which the launcher sets. Every feature must use:
  - `getEndpoints()` for every network URL (`src/shared/endpoints.ts`). In test mode these point at the fixture server in `e2e/fixtures/`, and any non-loopback request fails the test.
  - `getCacheRoot()` for the `core` cache.
  - `isTestMode()`, or `testFlags().updates`, `.sentry`, `.firstRunPrompts` and `.tour`, to skip what tests must not trigger.
  - Native dialogs through Electron's `dialog` module, so the driver can script them.
  - `shell`, protocol, recent-document, notification and `Menu.popup` calls through Electron as usual. Test mode records and stubs them.
  - `win.show()` and `win.focus()` for windows, never `app.focus()` or `webContents.focus()`, which would pull the app in front of whoever runs the tests on macOS.
- **Test hooks.** A renderer hook goes on `window.__fiddleTest` under `import.meta.env.MODE === 'test'`. A main hook uses `registerMainTestHook()` under `TEST_BUILD`. Either way, release builds compile it out. `yarn workspace electron-fiddle driver:release-check` verifies that.

## Dev differences

These apply only to `yarn start`, on an unpackaged app. `yarn start:xvfb` and packaged builds have none.

- The renderer comes from the Vite dev server (`http://localhost:<port>`) instead of `app://main`. The EIPC validator accepts that origin only when `is_packaged is false`.
- The CSP is added to dev-server responses by `webRequest` (`src/main/csp.ts`). It allows React Refresh's inline preamble and the hot-reload websocket.

## Headless CLI

The code is `packages/app/src/main/cli/`. To add a command, add a descriptor in `descriptors.ts`, its help strings (`mainCli` keys `cmd<Command>` and `arg<Field>`) and a handler in `commands.ts`.

- **Run.** `yarn fiddle <command> [--json]` builds main in development mode, then runs `electron <app> --headless <command>` in your directory. `yarn fiddle --help` and `<command> --help` list the commands and their options. `FIDDLE_CLI_SKIP_BUILD=1` reuses the last build, and `FIDDLE_CLI_VERBOSE=1` shows main's logs on stderr. Run `yarn generate` first if the catalogs changed.
  - Run it outside the Bash sandbox. Headless mode needs no display, but a fiddle that opens windows does: use `xvfb-run -a yarn fiddle run ...`, with `FIDDLE_DEV_ELECTRON_FLAGS=--no-sandbox` as root.
- **Trust.** `run`, `bisect`, `package` and `make` on a remote fiddle (a gist, or `electron:<tag>/<path>`) need `--trust` or a "y" at the TTY prompt. Without a TTY they fail with `untrusted` before anything runs.
- **Token.** `GITHUB_TOKEN` is the only token the CLI uses.

## Where things are

Paths are under `packages/app/` unless noted.

- `src/main/`: the main process. `index.ts` is the entry, `services.ts` creates the services, `state-hub.ts` owns the stores, `app-commands.ts` has the command handlers.
- `src/renderer/`: the React renderer. `src/ui/`: the Lucent component library and gallery.
- `src/shared/`: types shared by both sides: stores, commands and endpoints.
- `src/ipc/fiddle.eipc`: the IPC schema. The bindings in `src/ipc/generated/` are committed.
- `src/fiddle/`: fiddle logic, plain Node. `src/i18n/`: catalogs and tooling.
- `e2e/` and `tools/`: end-to-end specs, the driver and the build tooling.
- `packages/core/`: the `fiddle-core` port.
