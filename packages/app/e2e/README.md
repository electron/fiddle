# E2E tests

End-to-end specs drive a real test build of the app through the in-house driver
(`src/main/test-driver`). There's no Playwright or WebDriver.

- **Run everything:** `yarn test:e2e` from the repo root. It builds `out/test-build` once, then runs
  every `packages/app/e2e/*.e2e.ts` in parallel. In a sandboxed container, run it outside the
  sandbox, because Xvfb needs its display socket.
- **Run one file:** `yarn test:e2e smoke`, or add `-t "name"` for one test. Set
  `FIDDLE_E2E_SKIP_BUILD=1` to reuse the last build, and `FIDDLE_E2E_VERBOSE=1` to see the app's
  output.
- **Explore by hand:** `yarn driver launch`, then `yarn driver snapshot`,
  `yarn driver click button Run`, `yarn driver screenshot /tmp/x.png`, `yarn driver quit`. Every
  command prints JSON. The full list is in the header of `tools/driver.ts`.

## Writing a spec

Create `packages/app/e2e/<feature>.e2e.ts`. Each file gets its own app, temp dir, X display and
fixture server, so files never share state. Tests inside a file share one app, so they run in
order.

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
| Queries | `role('button', 'Run')`, `role('heading', /welcome/i)`, `text('Saved')`, and `{ nth, timeout, window }` |
| Commands | `runCommand('app.newWindow')` |
| State | `stores(window?)` returns `{ app, window }` |
| Seeing | `snapshot()`, `screenshot(path?)`, `windows()`, `console()`, `logs()`, `clipboard()` |
| Settling | `waitForIdle()`: no pending IPC, network requests or animation frames |
| Native dialogs | `queueDialog('messageBox', { button: 'Save' })`, `{ response: 1 }`, `('open', { filePaths })`, `('save', { filePath })`, `{ canceled: true }`, then `dialogs()` |
| OS side effects | `sideEffects()`: `shell.openExternal`, `showItemInFolder`, protocol registration, recent documents, notifications, and so on |
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

`yarn features-coverage` lists the `@feature <id>` tags that specs reference. With `--strict` it
fails when a Feature catalog ID has no spec. This is a stub until REQUIREMENTS §17 has IDs.
