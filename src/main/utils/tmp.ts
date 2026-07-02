import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const TEMPLATE_PATTERN = /XXXXXX/;

let _gracefulCleanup = false;
const _pathsToCleanup: string[] = [];

export async function tmpName(options: { template: string }): Promise<string> {
  if (!TEMPLATE_PATTERN.test(options.template)) {
    throw new Error('Invalid template provided');
  }

  const tempPath = path
    .join(await fs.promises.realpath(os.tmpdir()), options.template)
    .replace(TEMPLATE_PATTERN, crypto.randomBytes(3).toString('hex'));
  _pathsToCleanup.push(tempPath);

  return tempPath;
}

export function dirSync(options: { prefix: string }): string {
  const tempPath = fs.mkdtempSync(
    path.join(fs.realpathSync(os.tmpdir()), options.prefix),
  );
  _pathsToCleanup.push(tempPath);
  return tempPath;
}

export function setGracefulCleanup(): void {
  _gracefulCleanup = true;
}

process.addListener('exit', () => {
  if (_gracefulCleanup) {
    for (const tempPath of _pathsToCleanup) {
      fs.rmSync(tempPath, { recursive: true, force: true });
    }
  }
});
