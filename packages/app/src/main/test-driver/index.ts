/**
 * The test harness, compiled only into test builds (see ../test-mode.ts). main
 * calls `installTestHarness()` before `ready` when `isTestMode()`.
 *
 * Keep this module free of top-level side effects so release builds drop it.
 */
import nodeCrypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { format } from 'node:util';

import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  net,
  Notification,
  powerSaveBlocker,
  session,
  shell,
  type Session,
  type WebContents,
} from 'electron';

import type { CommandRegistry } from '../commands';
import type { StateHub } from '../state-hub';
import { registerMainTestHook } from '../test-mode';
import { configurePages, pageFor } from './page';
import type { DialogKind, DialogResponse } from './protocol';
import { startDriverServer } from './server';
import { createTestState, type TestState } from './state';

export interface TestHarness {
  /** Starts the driver once main has its StateHub and command registry. */
  attach(context: { hub: StateHub; registry: CommandRegistry }): void;
}

/** Durations go to zero rather than `none`, so transitionend and animationend still fire. */
const NO_ANIMATION_CSS = `*, *::before, *::after {
  transition-duration: 0s !important; transition-delay: 0s !important;
  animation-duration: 0s !important; animation-delay: 0s !important;
  scroll-behavior: auto !important;
}`;

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const NETWORK_PROTOCOLS = new Set(['http:', 'https:', 'ws:', 'wss:']);

function isNetworkUrl(url: string): boolean {
  try {
    return NETWORK_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

function isBlocked(url: string): boolean {
  try {
    const parsed = new URL(url);
    return NETWORK_PROTOCOLS.has(parsed.protocol) && !LOOPBACK.has(parsed.hostname);
  } catch {
    return false;
  }
}

export function installTestHarness(): TestHarness {
  const testDir =
    process.env.FIDDLE_TEST_DIR ?? fs.mkdtempSync(path.join(os.tmpdir(), 'fiddle-test-'));
  process.env.FIDDLE_TEST_DIR = testDir;
  for (const dir of ['appData', 'userData', 'cache', 'logs', 'artifacts', 'crashDumps']) {
    fs.mkdirSync(path.join(testDir, dir), { recursive: true });
  }
  // appData too, so nothing (the legacy data import, for one) reads this machine's real data.
  app.setPath('appData', path.join(testDir, 'appData'));
  app.setPath('userData', path.join(testDir, 'userData'));
  app.setPath('sessionData', path.join(testDir, 'userData'));
  app.setPath('logs', path.join(testDir, 'logs'));
  app.setPath('crashDumps', path.join(testDir, 'crashDumps'));

  const state = createTestState(testDir);
  const locale = process.env.FIDDLE_TEST_LOCALE ?? 'en-US';
  const seed = Number(process.env.FIDDLE_TEST_SEED ?? 1) >>> 0;

  captureMainLog(state);
  applySwitches(locale);
  fixLocaleAndTime(locale);
  seedMainRandomness(seed);
  guardNodeNetwork(state);
  stubOsSideEffects(state);
  scriptDialogs(state);
  if (process.platform === 'darwin') stayInBackground(state);
  configurePages({ locale, timezone: 'UTC', initScript: seededRandomScript(seed) });

  app.on('session-created', (ses) => guardSession(ses, state));
  app.on('web-contents-created', (_event, contents) =>
    prepareWebContents(contents, state),
  );
  void app.whenReady().then(() => guardSession(session.defaultSession, state));

  // The harness's own hooks, so specs can check the network guard from main.
  const tryFetch =
    (doFetch: (url: string) => Promise<Response>) => async (url: unknown) => {
      try {
        return { status: (await doFetch(String(url))).status };
      } catch (error) {
        return { error: String(error) };
      }
    };
  registerMainTestHook(
    'harness.fetch',
    tryFetch((url) => fetch(url)),
  );
  registerMainTestHook(
    'harness.netFetch',
    tryFetch((url) => net.fetch(url)),
  );

  return {
    attach({ hub, registry }) {
      const socketPath = process.env.ELECTRON_FIDDLE_DRIVER_SOCKET;
      if (socketPath) startDriverServer(socketPath, { hub, registry, state });
    },
  };
}

function captureMainLog(state: TestState): void {
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      state.mainLog.push(`[${level}] ${format(...args)}`);
      original(...args);
    };
  }
  // An unexpected quit is hard to trace from a test, so log who asked for it.
  const caller = () =>
    new Error().stack
      ?.split('\n')
      .slice(3, 7)
      .map((line) => line.trim())
      .join(' <- ');
  const quit = app.quit.bind(app);
  const exit = app.exit.bind(app);
  app.quit = () => {
    console.log('[fiddle-test] app.quit() from', caller());
    quit();
  };
  app.exit = (code?: number) => {
    console.log(`[fiddle-test] app.exit(${code ?? 0}) from`, caller());
    exit(code);
  };
  app.on('will-quit', () => console.log('[fiddle-test] will-quit'));
}

