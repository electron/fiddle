/** The driver's socket server and its methods (see ./protocol.ts). */
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

import { app, BrowserWindow, clipboard } from 'electron';

import type { CommandRegistry } from '../commands';
import type { StateHub } from '../state-hub';
import { getMainTestHook } from '../test-mode';
import { windowIdOf } from '../windows';
import { pageFor, poll, type Page } from './page';
import type {
  DriverMethods,
  DriverRequest,
  DriverResponse,
  FailureReport,
  WindowInfo,
  WindowRef,
} from './protocol';
import type { TestState } from './state';

export interface DriverContext {
  hub: StateHub;
  registry: CommandRegistry;
  state: TestState;
}

type Handlers = {
  [M in keyof DriverMethods]: (
    params: DriverMethods[M][0],
  ) => Promise<DriverMethods[M][1]> | DriverMethods[M][1];
};

/** App windows in creation order. */
function allWindows(): BrowserWindow[] {
  return BrowserWindow.getAllWindows()
    .filter((win) => !win.isDestroyed())
    .sort((a, b) => a.id - b.id);
}

function findWindow(ref: WindowRef | undefined): BrowserWindow | undefined {
  const windows = allWindows();
  if (ref === undefined) {
    const focused = BrowserWindow.getFocusedWindow();
    return focused && windows.includes(focused) ? focused : windows[0];
  }
  if (typeof ref === 'number') return windows[ref];
  return windows.find((win) => windowIdOf(win) === ref);
}

function pageOf(ref: WindowRef | undefined): Page {
  const win = findWindow(ref);
  if (!win) throw new Error(ref === undefined ? 'No app window is open' : `No window ${JSON.stringify(ref)}`);
  return pageFor(win.webContents);
}

function windowInfo(win: BrowserWindow, index: number): WindowInfo {
  return {
    index,
    windowId: windowIdOf(win),
    title: win.getTitle(),
    visible: win.isVisible(),
    focused: win.isFocused(),
    url: win.webContents.getURL(),
  };
}

function createHandlers({ hub, registry, state }: DriverContext): Handlers {
  let screenshots = 0;
  const artifact = (name: string) => path.join(state.testDir, 'artifacts', name);

  return {
    ping: () => ({ pid: process.pid, testDir: state.testDir }),
    windows: () => allWindows().map(windowInfo),
    waitForWindow: ({ window = 0, timeout = 15_000 }) =>
      poll<WindowInfo>(`window ${JSON.stringify(window)}`, timeout, () => {
        const win = findWindow(window);
        if (!win) return { reason: 'not open' };
        if (!win.isVisible()) return { reason: 'not shown yet' };
        return { value: windowInfo(win, allWindows().indexOf(win)) };
      }),
    snapshot: ({ window }) => pageOf(window).snapshot(),
    query: ({ state: wanted, ...query }) => pageOf(query.window).query(query, wanted),
    click: (query) => pageOf(query.window).click(query),
    type: async ({ text, query, window }) => {
      const page = pageOf(query?.window ?? window);
      if (query) await page.click(query);
      await page.type(text);
      return null;
    },
    press: async ({ key, query, window }) => {
      const page = pageOf(query?.window ?? window);
      if (query) await page.click(query);
      await page.press(key);
      return null;
    },
    runCommand: async ({ id, window }) => {
      await registry.run(id, { windowId: windowIdOf(findWindow(window)) });
      return null;
    },
    stores: ({ window }) => {
      const windowId = windowIdOf(findWindow(window));
      return { app: hub.app, window: windowId ? (hub.getWindow(windowId) ?? null) : null };
    },
    console: ({ window }) => state.consoles.get(pageOf(window).contents.id) ?? [],
    clipboard: () => clipboard.readText(),
    logs: ({ tail = 200 }) => ({
      main: state.mainLog.tail(tail),
      renderer: state.rendererLog.tail(tail),
    }),
    screenshot: ({ window, path: file }) =>
      pageOf(window).screenshot(file ?? artifact(`screenshot-${++screenshots}.png`)),
    waitForIdle: async ({ timeout = 10_000, window }) => {
      const started = Date.now();
      const page = findWindow(window) ? pageOf(window) : undefined;
      let quiet = 0;
      await poll('idle', timeout, async () => {
        const busy: string[] = [];
        if (state.pendingIpc > 0) busy.push(`${state.pendingIpc} IPC call(s) pending`);
        if (state.inflight.size > 0) busy.push(`${state.inflight.size} request(s) in flight`);
        if (page && !(await page.framesIdle())) busy.push('animations running');
        if (busy.length > 0) {
          quiet = 0;
          return { reason: busy.join(', ') };
        }
        return ++quiet >= 2 ? { value: true } : { reason: 'settling' };
      });
      return { waitedMs: Date.now() - started };
    },
    evalHook: async ({ name, args = [], window, timeout = 5000 }) => {
      const page = pageOf(window);
      const key = JSON.stringify(name);
      await poll(`test hook ${name}`, timeout, async () =>
        (await page.evaluate(`typeof window.__fiddleTest?.[${key}] === 'function'`))
          ? { value: true }
          : {
              reason: `window.__fiddleTest.${name} is not registered; registered: ${String(
                await page.evaluate(`Object.keys(window.__fiddleTest ?? {}).join(', ') || 'none'`),
              )}`,
            },
      );
      return page.evaluate(`window.__fiddleTest[${key}](...${JSON.stringify(args)})`);
    },
    evaluate: ({ expression, window }) => pageOf(window).evaluate(expression),
    mainHook: async ({ name, args = [] }) => {
      const hook = getMainTestHook(name);
      if (!hook) throw new Error(`No main test hook ${JSON.stringify(name)} is registered`);
      return await hook(...args);
    },
    queueDialog: ({ kind, response }) => {
      state.dialogQueue[kind].push(response);
      return null;
    },
    dialogs: () => state.dialogs,
    sideEffects: () => state.sideEffects,
    violations: () => state.violations,
    quit: () => {
      setImmediate(() => app.quit());
      return null;
    },
  };
}

