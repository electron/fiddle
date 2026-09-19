#!/usr/bin/env node
// `yarn driver <command>`: drive a test build of the app from the shell.
// Every command prints one JSON object, `{ ok: true, result }` or
// `{ ok: false, error }` (exit code 1). `launch` starts a background process
// that owns the app, its display and its fixture server until `quit`.
//
//   launch [--no-build] [--seed N] [--locale L]   build the test build, start the app
//   snapshot                                      accessibility tree, `role "name"` lines
//   query <role> [name] | query --text <text>     wait for matches, list them
//   click <role> [name] | click --text <text>     real click on exactly one match
//   type <text> [--role R --name N | --text T]    type (into a clicked element)
//   press <key> [--role R --name N | --text T]    e.g. Enter, Escape, CmdOrCtrl+S
//   run-command <id>                              run a command from the registry
//   screenshot [file]                             PNG of the window
//   eval-hook <name> [json-args...]               window.__fiddleTest[name](...)
//   eval <expression>                             evaluate in the renderer
//   windows | stores | console | logs | clipboard | dialogs | side-effects | violations
//   wait-idle                                     no pending IPC, network or frames
//   queue-dialog <messageBox|open|save> <json>    answer the next native dialog
//   call <method> [json-params]                   any driver method (protocol.ts)
//   quit                                          quit the app and clean up
//
// Options: --window <index|windowId>, --timeout <ms>, --session <name>
// (default: $FIDDLE_DRIVER_SESSION, else `default`, so two agents share one app
// unless they name sessions). Names like /regex/i are regular expressions.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { DriverError, FiddleApp, launchApp, type AppQuery } from '../e2e/driver.ts';
import type {
  DialogKind,
  DriverMethod,
  WindowRef,
} from '../src/main/test-driver/protocol.ts';

interface Session {
  status: 'starting' | 'ready' | 'error';
  message?: string;
  socketPath?: string;
  daemonPid?: number;
  appPid?: number;
  testDir?: string;
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    window: { type: 'string' },
    timeout: { type: 'string' },
    session: { type: 'string', default: process.env.FIDDLE_DRIVER_SESSION ?? 'default' },
    text: { type: 'string' },
    role: { type: 'string' },
    name: { type: 'string' },
    seed: { type: 'string' },
    locale: { type: 'string' },
    'no-build': { type: 'boolean', default: false },
  },
});

const sessionFile = path.join(os.tmpdir(), 'fiddle-driver', `${values.session}.json`);
const cwd = process.env.INIT_CWD ?? process.cwd();

function print(value: unknown, ok = true): never {
  process.stdout.write(
    `${JSON.stringify(ok ? { ok, result: value } : { ok, error: value }, null, 2)}\n`,
  );
  process.exit(ok ? 0 : 1);
}

function readSession(): Session | undefined {
  try {
    return JSON.parse(fs.readFileSync(sessionFile, 'utf8')) as Session;
  } catch {
    return undefined;
  }
}

function writeSession(session: Session): void {
  fs.mkdirSync(path.dirname(sessionFile), { recursive: true });
  fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2));
}

function alive(pid: number | undefined): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

const matcher = (value: string): string | RegExp => {
  const match = /^\/(.*)\/([a-z]*)$/.exec(value);
  return match ? new RegExp(match[1] ?? '', match[2]) : value;
};

const windowRef = (): WindowRef | undefined =>
  values.window === undefined
    ? undefined
    : /^\d+$/.test(values.window)
      ? Number(values.window)
      : values.window;

function queryFrom(args: string[]): AppQuery {
  const query: AppQuery = {};
  const [roleName = values.role, name = values.name] = args;
  if (values.text !== undefined) query.text = matcher(values.text);
  if (roleName !== undefined) query.role = roleName;
  if (name !== undefined) query.name = matcher(name);
  if (values.timeout !== undefined) query.timeout = Number(values.timeout);
  const window = windowRef();
  if (window !== undefined) query.window = window;
  return query;
}

const json = (value: string | undefined): unknown =>
  value === undefined ? undefined : JSON.parse(value);