function applySwitches(locale: string): void {
  const { commandLine } = app;
  commandLine.appendSwitch('disable-background-timer-throttling');
  commandLine.appendSwitch('disable-renderer-backgrounding');
  commandLine.appendSwitch('disable-backgrounding-occluded-windows');
  commandLine.appendSwitch('force-prefers-reduced-motion');
  commandLine.appendSwitch('force-device-scale-factor', '1');
  commandLine.appendSwitch('lang', locale);
  if (process.platform === 'linux') commandLine.appendSwitch('password-store', 'basic');
}

function fixLocaleAndTime(locale: string): void {
  // The launcher sets TZ for every process; this covers main's own Node.
  process.env.TZ = 'UTC';
  app.getPreferredSystemLanguages = () => [locale];
  app.getLocale = () => locale;
  app.getSystemLocale = () => locale;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedMainRandomness(seed: number): void {
  const random = mulberry32(seed);
  Math.random = random;
  // windowIds and other UUIDs become reproducible too.
  (nodeCrypto as { randomUUID: () => string }).randomUUID = () => {
    const bytes = Array.from({ length: 16 }, () => Math.floor(random() * 256));
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
    const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
}

function seededRandomScript(seed: number): string {
  return `(() => { let a = ${seed} >>> 0; Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`;
}

function guardSession(ses: Session, state: TestState): void {
  ses.webRequest.onBeforeRequest((details, callback) => {
    if (isBlocked(details.url)) {
      state.violation(
        `non-loopback request (Chromium): ${details.method} ${details.url}`,
      );
      callback({ cancel: true });
      return;
    }
    if (isNetworkUrl(details.url)) state.inflight.add(`web:${details.id}`);
    callback({});
  });
  const done = (details: { id: number }) => state.inflight.delete(`web:${details.id}`);
  ses.webRequest.onCompleted(done);
  ses.webRequest.onErrorOccurred(done);
}

function requestUrl(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return String((input as { url?: unknown }).url ?? '');
}

function guardNodeNetwork(state: TestState): void {
  let seq = 0;
  type AnyFetch = (input: never, init?: never) => Promise<Response>;
  const guardFetch =
    (source: string, original: AnyFetch) =>
    async (input: never, init?: never): Promise<Response> => {
      const url = requestUrl(input);
      if (isBlocked(url)) {
        state.violation(`non-loopback request (${source}): ${url}`);
        throw new TypeError(`${source}: ${url} is blocked in test mode`);
      }
      const key = `${source}:${++seq}`;
      state.inflight.add(key);
      try {
        return await original(input, init);
      } finally {
        state.inflight.delete(key);
      }
    };

  globalThis.fetch = guardFetch(
    'fetch',
    globalThis.fetch.bind(globalThis),
  ) as typeof fetch;
  net.fetch = guardFetch('net.fetch', net.fetch.bind(net)) as typeof net.fetch;

  for (const [protocol, mod] of [
    ['http', http],
    ['https', https],
  ] as const) {
    for (const name of ['request', 'get'] as const) {
      const original = mod[name] as (...args: unknown[]) => http.ClientRequest;
      (mod as unknown as Record<string, unknown>)[name] = function (
        this: unknown,
        ...args: unknown[]
      ) {
        const request = original.apply(this, args);
        const url = `${protocol}://${request.host}${request.path}`;
        if (isBlocked(url)) {
          state.violation(`non-loopback request (node:${protocol}): ${url}`);
          request.destroy(new Error(`${url} is blocked in test mode`));
        }
        return request;
      };
    }
  }
}

function stubOsSideEffects(state: TestState): void {
  const record = (kind: string, ...args: unknown[]) => {
    state.sideEffects.push({ kind, args });
    state.mainLog.push(`[test] stubbed ${kind} ${JSON.stringify(args)}`);
  };
  Object.assign(shell, {
    openExternal: async (url: string) => record('shell.openExternal', url),
    openPath: async (file: string) => {
      record('shell.openPath', file);
      return '';
    },
    showItemInFolder: (file: string) => record('shell.showItemInFolder', file),
    beep: () => record('shell.beep'),
  });
  Object.assign(app, {
    setAsDefaultProtocolClient: (protocol: string) => {
      record('app.setAsDefaultProtocolClient', protocol);
      return true;
    },
    removeAsDefaultProtocolClient: (protocol: string) => {
      record('app.removeAsDefaultProtocolClient', protocol);
      return true;
    },
    addRecentDocument: (file: string) => record('app.addRecentDocument', file),
    clearRecentDocuments: () => record('app.clearRecentDocuments'),
    moveToApplicationsFolder: () => {
      record('app.moveToApplicationsFolder');
      return false;
    },
    setUserTasks: (tasks: unknown[]) => {
      record('app.setUserTasks', tasks);
      return true;
    },
    setJumpList: (categories: unknown) => {
      record('app.setJumpList', categories);
      return 'ok';
    },
    setBadgeCount: (count?: number) => {
      record('app.setBadgeCount', count);
      return true;
    },
  });
  Notification.prototype.show = function (this: Notification) {
    record('notification.show', { title: this.title, body: this.body });
  };
  // A native context menu can't be driven, and on macOS it tracks the mouse in
  // a modal loop over someone's desktop until dismissed. Record its items instead.
  Menu.prototype.popup = function (this: Menu) {
    record(
      'menu.popup',
      this.items.map((item) => (item.type === 'separator' ? '-' : item.label)),
    );
  };
}

/**
 * macOS has no Xvfb: the app under test shares the desktop with whoever runs
 * the tests, usually several apps at once. So there it stays out of the way:
 * - accessory activation policy: no Dock icon, never the active app;
 * - windows are shown without activating, one level below normal windows.
 *   FIDDLE_TEST_FOREGROUND=1 (the launcher's FIDDLE_E2E_FOREGROUND) keeps the
 *   normal level, to watch a `yarn driver` session;
 * - a power assertion keeps App Nap from throttling an app nobody can see;
 * - window focus is emulated: showing or focusing a window makes it the
 *   focused one, and a closed window passes focus back to the previous one.
 *   The OS never makes a window key.
 * The driver needs none of this: input goes through CDP and pages emulate
 * focus (./page.ts).
 */
function stayInBackground(state: TestState): void {
  const foreground = process.env.FIDDLE_TEST_FOREGROUND === '1';
  const note = (message: string) => state.mainLog.push(`[test] ${message}`);
  const accessory = () => {
    try {
      app.setActivationPolicy('accessory');
    } catch (error) {
      note(`setActivationPolicy failed: ${String(error)}`);
    }
  };
  accessory();
  void app.whenReady().then(() => {
    accessory();
    powerSaveBlocker.start('prevent-app-suspension');
  });
  app.focus = () => note('app.focus() skipped');

  let focused: BrowserWindow | undefined;
  /** Most recently focused last. */
  const history: BrowserWindow[] = [];
  const forget = (win: BrowserWindow) => {
    const index = history.indexOf(win);
    if (index !== -1) history.splice(index, 1);
  };
  const event = { preventDefault: () => undefined };
  /** Makes `win` the focused window: `blur` for the old one, `focus` for the new (unless the OS just sent it). */
  const setFocused = (win: BrowserWindow | undefined, announce = true) => {
    if (win === focused) return;
    const previous = focused;
    focused = win;
    if (win) {
      forget(win);
      history.push(win);
    }
    if (previous && !previous.isDestroyed()) previous.emit('blur', event);
    if (announce && win && !win.isDestroyed()) win.emit('focus', event);
  };
  const refocus = () =>
    setFocused(
      [...history].reverse().find((win) => !win.isDestroyed() && win.isVisible()),
    );

  app.on('browser-window-created', (_event, win) => {
    if (!foreground) win.setAlwaysOnTop(true, 'normal', -1);
    const showInactive = win.showInactive.bind(win);
    Object.assign(win, {
      show: () => {
        showInactive();
        setFocused(win);
      },
      focus: () => {
        if (win.isVisible()) setFocused(win);
      },
      isFocused: () => focused === win && !win.isDestroyed(),
    });
    // Someone clicked it, and the OS said so: follow, so the driver's default window is the one they look at.
    win.on('focus', () => {
      if (!win.isDestroyed()) setFocused(win, false);
    });
    win.on('hide', () => {
      if (focused === win) refocus();
    });
    win.on('closed', () => {
      forget(win);
      if (focused === win) refocus();
    });
  });
}

/** Only what's useful in assertions; options can hold windows and functions. */
function summarize(options: Record<string, unknown>): Record<string, unknown> {
  const keys = [
    'type',
    'title',
    'message',
    'detail',
    'buttons',
    'checkboxLabel',
    'defaultPath',
    'filters',
    'properties',
    'cancelId',
    'defaultId',
  ];
  return Object.fromEntries(
    keys.filter((key) => key in options).map((key) => [key, options[key]]),
  );
}

function scriptDialogs(state: TestState): void {
  // dialog.showX(options) or dialog.showX(window, options).
  const optionsOf = (args: unknown[]) =>
    ((args.length > 1 ? args[1] : args[0]) ?? {}) as Record<string, unknown>;

  const respond = (kind: DialogKind, options: Record<string, unknown>) => {
    const queued = state.dialogQueue[kind].shift();
    const summary = summarize(options);
    if (!queued) {
      state.violation(`unexpected ${kind} dialog: ${JSON.stringify(summary)}`);
    }
    const response = resolveDialog(kind, queued, options, state);
    state.dialogs.push({
      kind,
      options: summary,
      response,
      scripted: queued !== undefined,
    });
    return response;
  };

  type MessageBox = Electron.MessageBoxReturnValue;
  type Open = Electron.OpenDialogReturnValue;
  type Save = Electron.SaveDialogReturnValue;
  Object.assign(dialog, {
    showMessageBox: async (...args: unknown[]) =>
      respond('messageBox', optionsOf(args)) as MessageBox,
    showMessageBoxSync: (...args: unknown[]) =>
      (respond('messageBox', optionsOf(args)) as MessageBox).response,
    showOpenDialog: async (...args: unknown[]) =>
      respond('open', optionsOf(args)) as Open,
    showOpenDialogSync: (...args: unknown[]) => {
      const result = respond('open', optionsOf(args)) as Open;
      return result.canceled ? undefined : result.filePaths;
    },
    showSaveDialog: async (...args: unknown[]) =>
      respond('save', optionsOf(args)) as Save,
    showSaveDialogSync: (...args: unknown[]) => {
      const result = respond('save', optionsOf(args)) as Save;
      return result.canceled ? '' : result.filePath;
    },
    showErrorBox: (title: string, content: string) => {
      state.dialogs.push({
        kind: 'errorBox',
        options: { title, content },
        response: null,
        scripted: false,
      });
      state.mainLog.push(`[test] error box: ${title}: ${content}`);
    },
  });
}

function resolveDialog(
  kind: DialogKind,
  queued: DialogResponse | undefined,
  options: Record<string, unknown>,
  state: TestState,
): unknown {
  const canceled = !queued || ('canceled' in queued && queued.canceled);
  if (kind === 'open') {
    return canceled || !('filePaths' in queued)
      ? { canceled: true, filePaths: [] }
      : { canceled: false, filePaths: queued.filePaths };
  }
  if (kind === 'save') {
    return canceled || !('filePath' in queued)
      ? { canceled: true, filePath: '' }
      : { canceled: false, filePath: queued.filePath };
  }
  const cancelId = typeof options.cancelId === 'number' ? options.cancelId : 0;
  if (!queued || !('response' in queued || 'button' in queued)) {
    return { response: cancelId, checkboxChecked: false };
  }
  let response = queued.response ?? cancelId;
  if (queued.button !== undefined) {
    const buttons = Array.isArray(options.buttons) ? (options.buttons as string[]) : [];
    const index = buttons.indexOf(queued.button);
    if (index === -1) {
      state.violation(
        `queued button ${JSON.stringify(queued.button)} is not in ${JSON.stringify(buttons)}`,
      );
    } else {
      response = index;
    }
  }
  return { response, checkboxChecked: queued.checkboxChecked ?? false };
}

function prepareWebContents(contents: WebContents, state: TestState): void {
  if (contents.getType() !== 'window') return;
  contents.setBackgroundThrottling(false);

  // Count IPC invocations in flight, for waitForIdle. EIPC binds with contents.ipc.handle.
  const ipc = contents.ipc;
  const handle = ipc.handle.bind(ipc);
  ipc.handle = (channel, listener) =>
    handle(channel, async (...args) => {
      state.pendingIpc++;
      try {
        return await listener(...args);
      } finally {
        state.pendingIpc--;
      }
    });

  const lines = state.consoles.get(contents.id) ?? [];
  state.consoles.set(contents.id, lines);
  contents.on('console-message', (event) => {
    const source = `${event.sourceId}:${event.lineNumber}`;
    lines.push({ level: event.level, message: event.message, source });
    if (lines.length > 1000) lines.shift();
    state.rendererLog.push(
      `[${contents.id}:${event.level}] ${event.message} (${source})`,
    );
  });
  contents.on('render-process-gone', (_event, details) => {
    state.violation(`renderer ${contents.id} gone: ${details.reason}`);
  });
  contents.on('dom-ready', () => {
    contents.insertCSS(NO_ANIMATION_CSS).catch(() => undefined);
  });
  pageFor(contents)
    .attach()
    .catch((error: unknown) => {
      state.mainLog.push(`[test] debugger attach deferred: ${String(error)}`);
    });
}
