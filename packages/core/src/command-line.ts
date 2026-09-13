import { inspect } from 'node:util';

import { debug } from './debug.js';
import { ElectronVersions } from './versions.js';
import { type Fiddle, FiddleFactory } from './fiddle.js';
import { Runner } from './runner.js';

export async function runFromCommandLine(argv: string[]): Promise<void> {
  const d = debug('fiddle-core:runFromCommandLine');

  d(inspect({ argv }));
  const versions = await ElectronVersions.create();
  const fiddleFactory = new FiddleFactory();
  const runner = await Runner.create({ versions, fiddleFactory });
  const versionArgs: string[] = [];

  type Cmd = 'bisect' | 'test' | undefined;
  let cmd: Cmd = undefined;
  let runWithIdentity: boolean = false;
  let fiddle: Fiddle | undefined = undefined;

  d('argv', inspect(argv));
  for (const param of argv) {
    d('param', param);
    if (param === 'bisect') {
      cmd = 'bisect';
    } else if (param === 'test' || param === 'start' || param === 'run') {
      d('it is test');
      cmd = 'test';
    } else if (param === 'test:msix' || param === 'start:msix' || param === 'run:msix') {
      cmd = 'test';
      runWithIdentity = true;
    } else if (versions.isVersion(param)) {
      versionArgs.push(param);
    } else {
      fiddle = await fiddleFactory.create(param);
      if (fiddle) continue;
      console.error(
        `Unrecognized parameter "${param}". Must be 'test', 'start', 'bisect', a version, a gist, a folder, or a repo URL.`,
      );
      process.exit(1);
    }
  }

  d(inspect({ cmd, fiddle, versions }));

  if (!cmd) {
    console.error(
      "Command-line parameters must include one of ['bisect', 'test', 'start']",
    );
    process.exit(1);
  }

  if (!fiddle) {
    console.error('No fiddle specified.');
    process.exit(1);
  }

  const [first, second] = versionArgs;

  if (cmd === 'test' && versionArgs.length === 1 && first) {
    const result = await runner.run(first, fiddle, {
      out: process.stdout,
      runWithIdentity: runWithIdentity,
    });
    const vals = ['test_passed', 'test_failed', 'test_error', 'system_error'];
    process.exitCode = vals.indexOf(result.status);
    return;
  }

  if (cmd === 'bisect' && versionArgs.length === 2 && first && second) {
    const result = await runner.bisect(first, second, fiddle, {
      out: process.stdout,
    });
    const vals = ['bisect_succeeded', 'test_error', 'system_error'];
    process.exitCode = vals.indexOf(result.status);
    return;
  }

  console.error(`Invalid parameters. Got ${cmd}, ${versionArgs.join(', ')}`);
  process.exit(1);
}
