import fs from 'node:fs';

import { beforeAll, describe, expect, it } from 'vitest';

import { FiddleError } from '../../shared/errors';
import { initMainI18n } from '../i18n';
import { fieldKey, fields, helpText, parseCommandLine } from './argv';
import { commandIds, descriptorOf } from './descriptors';

beforeAll(async () => {
  await initMainI18n(['en']);
});

function usageError(argv: string[]): FiddleError {
  try {
    parseCommandLine(argv);
  } catch (error) {
    return error as FiddleError;
  }
  throw new Error(`parsed: ${argv.join(' ')}`);
}

describe('parseCommandLine', () => {
  it('parses flags, repeatables and defaults from the descriptor', () => {
    const parsed = parseCommandLine([
      'run',
      './fiddle',
      '--version',
      '30.0.0',
      '--flag=--enable-logging',
      '--flag',
      '--no-sandbox',
      '--env',
      'A=1',
      '--module',
      'lodash@4',
      '--trust',
      '--json',
    ]);
    expect(parsed).toEqual({
      kind: 'command',
      json: true,
      command: 'run',
      input: {
        fiddle: './fiddle',
        version: '30.0.0',
        flag: ['--enable-logging', '--no-sandbox'],
        env: ['A=1'],
        module: ['lodash@4'],
        pm: 'npm',
        logging: false,
        trust: true,
      },
    });
  });

  it('matches two-word commands and kebab-case flags', () => {
    expect(
      parseCommandLine([
        'versions',
        'list',
        '--channel',
        'beta',
        '--channel',
        'nightly',
        '--obsolete',
      ]),
    ).toEqual({
      kind: 'command',
      json: false,
      command: 'versions list',
      input: { channel: ['beta', 'nightly'], obsolete: true },
    });
    const parsed = parseCommandLine(['run', 'x', '--electron-path', '/e']);
    expect(parsed.kind === 'command' && parsed.input.electronPath).toBe('/e');
  });

  it('takes --json and --help anywhere before --', () => {
    expect(parseCommandLine(['--json', 'versions', 'remove', '30.0.0'])).toMatchObject({
      json: true,
      input: { version: '30.0.0' },
    });
    expect(parseCommandLine(['run', 'x', '--help'])).toEqual({
      kind: 'help',
      json: false,
      command: 'run',
    });
  });

  it('returns help for no command or a group', () => {
    expect(parseCommandLine([])).toEqual({ kind: 'help', json: false });
    expect(parseCommandLine(['gist'])).toEqual({
      kind: 'help',
      json: false,
      group: 'gist',
    });
  });

  it.each([
    [['nope'], "“nope” isn't a command."],
    [['versions', 'nope'], "“versions nope” isn't a command."],
    [['run', 'x', '--nope'], "--nope isn't an option of “run”."],
    [['run', 'x', '-v'], "-v isn't an option of “run”."],
    [['run', 'x', '--version'], '--version needs a value.'],
    [['run', 'x', '--trust=yes'], "--trust doesn't take a value."],
    [['run', 'x', '--pm', 'pnpm'], '--pm must be one of: npm, yarn'],
    [
      ['versions', 'list', '--channel', 'canary'],
      '--channel must be one of: stable, beta, nightly',
    ],
    [['run'], '<fiddle> is missing.'],
    [['bisect', 'x', '--good', '1.0.0'], '--bad is missing.'],
    [['run', 'a', 'b', 'c'], 'Unexpected arguments: b c'],
    [
      ['versions', 'download', 'latest'],
      '<version> is invalid: expected a version like 30.0.0',
    ],
  ])('rejects %j', (argv, message) => {
    const error = usageError(argv);
    expect(error).toBeInstanceOf(FiddleError);
    expect(error.code).toBe('invalid-argument');
    expect(error.message).toBe(message);
  });
});

describe('help', () => {
  it('lists every command', () => {
    const text = helpText({});
    for (const id of commandIds) expect(text).toContain(id);
    expect(text).toContain('bisect <fiddle> --good <value> --bad <value>');
  });

  it("shows a command's arguments and options", () => {
    const text = helpText({ command: 'run' });
    expect(text).toContain('Usage: electron-fiddle --headless run <fiddle> [options]');
    expect(text).toMatch(/<fiddle> +A folder, a gist ID or URL/);
    expect(text).toMatch(/--electron-path <value> +A local Electron build/);
    expect(text).toMatch(
      /--pm <npm\|yarn> +The package manager to install packages with Default: npm/,
    );
    expect(text).toMatch(/--flag <value> +.* Repeatable\./);
    expect(text).toMatch(/--json +Print JSON/);
  });

  it("only lists a group's commands", () => {
    const text = helpText({ group: 'versions' });
    expect(text).toContain('versions list');
    expect(text).not.toContain('gist publish');
  });
});

describe('descriptors', () => {
  const catalog = JSON.parse(
    fs.readFileSync(
      new URL('../../i18n/locales/en/mainCli.json', import.meta.url),
      'utf8',
    ),
  ) as Record<string, unknown>;

  it('have help in the mainCli catalog for every command and field', () => {
    for (const id of commandIds) {
      const descriptor = descriptorOf(id);
      expect(catalog, id).toHaveProperty(descriptor.description);
      for (const field of fields(descriptor))
        expect(catalog, `${id} ${field.name}`).toHaveProperty(fieldKey(field.name));
    }
  });
});
