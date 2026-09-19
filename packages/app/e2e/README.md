# E2E tests

End-to-end specs drive a real test build of the app through the in-house driver
(`src/main/test-driver`). There's no Playwright or WebDriver.

- **Run everything:** `yarn test:e2e` from the repo root. It builds `out/test-build` once, then runs
  every `packages/app/e2e/*.e2e.ts` in parallel. In a sandboxed container, run it outside the
  sandbox, because Xvfb needs its display socket (and on macOS, because Electron can't start in it).
- **Run one file:** `yarn test:e2e smoke`. Run whole files: the tests in a file depend on each
  other, so `-t "name"` fails for any test that needs what an earlier one left behind. Set
  `FIDDLE_E2E_SKIP_BUILD=1` to reuse the last build, and `FIDDLE_E2E_VERBOSE=1` to see the app's
  output.
- **Explore by hand:** `yarn driver launch`, then `yarn driver snapshot`,
  `yarn driver click button Run`, `yarn driver screenshot /tmp/x.png`, `yarn driver quit`. Every
  command prints JSON. The full list is in the header of `tools/driver.ts`.

## Platforms

The driver needs no OS focus: clicks, keys and typing go through CDP (`Input.*`) straight to the
page, and every page emulates focus. That's what lets many apps run side by side.

- **Linux:** each spec file gets its own Xvfb display, with openbox on it when installed. Nothing
  shows on a real screen. `FIDDLE_E2E_DISPLAY=:<n>` uses an existing display instead.
- **macOS:** no Xvfb needed. The app runs as a background app that never becomes the active app,
  and its windows open below normal windows. `FIDDLE_E2E_FOREGROUND=1` opens them in front (still
  without taking focus), to watch a `yarn driver` session.
- **Workers:** `FIDDLE_E2E_WORKERS=<n>` sets how many spec files run at once. The default is one
  per core but one on Linux, and at most 4 on macOS and Windows.

## Writing a spec

Create `packages/app/e2e/<feature>.e2e.ts`. Each file gets its own app, temp dir, X display (on
Linux) and fixture server, so files never share state. Tests inside a file share one app and run
in order, and a test may rely on what the ones before it left behind.

```ts
import { describe, expect, it } from 'vitest';

import { role, text, useApp } from './harness.ts';

describe('run', () => {
  const app = useApp();

  it('runs the fiddle and shows its output', async () => {
    // Find controls by accessible role and name, the way a user or screen reader would.
    // A click waits until the element is enabled, on top and no longer moving.
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

The rest of the API (`snapshot`, `screenshot`, `console`, `logs`, `clipboard`, `sideEffects`,
`dialogs`, `evalHook`, `mainHook` and more) is on `FiddleApp` in `e2e/driver.ts`, and the spec
glue is in `e2e/harness.ts`.

- **Queries.** `role('button', 'Run')`, `role('heading', /welcome/i)` and `text('Saved')` take
  `{ nth, timeout, window }`. Without `window`, actions go to the focused window, else the first.
- **Keys.** `press` takes Electron accelerators or DOM key names (`CmdOrCtrl+Shift+P`, `Escape`).
  `Shift+F10` opens the focused element's context menu on every platform.
- **Dialogs.** Native dialogs must be scripted with `queueDialog` before they open. An unscripted
  dialog fails the file.
- **Side effects.** `shell.openExternal`, protocol registration, notifications and native context
  menus are recorded, not performed. Read them with `sideEffects()`.
- **Clipboard.** Main's clipboard is in memory: `clipboard()` returns what the app last copied
  (a gist link, a version number), and main never reads or writes the OS clipboard. A copy the page
  makes itself, such as Ctrl+C in the editor, still goes to the OS clipboard, so specs don't
  assert on it.

A failed step throws a `DriverError` with the step and query, the accessibility snapshot, the path
of a failure screenshot and the tails of the main and renderer logs. When a test fails, `useApp()`
also prints diagnostics and keeps the temp dir, including `artifacts/` and `app-output.log`.
Isolation violations fail the file after its last test: a request to a non-loopback host, an
unscripted dialog, or a crashed renderer.

## Test hooks for features

- **Renderer.** For state that isn't in the stores or the accessibility tree, such as Monaco model
  content, register a hook in the renderer, and only in test builds, so it's compiled out of
  releases. Call it with `evalHook('name', ...args)`:

  ```ts
  if (import.meta.env.MODE === 'test') {
    (window as { __fiddleTest?: Record<string, unknown> }).__fiddleTest = {
      ...(window as { __fiddleTest?: Record<string, unknown> }).__fiddleTest,
      editorText: (file: string) => getModel(file)?.getValue(),
    };
  }
  ```

- **Main.** Guard main-side hooks with `TEST_BUILD`, and call them with `mainHook('name', ...args)`:

  ```ts
  if (TEST_BUILD) registerMainTestHook('run.output', (id) => getOutput(String(id)));
  ```

  Both `TEST_BUILD` and `registerMainTestHook` come from `src/main/test-mode.ts`.

## Fixtures

`fixtures/server.ts` serves every URL in `src/shared/endpoints.ts`. Its data is in
`fixtures/data/`, and it records each request (`app.fixtures().requests`). Electron zips come from
the local Electron download cache (or the directory in `FIDDLE_E2E_ELECTRON_ZIPS`), or are zipped
from `node_modules/electron`. Add data files there; add a route in `route()` only for a new
endpoint.
