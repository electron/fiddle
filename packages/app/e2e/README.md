# E2E tests

End-to-end specs drive a real test build of the app through the in-house driver
(`src/main/test-driver`). There's no Playwright or WebDriver.

- **Run everything:** `yarn test:e2e` from the repo root. It builds `out/test-build` once, then runs
  every `packages/app/e2e/*.e2e.ts` in parallel. In a sandboxed container, run it outside the
  sandbox, because Xvfb needs its display socket (and on macOS, because Electron can't start in it).
- **Run one file:** `yarn test:e2e smoke`, or add `-t "name"` for one test. Set
  `FIDDLE_E2E_SKIP_BUILD=1` to reuse the last build, and `FIDDLE_E2E_VERBOSE=1` to see the app's
  output.
- **Explore by hand:** `yarn driver launch`, then `yarn driver snapshot`,
  `yarn driver click button Run`, `yarn driver screenshot /tmp/x.png`, `yarn driver quit`. Every
  command prints JSON. The full list is in the header of `tools/driver.ts`.

## Platforms

The driver needs no OS focus: clicks, keys and typing go through CDP (`Input.*`) straight to the
page, and every page emulates focus, so `document.hasFocus()`, focus events and `:focus` behave as
in the key window whatever the OS does. That's what lets many apps run side by side.

- **Linux** (CI and containers): each spec file gets its own Xvfb display (`Xvfb -displayfd`),
  with openbox on it when installed. Nothing shows on a real screen.
- **macOS** (a maintainer's desktop): no Xvfb needed. The app runs as a background app: no Dock
  icon or Cmd-Tab entry, it never becomes the active app, and its windows open one level below
  normal windows, so they never cover or take focus from what you're doing (you can see them on an
  empty desktop or in Mission Control). Window focus is emulated the way a window manager hands it
  out: a shown or focused window becomes the focused one for the app and for `windows()`.
  `FIDDLE_E2E_FOREGROUND=1` opens the windows in front instead (still without taking focus), to
  watch a `yarn driver` session. Two things are shared with your session: the clipboard (a couple
  of specs copy to it) and the CPU.
- **Workers:** `FIDDLE_E2E_WORKERS=<n>` sets how many spec files run at once. The default is one
  per core but one on Linux, and at most 4 on macOS and Windows.

## Writing a spec

Create `packages/app/e2e/<feature>.e2e.ts`. Each file gets its own app, temp dir, X display (on
Linux) and fixture server, so files never share state. Tests inside a file share one app, so they
run in order.

```ts
import { describe, expect, it } from 'vitest';

import { role, text, useApp } from './harness.ts';

describe('run', () => {
  const app = useApp();

  // Tag each test with the Feature catalog ID it covers.
  it('runs the fiddle and shows its output @feature run.start', async () => {
    // Find controls by accessible role and name, the way a user or screen reader would.
    await app().click(role('button', 'Run'));

    // Every query waits, with a 5 s default timeout. Never sleep.
    await app().query(text('Hello from Electron'));

    // Stores, commands and dialogs.
    const { window } = await app().stores();
    expect(window).toMatchObject({ run: { status: 'running' } });
    await app().runCommand('run.stop');
    await app().queueDialog('save', { filePath: '/tmp/fiddle' }); // before the dialog opens
  });
});
```

## What you can do

| Goal | Call |
|---|---|
| Find, click, type, press | `query(q)`, `waitForAbsent(q)`, `click(q)`, `type('text', q?)`, `press('CmdOrCtrl+S', q?)` |
| Keys | Electron accelerator or DOM names: `Enter`, `Escape`, `Tab`, `Backspace`, `Delete`, `ArrowDown`, `PageUp`, `F5`, `CmdOrCtrl+Shift+P`, `Ctrl+Shift+PageDown`, `CmdOrCtrl+\\`. `Shift+F10` opens the focused element's context menu on every platform (on macOS the driver presses the Menu key, since Chromium ignores Shift+F10 there) |
| Queries | `role('button', 'Run')`, `role('heading', /welcome/i)`, `text('Saved')`, and `{ nth, timeout, window }`. Without `window`, actions go to the focused window (the last one shown or focused), else the first |
| Commands | `runCommand('app.newWindow')` |
| State | `stores(window?)` returns `{ app, window }` |
| Seeing | `snapshot()`, `screenshot(path?)`, `windows()`, `console()`, `logs()`, `clipboard()` |
| Settling | `waitForIdle()`: no pending IPC, network requests or animation frames |
| Native dialogs | `queueDialog('messageBox', { button: 'Save' })`, `{ response: 1 }`, `('open', { filePaths })`, `('save', { filePath })`, `{ canceled: true }`, then `dialogs()` |
| OS side effects | `sideEffects()`: `shell.openExternal`, `showItemInFolder`, protocol registration, recent documents, notifications, native context menus (`menu.popup`, with the item labels), and so on |
| Renderer hooks | `evalHook('name', ...args)` calls `window.__fiddleTest.name(...args)` |
| Main hooks | `mainHook('name', ...args)` calls a hook registered with `registerMainTestHook` |
| Network | `fixtures.requests` lists what the app fetched (pass your own `startFixtureServer()` to `launchApp({ fixtures })`) |

A failed step throws a `DriverError`. Its message includes:
- the step and the query;
- the accessibility snapshot;
- the path of a failure screenshot;
- the tails of the main and renderer logs.

When a test fails, `useApp()` also prints diagnostics and keeps the temp dir, including
`artifacts/` and `app-output.log`. Isolation violations fail the file after its last test:
- a request to a non-loopback host;
- an unscripted dialog;
- a crashed renderer.

## Test hooks for features

- **Renderer.** For state that isn't in the stores or the accessibility tree, such as Monaco model
  content, register a hook in the renderer, and only in test builds, so it's compiled out of
  releases:

  ```ts
  if (import.meta.env.MODE === 'test') {
    (window as { __fiddleTest?: Record<string, unknown> }).__fiddleTest = {
      ...(window as { __fiddleTest?: Record<string, unknown> }).__fiddleTest,
      editorText: (file: string) => getModel(file)?.getValue(),
    };
  }
  ```

- **Main.** Guard main-side hooks with `TEST_BUILD`:

  ```ts
  if (TEST_BUILD) registerMainTestHook('run.output', (id) => getOutput(String(id)));
  ```

  Both `TEST_BUILD` and `registerMainTestHook` come from `src/main/test-mode.ts`.

## Fixtures

`fixtures/server.ts` serves every URL in `src/shared/endpoints.ts`. Its data is in
`fixtures/data/`, and it records each request. Electron zips come from the local Electron download
cache, or are zipped from `node_modules/electron`. Add data files there; add a route in `route()`
only for a new endpoint.

## Feature coverage

Every REQUIREMENTS §17 bullet, settings row and shortcut ends with a stable ID such as
`{#run.stop}`. Tests reference IDs with `@feature <id>`: in an e2e test title, or in a
`// @feature <id> [<id>...]` comment above a unit test (many rules are best tested there).

`yarn features-coverage` prints the covered and uncovered IDs, grouped by section (`--json` for
details). It fails on a tag that names no ID or on a duplicate ID; `--strict` also fails when any
ID has no test.
