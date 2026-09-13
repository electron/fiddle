/**
 * Headless mode (REQUIREMENTS §7): `electron-fiddle --headless <command>`.
 *
 * main/index.ts checks for `--headless` before the single-instance lock and
 * hands over here instead of starting the app. So headless mode never takes
 * the lock, opens no windows, hides the Dock icon, and never runs the
 * migration, update checks or crash reports (crash/sentry.ts skips headless
 * too), and never reads or writes the app's stores. It shares the `core`
 * cache with the app. Chromium runs with its own `--headless` switch, so no
 * display is needed.
 */
import { app } from 'electron';

import { FiddleError } from '../../shared/errors';
import { initMainI18n, tm } from '../i18n';
import { helpText, parseCommandLine } from './argv';
import { runCommand } from './commands';
import { exitCodeForError, localeFromEnv, Reporter, type Writers } from './output';

const HEADLESS_SWITCH = '--headless';

/** The arguments after `--headless`, or undefined when the app isn't headless. */
export function headlessArgs(argv: readonly string[]): string[] | undefined {
  const index = argv.indexOf(HEADLESS_SWITCH);
  return index === -1 ? undefined : argv.slice(index + 1);
}

/** Runs one command, then exits with its code. Call before `ready`. */
export function startHeadless(args: string[]): void {
  app.dock?.hide();
  // There are no windows, so Chromium needn't start the GPU process.
  app.disableHardwareAcceleration();
  quietConsole();
  main(args).then(exit, (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
    return exit(70);
  });
}

const io: Writers = {
  stdout: (text) => void process.stdout.write(text),
  stderr: (text) => void process.stderr.write(text),
};

async function main(args: string[]): Promise<number> {
  await app.whenReady();
  await initMainI18n(localeFromEnv(process.env));
  const t = tm('mainCli');

  let parsed: ReturnType<typeof parseCommandLine>;
  try {
    parsed = parseCommandLine(args);
  } catch (error) {
    const e = FiddleError.from(error);
    const human = `${t('errorPrefix', { message: e.message })}\n${t('errorHelpHint')}`;
    new Reporter(args.includes('--json'), null, io).error(e, human);
    return exitCodeForError(e.code);
  }
  if (parsed.kind === 'help') {
    io.stdout(helpText(parsed));
    return 0;
  }

  const reporter = new Reporter(parsed.json, parsed.command, io);
  const controller = new AbortController();
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => controller.abort());
  try {
    const code = await runCommand(parsed.command, parsed.input, { reporter, signal: controller.signal });
    return controller.signal.aborted ? 130 : code;
  } catch (error) {
    if (controller.signal.aborted) return 130;
    const e = FiddleError.from(error);
    if (e.code === 'internal') console.error(error);
    reporter.error(e, t('errorPrefix', { message: e.message }));
    return exitCodeForError(e.code);
  }
}

/** Main's info logs would mix into stdout. FIDDLE_CLI_VERBOSE=1 sends them to stderr instead. */
function quietConsole(): void {
  const sink =
    process.env.FIDDLE_CLI_VERBOSE === '1' ? (...data: unknown[]) => console.error(...data) : () => {};
  console.log = sink;
  console.info = sink;
  console.debug = sink;
}

async function exit(code: number): Promise<void> {
  // Pipes can be asynchronous; let them drain before the process ends.
  const drain = (stream: NodeJS.WriteStream) => new Promise<void>((resolve) => stream.write('', () => resolve()));
  await Promise.all([drain(process.stdout), drain(process.stderr)]);
  app.exit(code);
}
