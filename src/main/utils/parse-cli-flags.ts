import { parseArgs } from 'node:util';

import { IpcMainEvent } from 'electron';

import { IpcEvents } from '../../ipc-events';
import { ipcMainManager } from '../ipc';

export function buildChildFlags(
  dir: string,
  executionFlags: string[],
): string[] | { error: string } {
  const flags = [dir, '--inspect'];

  for (const flag of executionFlags) {
    const { values } = parseArgs({ args: [flag], strict: false });
    if (!values || !Object.keys(values).length) {
      return { error: `Could not parse cli flag: ${flag}` };
    }
    flags.push(flag);
  }

  return flags;
}

export async function setupCliFlags() {
  ipcMainManager.handle(
    IpcEvents.PARSE_CLI_FLAGS,
    (_: IpcMainEvent, dir: string, executionFlags: string[]) =>
      buildChildFlags(dir, executionFlags),
  );
}
