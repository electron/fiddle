import * as builtinModules from 'builtin-modules';
import { exec } from 'child_process';

export interface InstallModulesOptions {
  dir: string;
}

export function findModules(input: string): Array<string> {
  const matchRequire = /require\(['"]{1}([\w\d\/\-\_]*)['"]{1}\)/;
  const matched = input.match(matchRequire);
  const result: Array<string> = [];

  if (matched && matched.length > 0) {
    const candidates = matched.slice(1);
    candidates.forEach((candidate) => {
      if (candidate === 'electron') return;
      if (builtinModules.indexOf(candidate) > -1) return;
      if (candidate.startsWith('.')) return;
      result.push(candidate);
    });
  }

  return result;
}

export function installModules({ dir }: InstallModulesOptions, ...names: Array<string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ['-S'];
    const cliArgs = ['npm i'].concat(args, names).join(' ');

    exec(cliArgs, { cwd: dir }, (error, result) => {
      if (error) {
        reject(error);
      }

      resolve(result.toString());
    });
  });
}