/** Runs in the background: owns the app until it exits. */
async function serve(): Promise<void> {
  writeSession({ status: 'starting', daemonPid: process.pid });
  let app: FiddleApp;
  try {
    app = await launchApp({
      keepArtifacts: true,
      seed: values.seed === undefined ? undefined : Number(values.seed),
      locale: values.locale,
    });
  } catch (error) {
    writeSession({
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
  writeSession({
    status: 'ready',
    socketPath: app.socketPath,
    daemonPid: process.pid,
    appPid: app.pid,
    testDir: app.testDir,
  });
  const stop = () => void app.close().then(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  await app.exited;
  await app.close();
  fs.rmSync(sessionFile, { force: true });
  process.exit(0);
}

async function launch(): Promise<void> {
  const existing = readSession();
  if (existing?.status === 'ready' && alive(existing.daemonPid)) {
    print({ ...existing, alreadyRunning: true });
  }
  if (!values['no-build']) await (await import('./driver-build.ts')).buildTestApp();
  fs.rmSync(sessionFile, { force: true });
  fs.mkdirSync(path.dirname(sessionFile), { recursive: true });
  const log = fs.openSync(
    path.join(path.dirname(sessionFile), `${values.session}.log`),
    'w',
  );
  const daemon = spawn(
    process.execPath,
    [
      ...process.execArgv,
      fileURLToPath(import.meta.url),
      '__serve',
      ...process.argv.slice(3),
    ],
    { detached: true, stdio: ['ignore', log, log], cwd },
  );
  daemon.unref();
  const deadline = Date.now() + 60_000;
  for (;;) {
    const session = readSession();
    if (session?.status === 'ready') print(session);
    if (session?.status === 'error') print({ message: session.message }, false);
    if (Date.now() > deadline || (daemon.exitCode !== null && !session)) {
      print(
        {
          message: `The app didn't start; see ${path.dirname(sessionFile)}/${values.session}.log`,
        },
        false,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function command(name: string, args: string[]): Promise<unknown> {
  const session = readSession();
  if (session?.status !== 'ready' || !session.socketPath || !alive(session.daemonPid)) {
    throw new Error(
      `No app is running for session "${values.session}". Run: yarn driver launch`,
    );
  }
  const app = await FiddleApp.connect(session.socketPath);
  const window = windowRef();
  try {
    switch (name) {
      case 'snapshot':
        return await app.snapshot(window);
      case 'query':
        return await app.query(queryFrom(args));
      case 'click':
        return await app.click(queryFrom(args));
      case 'type': {
        const [value = '', ...rest] = args;
        const hasTarget =
          values.role !== undefined || values.text !== undefined || rest.length > 0;
        await app.type(value, hasTarget ? queryFrom(rest) : undefined);
        return null;
      }
      case 'press':
        await app.press(
          args[0] ?? '',
          values.role || values.text ? queryFrom([]) : undefined,
        );
        return null;
      case 'run-command':
        await app.runCommand(args[0] ?? '', window);
        return null;
      case 'screenshot':
        return await app.screenshot(
          args[0] ? path.resolve(cwd, args[0]) : undefined,
          window,
        );
      case 'eval-hook':
        return await app.call('evalHook', {
          name: args[0] ?? '',
          args: args.slice(1).map((a) => json(a)),
          window,
        });
      case 'eval':
        return await app.evaluate(args.join(' '), window);
      case 'windows':
        return await app.windows();
      case 'stores':
        return await app.stores(window);
      case 'console':
        return await app.console(window);
      case 'logs':
        return await app.logs();
      case 'clipboard':
        return await app.clipboard();
      case 'dialogs':
        return await app.dialogs();
      case 'side-effects':
        return await app.sideEffects();
      case 'violations':
        return await app.violations();
      case 'wait-idle':
        return await app.waitForIdle(values.timeout ? Number(values.timeout) : undefined);
      case 'queue-dialog':
        await app.queueDialog(args[0] as DialogKind, json(args[1]) as never);
        return null;
      case 'call':
        return await app.call(args[0] as DriverMethod, (json(args[1]) ?? {}) as never);
      case 'quit': {
        await app.call('quit', {}).catch(() => undefined);
        const deadline = Date.now() + 15_000;
        while (alive(session.daemonPid) && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        return { quit: true, testDir: session.testDir };
      }
      default:
        throw new Error(
          `Unknown command ${JSON.stringify(name)}; see the header of tools/driver.ts`,
        );
    }
  } finally {
    app.client.close();
  }
}

const [name, ...args] = positionals;
try {
  if (name === '__serve') await serve();
  else if (name === 'launch') await launch();
  else if (!name)
    throw new Error(
      'Usage: yarn driver <launch|snapshot|click|type|press|screenshot|logs|eval-hook|quit|...>',
    );
  else print(await command(name, args));
} catch (error) {
  print(
    error instanceof DriverError
      ? error.report
      : { message: error instanceof Error ? error.message : String(error) },
    false,
  );
}
