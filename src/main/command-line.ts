import * as commander from 'commander';
import * as fs from 'fs-extra';

import { app } from 'electron';
import {
  ElectronReleaseChannel,
  OutputEntry,
  RunResult,
  SetupRequest,
} from '../interfaces';
import { IpcEvents } from '../ipc-events';
import { getGistId } from '../utils/gist';
import { ipcMainManager } from './ipc';

const program = new commander.Command();

function getSetup(opts: commander.OptionValues): SetupRequest {
  const config: SetupRequest = {
    showChannels: [],
    hideChannels: [],
  };

  const { fiddle, version, betas, nightlies } = opts;

  if (fiddle) {
    if (fs.existsSync(fiddle)) {
      config.fiddle = { filePath: fiddle };
    } else {
      const gistId = getGistId(fiddle);
      if (gistId) {
        config.fiddle = { gistId };
      }
    }
  }

  if (version) {
    config.version = version;
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

  return config;
}

async function sendTask(type: IpcEvents, task: any) {
  const onOutputEntry = (
    _event: Electron.IpcMainEvent,
    message: OutputEntry,
  ) => {
    console.log(
      `[${new Date(message.timestamp).toLocaleTimeString()}] ${message.text}`,
    );
  };
  const onTaskDone = (_event: Electron.IpcMainEvent, result: RunResult) => {
    switch (result) {
      case RunResult.SUCCESS:
        app.exit(0);
        break;
      case RunResult.FAILURE:
        app.exit(1);
        break;
      case RunResult.INVALID:
        app.exit(2);
        break;
    }
  };
  ipcMainManager.on(IpcEvents.OUTPUT_ENTRY, onOutputEntry);
  ipcMainManager.once(IpcEvents.TASK_DONE, onTaskDone);
  ipcMainManager.send(type, [task]);
}

async function bisect(good: string, bad: string, opts: commander.OptionValues) {
  sendTask(IpcEvents.FIDDLE_BISECT, {
    setup: getSetup(opts),
    goodVersion: good,
    badVersion: bad,
  });
}

async function test(opts: commander.OptionValues) {
  sendTask(IpcEvents.FIDDLE_TEST, {
    setup: getSetup(opts),
  });
}

export async function processCommandLine() {
  program
    .command('bisect <goodVersion> <badVersion>')
    .description('Find where regressions were introduced')
    .option('--fiddle <dir|gist>', 'Open a fiddle')
    .option('--nightlies', 'Include nightly releases')
    .option('--no-nightlies', 'Omit nightly releases')
    .option('--betas', 'Include beta releases')
    .option('--no-betas', 'Omit beta releases')
    .action(bisect);

  program
    .command('test')
    .description('Test a fiddle')
    .option('--version <version>', 'Use Electron version', process.cwd())
    .option('--fiddle <dir|gist>', 'Open a fiddle')
    .action(test);

  program.addHelpText(
    'after',
    `

Example calls:
  $ electron-fiddle bisect 10.0.0 11.2.0 --fiddle /path/to/fiddle
  $ electron-fiddle bisect 10.0.0 11.2.0 --fiddle /path/to/fiddle --betas --nightlies
  $ electron-fiddle test --version 11.2.0 --fiddle /path/to/fiddle
  $ electron-fiddle test --version 11.2.0 --fiddle https://gist.github.com/ckerr/af3e1a018f5dcce4a2ff40004ef5bab5
  $ electron-fiddle test --version 11.2.0 --fiddle af3e1a018f5dcce4a2ff40004ef5bab5
`,
  );

  const { argv } = process;
  if (argv.length > 2) {
    program.parse(argv, { from: 'electron' });
  }
}