function windowRefOf(params: unknown): WindowRef | undefined {
  const p = (params ?? {}) as { window?: WindowRef; query?: { window?: WindowRef } };
  return p.window ?? p.query?.window;
}

export function startDriverServer(socketPath: string, context: DriverContext): net.Server {
  const { state } = context;
  const handlers = createHandlers(context);
  let failures = 0;

  const failureReport = async (
    method: string,
    params: unknown,
    error: unknown,
  ): Promise<FailureReport> => {
    const report: FailureReport = {
      message: error instanceof Error ? error.message : String(error),
      step: method,
      query: params,
      mainLog: state.mainLog.tail(40),
      rendererLog: state.rendererLog.tail(40),
    };
    const win = findWindow(windowRefOf(params)) ?? allWindows()[0];
    if (win && method !== 'quit') {
      const page = pageFor(win.webContents);
      try {
        report.a11ySnapshot = await page.snapshot();
      } catch (snapshotError) {
        report.a11ySnapshot = `(snapshot failed: ${String(snapshotError)})`;
      }
      try {
        const file = path.join(state.testDir, 'artifacts', `failure-${++failures}.png`);
        report.screenshot = (await page.screenshot(file)).path;
      } catch {
        // No screenshot; the rest of the report still helps.
      }
    }
    return report;
  };

  if (process.platform !== 'win32') fs.rmSync(socketPath, { force: true });
  const server = net.createServer((socket) => {
    socket.setEncoding('utf8');
    socket.on('error', () => undefined);
    const reply = (response: DriverResponse) => {
      if (!socket.destroyed) socket.write(`${JSON.stringify(response)}\n`);
    };
    const handle = async (line: string) => {
      let request: DriverRequest;
      try {
        request = JSON.parse(line) as DriverRequest;
      } catch {
        reply({ id: -1, ok: false, error: await failureReport('parse', line, 'Invalid JSON') });
        return;
      }
      try {
        const handler = handlers[request.method] as
          | ((params: unknown) => unknown)
          | undefined;
        if (!handler) throw new Error(`Unknown driver method ${JSON.stringify(request.method)}`);
        const result = await handler(request.params ?? {});
        reply({ id: request.id, ok: true, result: result ?? null });
      } catch (error) {
        reply({
          id: request.id,
          ok: false,
          error: await failureReport(request.method, request.params, error),
        });
      }
    };
    let buffer = '';
    socket.on('data', (chunk: string) => {
      buffer += chunk;
      for (let end = buffer.indexOf('\n'); end !== -1; end = buffer.indexOf('\n')) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        if (line.trim()) void handle(line);
      }
    });
  });
  server.on('error', (error) => console.error('[fiddle-test] driver server failed', error));
  server.listen(socketPath, () => state.mainLog.push(`[test] driver listening on ${socketPath}`));
  app.once('will-quit', () => server.close());
  return server;
}
