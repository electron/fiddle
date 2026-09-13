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
- `yarn fiddle` (headless CLI) and `yarn test:e2e` are placeholders for now.

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
