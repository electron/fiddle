/**
 * The e2e client. `launchApp()` starts the test build (out/test-build) with test
 * mode on, a fresh temp dir, its own fixture server and, on Linux, its own
 * headless X display (Xvfb, plus openbox when installed). The returned
 * `FiddleApp` drives it over the driver socket.
 *
 * Specs use it through ./harness.ts; `yarn driver` (tools/driver.ts) uses it
 * too. Plain Node with type stripping: import with `.ts` extensions, and no
 * Vitest imports here.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

import type {
  DialogKind,
  DialogResponse,
  DriverMethod,
  DriverMethods,
  DriverResponse,
  ElementInfo,
  FailureReport,
  Query,
  TextMatcher,
  WindowRef,
} from '../src/main/test-driver/protocol.ts';
import { startFixtureServer, type FixtureServer } from './fixtures/server.ts';

export type { ElementInfo, FailureReport, WindowInfo } from '../src/main/test-driver/protocol.ts';
export { FIXTURE_GIST_ID, type FixtureServer } from './fixtures/server.ts';

export const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TEST_BUILD_DIR = path.join(APP_DIR, 'out', 'test-build');

// ---- Queries -------------------------------------------------------------

/** A query as specs write it: names and text may be RegExps. */
export interface AppQuery extends Omit<Query, 'name' | 'text'> {
  name?: string | RegExp;
  text?: string | RegExp;
}

/** `role('button', 'Run')`, `role('heading', /welcome/i)`. */
export function role(
  roleName: string,
  name?: string | RegExp,
  extra: Omit<AppQuery, 'role' | 'name'> = {},
): AppQuery {
  return { role: roleName, ...(name === undefined ? {} : { name }), ...extra };
}

/** Visible text containing `value` (or matching a RegExp). */
export function text(value: string | RegExp, extra: Omit<AppQuery, 'text'> = {}): AppQuery {
  return { text: value, ...extra };
}

const toMatcher = (value: string | RegExp): TextMatcher =>
  value instanceof RegExp ? { regex: value.source, flags: value.flags } : value;

export function toQuery(query: AppQuery): Query {
  const { name, text: textValue, ...rest } = query;
  return {
    ...rest,
    ...(name === undefined ? {} : { name: toMatcher(name) }),
    ...(textValue === undefined ? {} : { text: toMatcher(textValue) }),
  };
}

// ---- Errors --------------------------------------------------------------

const indent = (value: string) =>
  value
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');

