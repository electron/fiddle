import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IGNORE_SCRIPTS_ENV } from '../../fiddle/modules';

vi.mock('electron', () => ({ shell: { openPath: vi.fn() } }));
vi.mock('../i18n', () => ({ tm: () => (key: string) => key }));
vi.mock('../documents/service', () => ({}));
vi.mock('../run/service', () => ({ PM_INSTALL_URLS: { npm: '', yarn: '' } }));

const { forgeTaskCommands, runForgeTask } = await import('./service');

// @feature run.package-steps settings.socket-firewall
describe('forgeTaskCommands', () => {
  it('installs through Socket Firewall when given sfw.mjs, like a run', () => {
    expect(forgeTaskCommands('npm', 'make', { sfwPath: '/res/sfw.mjs', ignoreScripts: true })).toEqual([
      { command: 'node', args: ['/res/sfw.mjs', 'npm', 'install', '-S'], env: IGNORE_SCRIPTS_ENV },
      { command: 'npm', args: ['run', 'make'] },
    ]);
  });

  it('runs the package manager directly without it', () => {
    expect(forgeTaskCommands('yarn', 'package')).toEqual([
      { command: 'yarn', args: ['install'] },
      { command: 'yarn', args: ['run', 'package'] },
    ]);
    expect(forgeTaskCommands('npm', 'package', { sfwPath: undefined })[0]).toEqual({ command: 'npm', args: ['install', '-S'] });
  });
});

// @feature run.package-steps settings.socket-firewall
describe('runForgeTask', () => {
  let dir: string;
  let fakeSfw: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'fiddle-forge-task-'));
    // Stands in for sfw.mjs: records what it was asked to run, then fails, so `<pm> run` never starts.
    fakeSfw = path.join(dir, 'fake-sfw.mjs');
    await writeFile(
      fakeSfw,
      `import { writeFileSync } from 'node:fs';
writeFileSync('args.json', JSON.stringify({ args: process.argv.slice(2), ignoreScripts: process.env.npm_config_ignore_scripts ?? null }));
console.log('blocked by sfw');
process.exit(1);`,
    );
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('wraps the install with sfw.mjs and reports the wrapped command when it fails', async () => {
    const output: string[] = [];
    const failed = await runForgeTask(dir, 'npm', 'package', {
      env: process.env,
      onOutput: (text) => output.push(text),
      ignoreScripts: true,
      sfwPath: fakeSfw,
    });
    expect(failed).toEqual({ command: `node ${fakeSfw} npm install -S`, code: 1 });
    expect(JSON.parse(await readFile(path.join(dir, 'args.json'), 'utf8'))).toEqual({
      args: ['npm', 'install', '-S'],
      ignoreScripts: 'true',
    });
    expect(output.join('')).toContain('blocked by sfw');
  });
});
