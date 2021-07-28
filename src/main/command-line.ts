import * as commander from 'commander';
import * as fs from 'fs-extra';
import * as os from 'os';
import getos from 'getos';

import {
  ElectronReleaseChannel,
  OutputEntry,
  RunResult,
  SetupRequest,
} from '../interfaces';
import { IpcEvents } from '../ipc-events';
import { getGistId } from '../utils/gist';
import { ipcMainManager } from './ipc';
import { findProtocolArg } from './protocol';

function getSetup(opts: commander.OptionValues): SetupRequest {
  const config: SetupRequest = {
    showChannels: [],
    hideChannels: [],
  };

  const { betas, fiddle, full, nightlies, obsolete, version } = opts;

  if (fs.existsSync(fiddle)) {
    config.fiddle = { filePath: fiddle };
  } else {
    const gistId = getGistId(fiddle);
    if (gistId) {
      config.fiddle = { gistId };
    }
  }
  if (!config.fiddle) {
    throw `Unrecognized Fiddle "${fiddle}"`;
  }

  if (version) {
    config.version = version;
  }

  if (typeof obsolete === 'boolean') {
    config.useObsolete = obsolete;
  }

  if (betas) {
    config.showChannels.push(ElectronReleaseChannel.beta);
  } else if (betas === false) {
    config.hideChannels.push(ElectronReleaseChannel.beta);
  }

  if (nightlies) {
    config.showChannels.push(ElectronReleaseChannel.nightly);
  } else if (nightlies === false) {
    config.hideChannels.push(ElectronReleaseChannel.nightly);
  }

  if (full) {
    config.useObsolete = true;
    config.hideChannels = [];
    config.showChannels = [
      ElectronReleaseChannel.beta,
      ElectronReleaseChannel.nightly,
      ElectronReleaseChannel.stable,
    ];
  }

  return config;
}

const exitCodes = Object.freeze({
  [RunResult.SUCCESS]: 0,
  [RunResult.FAILURE]: 1,
  [RunResult.INVALID]: 2,
});

async function sendTask(type: IpcEvents, task: any) {
  const onOutputEntry = (_: any, msg: OutputEntry) => {
    console.log(`[${msg.timeString}] ${msg.text}`);
  };
  const onTaskDone = (_: any, r: RunResult) => exitWithCode(exitCodes[r]);
  ipcMainManager.on(IpcEvents.OUTPUT_ENTRY, onOutputEntry);
  ipcMainManager.once(IpcEvents.TASK_DONE, onTaskDone);
  ipcMainManager.send(type, [task]);
}

async function logConfig() {
  const packageJson = require('../../package.json');
  const osinfo = await new Promise((resolve) =>
    getos((err, result) => resolve(err || result)),
  );

  console.log(`${packageJson.name} started
   argv: ${JSON.stringify(process.argv)}
   date: ${new Date()}
   fiddle.version: ${packageJson.version}
   os.arch: ${os.arch()}
   os.platform: ${os.platform()}
   os.release: ${os.release()}
   os.version: ${os.version()}
   platform: ${JSON.stringify(osinfo)}`);
}

async function exitWithCode(code: number) {
  console.log(`Electron Fiddle is exiting with code ${code}`);
  process.exit(code);
}

async function bisect(good: string, bad: string, opts: commander.OptionValues) {
  try {
    if (opts.logConfig) await logConfig();
    await sendTask(IpcEvents.TASK_BISECT, {
      setup: getSetup(opts),
      goodVersion: good,
      badVersion: bad,
    });
  } catch (err) {
    console.error(err);
    exitWithCode(exitCodes[RunResult.INVALID]);
  }
}

async function test(opts: commander.OptionValues) {
  try {
    if (opts.logConfig) await logConfig();
    await sendTask(IpcEvents.TASK_TEST, {
      setup: getSetup(opts),
    });
  } catch (err) {
    console.error(err);
    exitWithCode(exitCodes[RunResult.INVALID]);
  }
}

export async function processCommandLine(argv: string[]) {
  const program = new commander.Command();
  program.exitOverride();

  program
    .command('bisect <goodVersion> <badVersion>')
    .description('Find where regressions were introduced')
    .option('--fiddle <dir|gist>', 'Open a fiddle', process.cwd())
    .option('--log-config', 'Log the fiddle version, platform, and args', false)
    .option('--full', 'Shorthand --betas --nightlies --obsolete', false)
    .option('--nightlies', 'Include nightly releases')
    .option('--no-nightlies', 'Omit nightly releases')
    .option('--betas', 'Include beta releases')
    .option('--no-betas', 'Omit beta releases')
    .option('--obsolete', 'Include obsolete releases')
    .option('--no-obsolete', 'Omit obsolete releases')
    .action(bisect);

  program
    .command('test')
    .description('Test a fiddle')
    .option('--version <version>', 'Use Electron version')
    .option('--fiddle <dir|gist>', 'Open a fiddle', process.cwd())
    .option('--log-config', 'Log the fiddle version, platform, and args', false)
    .action(test);

  program.addHelpText(
    'after',
    `

Example calls:
  $ electron-fiddle bisect 10.0.0 11.2.0 --fiddle /path/to/fiddle
  $ electron-fiddle bisect 10.0.0 11.2.0 --fiddle /path/to/fiddle --full
  $ electron-fiddle test --version 11.2.0 --fiddle /path/to/fiddle
  $ electron-fiddle test --version 11.2.0 --fiddle 8c5fc0c6a5153d49b5a4a56d3ed9da8f
  $ electron-fiddle test --version 11.2.0 --fiddle https://gist.github.com/ckerr/8c5fc0c6a5153d49b5a4a56d3ed9da8f/
`,
  );

  // do nothing if argv holds no commands/options
  if (argv.length > (process.defaultApp ? 2 : 1)) {
    try {
      if (findProtocolArg(argv)) return;
      await program.parseAsync(argv, { from: 'electron' });
    } catch (err) {
      console.error(err);
      exitWithCode(exitCodes[RunResult.INVALID]);
    }
  }
}