export function formatFailure(report: FailureReport): string {
  return [
    `${report.step} failed: ${report.message}`,
    report.query === undefined ? '' : `  query: ${JSON.stringify(report.query)}`,
    report.screenshot ? `  screenshot: ${report.screenshot}` : '',
    report.a11ySnapshot ? `  accessibility snapshot:\n${indent(report.a11ySnapshot)}` : '',
    `  main log (last ${report.mainLog.length}):\n${indent(report.mainLog.join('\n'))}`,
    `  renderer log (last ${report.rendererLog.length}):\n${indent(report.rendererLog.join('\n'))}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** A driver step failed. The message carries the whole report. */
export class DriverError extends Error {
  readonly report: FailureReport;

  constructor(report: FailureReport) {
    super(formatFailure(report));
    this.name = 'DriverError';
    this.report = report;
  }
}

// ---- Socket client -------------------------------------------------------

interface Pending {
  resolve(value: unknown): void;
  reject(error: Error): void;
  timer: NodeJS.Timeout;
}

/** Newline-delimited JSON requests over the driver socket (src/main/test-driver/protocol.ts). */
export class DriverClient {
  readonly #socket: net.Socket;
  readonly #pending = new Map<number, Pending>();
  #nextId = 1;
  #buffer = '';

  private constructor(socket: net.Socket) {
    this.#socket = socket;
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => {
      this.#buffer += chunk;
      for (let end = this.#buffer.indexOf('\n'); end !== -1; end = this.#buffer.indexOf('\n')) {
        const line = this.#buffer.slice(0, end);
        this.#buffer = this.#buffer.slice(end + 1);
        if (line.trim()) this.#receive(JSON.parse(line) as DriverResponse);
      }
    });
    const fail = () => {
      for (const pending of this.#pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error('The driver connection closed (did the app quit or crash?)'));
      }
      this.#pending.clear();
    };
    socket.on('close', fail);
    socket.on('error', fail);
  }

  static connect(socketPath: string): Promise<DriverClient> {
    return new Promise((resolve, reject) => {
      const socket = net.connect(socketPath);
      socket.once('error', reject);
      socket.once('connect', () => {
        socket.off('error', reject);
        resolve(new DriverClient(socket));
      });
    });
  }

  #receive(response: DriverResponse): void {
    const pending = this.#pending.get(response.id);
    if (!pending) return;
    this.#pending.delete(response.id);
    clearTimeout(pending.timer);
    if (response.ok) pending.resolve(response.result);
    else pending.reject(new DriverError(response.error));
  }

  call<M extends DriverMethod>(
    method: M,
    params: DriverMethods[M][0],
    timeoutMs?: number,
  ): Promise<DriverMethods[M][1]> {
    const id = this.#nextId++;
    const stepTimeout = (params as { timeout?: number }).timeout ?? 10_000;
    const limit = timeoutMs ?? stepTimeout + 20_000;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`driver ${method} got no answer within ${limit} ms`));
      }, limit);
      this.#pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });
      this.#socket.write(`${JSON.stringify({ id, method, params })}\n`);
    });
  }

  close(): void {
    this.#socket.end();
  }
}

// ---- The app -------------------------------------------------------------

interface AppParts {
  client: DriverClient;
  socketPath: string;
  testDir?: string;
  pid?: number;
  exited?: Promise<number | null>;
  /** Stops the process, display and fixtures; removes the temp dir unless `keep`. */
  cleanup?: (keep: boolean) => Promise<void>;
  keepArtifacts?: boolean;
}

/** A running app. Every method maps to one driver method (see protocol.ts for details). */
export class FiddleApp {
  readonly client: DriverClient;
  readonly socketPath: string;
  /** The temp dir: userData, cache, logs, `artifacts/` (screenshots) and `app-output.log`. */
  readonly testDir: string | undefined;
  readonly pid: number | undefined;
  /** Resolves with the exit code when a launched app exits. */
  readonly exited: Promise<number | null>;
  readonly #cleanup: AppParts['cleanup'];
  readonly #keep: boolean;
  #failed = false;
  #closed = false;

  constructor(parts: AppParts) {
    this.client = parts.client;
    this.socketPath = parts.socketPath;
    this.testDir = parts.testDir;
    this.pid = parts.pid;
    this.exited = parts.exited ?? new Promise(() => undefined);
    this.#cleanup = parts.cleanup;
    this.#keep = parts.keepArtifacts ?? false;
  }

  /** Attaches to an app that's already running (for `yarn driver`). */
  static async connect(socketPath: string): Promise<FiddleApp> {
    return new FiddleApp({ client: await DriverClient.connect(socketPath), socketPath });
  }

  /** Any driver method. A failed step throws a `DriverError` with the full report. */
  async call<M extends DriverMethod>(
    method: M,
    params: DriverMethods[M][0],
  ): Promise<DriverMethods[M][1]> {
    try {
      return await this.client.call(method, params);
    } catch (error) {
      this.#failed = true;
      throw error;
    }
  }

  windows() {
    return this.call('windows', {});
  }
  waitForWindow(window: WindowRef = 0, timeout?: number) {
    return this.call('waitForWindow', { window, timeout });
  }
  snapshot(window?: WindowRef) {
    return this.call('snapshot', { window });
  }
  /** Waits for at least one match; returns every match. */
  query(query: AppQuery): Promise<ElementInfo[]> {
    return this.call('query', toQuery(query));
  }
  /** Waits until nothing matches. */
  async waitForAbsent(query: AppQuery): Promise<void> {
    await this.call('query', { ...toQuery(query), state: 'absent' });
  }
  /** Real mouse click at the center of exactly one match (or `nth`), once it's enabled and on top. */
  click(query: AppQuery) {
    return this.call('click', toQuery(query));
  }
  /** Real key events; clicks `query` first if given. */
  async type(value: string, query?: AppQuery): Promise<void> {
    await this.call('type', { text: value, ...(query ? { query: toQuery(query) } : {}) });
  }
  /** `Enter`, `Escape`, `CmdOrCtrl+S`, `Shift+Tab`, ... Clicks `query` first if given. */
  async press(key: string, query?: AppQuery): Promise<void> {
    await this.call('press', { key, ...(query ? { query: toQuery(query) } : {}) });
  }
  async runCommand(id: string, window?: WindowRef): Promise<void> {
    await this.call('runCommand', { id, window });
  }
  stores(window?: WindowRef) {
    return this.call('stores', { window });
  }
  console(window?: WindowRef) {
    return this.call('console', { window });
  }
  clipboard() {
    return this.call('clipboard', {});
  }
  logs(tail?: number) {
    return this.call('logs', { tail });
  }
  screenshot(file?: string, window?: WindowRef) {
    return this.call('screenshot', { path: file, window });
  }
  waitForIdle(timeout?: number) {
    return this.call('waitForIdle', { timeout });
  }
  /** Calls `window.__fiddleTest[name](...args)` in the renderer. */
  evalHook(name: string, ...args: unknown[]) {
    return this.call('evalHook', { name, args });
  }
  /** Evaluates JavaScript in the renderer's main world. Prefer queries and hooks in specs. */
  evaluate(expression: string, window?: WindowRef) {
    return this.call('evaluate', { expression, window });
  }
  /** Calls a hook registered in main with `registerMainTestHook`. */
  mainHook(name: string, ...args: unknown[]) {
    return this.call('mainHook', { name, args });
  }
  /** Scripts the answer to the next native dialog of `kind`. */
  async queueDialog(kind: DialogKind, response: DialogResponse): Promise<void> {
    await this.call('queueDialog', { kind, response });
  }
  dialogs() {
    return this.call('dialogs', {});
  }
  sideEffects() {
    return this.call('sideEffects', {});
  }
  violations() {
    return this.call('violations', {});
  }

  /** Throws if the app made a non-loopback request, showed an unscripted dialog or lost a renderer. */
  async assertClean(): Promise<void> {
    const violations = await this.violations();
    if (violations.length > 0) {
      this.#failed = true;
      throw new Error(`Test isolation violations:\n- ${violations.join('\n- ')}`);
    }
  }

  /** Keeps the temp dir (screenshots, logs) after close. */
  markFailed(): void {
    this.#failed = true;
  }

  /** A screenshot, the accessibility snapshot and log tails, as text. Never throws. */
  async diagnostics(title = 'failure'): Promise<string> {
    const parts = [`--- e2e diagnostics: ${title} ---`, `test dir: ${this.testDir ?? '(unknown)'}`];
    const attempt = async (label: string, get: () => Promise<string>) => {
      try {
        parts.push(`${label}${await get()}`);
      } catch (error) {
        parts.push(`${label}(unavailable: ${error instanceof Error ? error.message.split('\n')[0] : String(error)})`);
      }
    };
    await attempt('screenshot: ', async () => (await this.client.call('screenshot', {})).path);
    await attempt('accessibility snapshot:\n', async () =>
      indent(await this.client.call('snapshot', {})),
    );
    await attempt('logs:\n', async () => {
      const logs = await this.client.call('logs', { tail: 40 });
      return `  main:\n${indent(logs.main.join('\n'))}\n  renderer:\n${indent(logs.renderer.join('\n'))}`;
    });
    await attempt('violations: ', async () =>
      JSON.stringify(await this.client.call('violations', {})),
    );
    return parts.join('\n');
  }

  /** Quits the app (killing it after 10 s) and cleans up. Keeps the temp dir if anything failed. */
  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    if (this.#cleanup) {
      try {
        await this.client.call('quit', {}, 5000);
      } catch {
        // Already gone.
      }
      await Promise.race([this.exited, new Promise((resolve) => setTimeout(resolve, 10_000))]);
      await this.#cleanup(this.#keep || this.#failed);
      if (this.#failed && this.testDir) {
        console.error(`[e2e] kept ${this.testDir} (screenshots in artifacts/, app-output.log)`);
      }
    }
    this.client.close();
  }
}

// ---- Launching ------------------------------------------------------------

export interface LaunchOptions {
  /** Default: out/test-build (`yarn workspace electron-fiddle driver:build`). */
  appDir?: string;
  /** Extra Electron arguments. */
  args?: string[];
  /** Extra environment variables for the app. */
  env?: Record<string, string>;
  /** Default `en-US`. */
  locale?: string;
  /** Seeds Math.random and UUIDs in main and Math.random in renderers. Default 1. */
  seed?: number;
  /** Share a fixture server; by default each app gets its own. */
  fixtures?: FixtureServer;
  /** Launch timeout in ms. Default 30000. */
  timeout?: number;
  /** Keep the temp dir after close even if nothing failed. */
  keepArtifacts?: boolean;
  /** Echo the app's stdout and stderr. Default: FIDDLE_E2E_VERBOSE=1. */
  verbose?: boolean;
}

const requireFromApp = createRequire(path.join(APP_DIR, 'package.json'));

function hasCommand(name: string): boolean {
  return (process.env.PATH ?? '').split(path.delimiter).some((dir) => {
    try {
      fs.accessSync(path.join(dir, name), fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

/** Chromium's sandbox needs a setuid chrome-sandbox on Linux, which containers usually lack. */
function electronArgs(electronPath: string): string[] {
  if (process.platform !== 'linux') return [];
  const args = ['--password-store=basic'];
  try {
    const stat = fs.statSync(path.join(path.dirname(electronPath), 'chrome-sandbox'));
    if (!(stat.uid === 0 && stat.mode & 0o4000) || process.getuid?.() === 0) {
      args.push('--no-sandbox');
    }
  } catch {
    args.push('--no-sandbox');
  }
  return args;
}

interface Display {
  env: Record<string, string>;
  stop(): void;
}

/**
 * A private X display per app: `Xvfb -displayfd` picks a free display number
 * atomically, so parallel apps never race for one (xvfb-run -a can). openbox
 * runs on it when installed, for real focus and window management.
 */
async function startDisplay(): Promise<Display> {
  const given = process.env.FIDDLE_E2E_DISPLAY;
  if (given) return { env: { DISPLAY: given }, stop: () => undefined };
  if (!hasCommand('Xvfb')) {
    if (process.env.DISPLAY) return { env: {}, stop: () => undefined };
    throw new Error('Xvfb is not installed and DISPLAY is not set');
  }
  const xvfb = spawn(
    'Xvfb',
    ['-displayfd', '3', '-screen', '0', '1440x900x24', '-nolisten', 'tcp', '-noreset'],
    { stdio: ['ignore', 'ignore', 'pipe', 'pipe'] },
  );
  const display = await new Promise<string>((resolve, reject) => {
    let out = '';
    let err = '';
    xvfb.stderr?.on('data', (chunk: Buffer) => {
      if (err.length < 4000) err += chunk.toString();
    });
    (xvfb.stdio[3] as Readable).on('data', (chunk: Buffer) => {
      out += chunk.toString();
      if (out.includes('\n')) resolve(`:${out.trim()}`);
    });
    xvfb.once('error', reject);
    xvfb.once('exit', (code) => reject(new Error(`Xvfb exited (${code}): ${err.trim()}`)));
  });
  const wm = hasCommand('openbox')
    ? spawn('openbox', ['--sm-disable'], {
        env: { ...process.env, DISPLAY: display },
        stdio: 'ignore',
      })
    : undefined;
  return {
    env: { DISPLAY: display },
    stop: () => {
      wm?.kill();
      xvfb.kill();
    },
  };
}

async function connectWhenReady(
  socketPath: string,
  timeout: number,
  exited: Promise<number | null>,
  crashed: () => boolean,
): Promise<DriverClient> {
  let exitCode: number | null | undefined;
  void exited.then((code) => {
    exitCode = code;
  });
  const deadline = Date.now() + timeout;
  for (;;) {
    if (exitCode !== undefined) {
      throw new Error(`the app exited (code ${exitCode}) before its driver started`);
    }
    if (crashed()) throw new Error('the main process threw during startup');
    try {
      return await DriverClient.connect(socketPath);
    } catch {
      // Not listening yet.
    }
    if (Date.now() > deadline) throw new Error(`the driver socket didn't open within ${timeout} ms`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/** Launches the test build and waits for its first window to be shown. */
export async function launchApp(options: LaunchOptions = {}): Promise<FiddleApp> {
  const appDir = options.appDir ?? TEST_BUILD_DIR;
  const timeout = options.timeout ?? 30_000;
  if (!fs.existsSync(path.join(appDir, 'package.json'))) {
    throw new Error(
      `No test build in ${appDir}. Build it with: yarn workspace electron-fiddle driver:build`,
    );
  }
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fiddle-e2e-'));
  const socketPath =
    process.platform === 'win32'
      ? `\\\\.\\pipe\\fiddle-driver-${path.basename(testDir)}`
      : path.join(testDir, 'driver.sock');
  const fixtures = options.fixtures ?? (await startFixtureServer());
  const display = process.platform === 'linux' ? await startDisplay() : undefined;

  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of ['ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS', 'ELECTRON_ENABLE_LOGGING']) {
    delete env[key];
  }
  Object.assign(env, display?.env, {
    FIDDLE_TEST_MODE: '1',
    FIDDLE_TEST_DIR: testDir,
    FIDDLE_TEST_FIXTURE_URL: fixtures.url,
    FIDDLE_TEST_SEED: String(options.seed ?? 1),
    FIDDLE_TEST_LOCALE: options.locale ?? 'en-US',
    ELECTRON_FIDDLE_DRIVER_SOCKET: socketPath,
    TZ: 'UTC',
    LANG: 'en_US.UTF-8',
    LANGUAGE: 'en_US',
    LC_ALL: 'en_US.UTF-8',
    ...options.env,
  });

  const electronPath = requireFromApp('electron') as string;
  const output = fs.createWriteStream(path.join(testDir, 'app-output.log'));
  const tail: string[] = [];
  const verbose = options.verbose ?? process.env.FIDDLE_E2E_VERBOSE === '1';
  const child = spawn(
    electronPath,
    [...electronArgs(electronPath), appDir, ...(options.args ?? [])],
    { env, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', (chunk: Buffer) => {
      output.write(chunk);
      if (verbose) process.stderr.write(chunk);
      tail.push(...chunk.toString().split('\n').filter(Boolean));
      tail.splice(0, Math.max(0, tail.length - 60));
    });
  }
  const exited = new Promise<number | null>((resolve) => {
    child.once('exit', (code) => resolve(code));
    child.once('error', () => resolve(null));
  });
  // An uncaught exception in main leaves Electron up behind an error dialog; fail fast.
  let mainCrashed = false;
  child.stderr.on('data', (chunk: Buffer) => {
    if (chunk.toString().includes('A JavaScript error occurred in the main process')) {
      mainCrashed = true;
    }
  });

  const cleanup = async (keep: boolean) => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    display?.stop();
    output.end();
    if (!options.fixtures) await fixtures.close();
    if (!keep) fs.rmSync(testDir, { recursive: true, force: true });
  };

  try {
    const client = await connectWhenReady(socketPath, timeout, exited, () => mainCrashed);
    const app = new FiddleApp({
      client,
      socketPath,
      testDir,
      pid: child.pid,
      exited,
      cleanup,
      keepArtifacts: options.keepArtifacts,
    });
    try {
      await app.waitForWindow(0, timeout);
    } catch (error) {
      client.close();
      throw error;
    }
    return app;
  } catch (error) {
    await cleanup(true);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Launching the app failed: ${message}\n` +
        `app output (${path.join(testDir, 'app-output.log')}):\n${indent(tail.join('\n'))}`,
      { cause: error },
    );
  }
}
