/**
 * The headless CLI's command line, driven by the descriptors: `node:util`
 * `parseArgs` splits the tokens, zod checks the values, and `--help` is
 * written from the same fields. Errors are `invalid-argument` FiddleErrors
 * with translated messages. No Electron imports.
 */
import { parseArgs } from 'node:util';

import type { z } from 'zod';

import { ErrorCode, FiddleError } from '../../shared/errors';
import { tm } from '../i18n';
import {
  commandIds,
  descriptorOf,
  type CliKey,
  type CommandId,
  type Descriptor,
} from './descriptors';

const PROGRAM = 'electron-fiddle --headless';

/** Work anywhere before `--`, with every command. */
const GLOBAL_SWITCHES = ['--json', '--help', '-h'];

type ParsedCommandLine =
  | { kind: 'help'; json: boolean; command?: CommandId; group?: string }
  | {
      kind: 'command';
      json: boolean;
      command: CommandId;
      input: Record<string, unknown>;
    };

export interface Field {
  name: string;
  /** `--electron-path` for `electronPath`. */
  flag: string;
  type: 'string' | 'boolean';
  multiple: boolean;
  positional: boolean;
  optional: boolean;
  choices?: readonly string[];
  defaultValue?: unknown;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** A `mainCli` string. */
export function t(key: CliKey, options?: Record<string, unknown>): string {
  return (tm('mainCli') as unknown as Translate)(key, options);
}

function usageError(message: string): FiddleError {
  return new FiddleError(ErrorCode.invalidArgument, message, { usage: true });
}

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

function camel(flag: string): string {
  return flag.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** The `mainCli` key with a field's help, e.g. `argElectronPath`. */
export function fieldKey(name: string): CliKey {
  return `arg${name.charAt(0).toUpperCase()}${name.slice(1)}` as CliKey;
}

interface MinimalDef {
  type: string;
  innerType?: z.ZodType;
  element?: z.ZodType;
  defaultValue?: unknown;
}

const defOf = (schema: z.ZodType) => schema.def as unknown as MinimalDef;

function unwrap(schema: z.ZodType): {
  inner: z.ZodType;
  optional: boolean;
  defaultValue?: unknown;
} {
  let inner = schema;
  let optional = false;
  let defaultValue: unknown;
  for (
    let def = defOf(inner);
    def.type === 'optional' || def.type === 'default';
    def = defOf(inner)
  ) {
    optional = true;
    if (def.type === 'default') defaultValue = def.defaultValue;
    inner = def.innerType!;
  }
  return { inner, optional, defaultValue };
}

/** A descriptor's fields, in schema order, with how each is given on the command line. */
export function fields(descriptor: Descriptor): Field[] {
  return Object.entries(descriptor.input.shape as Record<string, z.ZodType>).map(
    ([name, schema]) => {
      const { inner, optional, defaultValue } = unwrap(schema);
      const type = defOf(inner).type;
      const element = type === 'array' ? unwrap(defOf(inner).element!).inner : inner;
      const choices =
        defOf(element).type === 'enum'
          ? (element as unknown as { options: string[] }).options
          : undefined;
      return {
        name,
        flag: `--${kebab(name)}`,
        type: type === 'boolean' ? 'boolean' : 'string',
        multiple: type === 'array',
        positional: (descriptor.positionals as readonly string[]).includes(name),
        optional,
        ...(choices ? { choices } : {}),
        ...(defaultValue !== undefined ? { defaultValue } : {}),
      };
    },
  );
}

function displayName(field: Field): string {
  return field.positional ? `<${field.name}>` : field.flag;
}

function matchCommand(
  args: readonly string[],
): { id: CommandId; rest: string[] } | undefined {
  for (const id of commandIds) {
    const words = id.split(' ');
    if (words.every((word, i) => args[i] === word))
      return { id, rest: args.slice(words.length) };
  }
  return undefined;
}

function isGroup(word: string): boolean {
  return commandIds.some((id) => id.startsWith(`${word} `));
}

/** Parses the arguments after `--headless`. Throws an `invalid-argument` FiddleError. */
export function parseCommandLine(argv: readonly string[]): ParsedCommandLine {
  const end = argv.indexOf('--');
  const before = end === -1 ? argv : argv.slice(0, end);
  const json = before.includes('--json');
  const help = before.includes('--help') || before.includes('-h');
  const args = [
    ...before.filter((arg) => !GLOBAL_SWITCHES.includes(arg)),
    ...(end === -1 ? [] : argv.slice(end)),
  ];

  const match = matchCommand(args);
  if (!match) {
    const [first, second] = args;
    if (first === undefined) return { kind: 'help', json };
    if (isGroup(first) && (second === undefined || second.startsWith('-')))
      return { kind: 'help', json, group: first };
    const command = isGroup(first) ? `${first} ${second}` : first;
    throw usageError(t('errorUnknownCommand', { command }));
  }
  if (help) return { kind: 'help', json, command: match.id };

  const descriptor = descriptorOf(match.id);
  const all = fields(descriptor);
  const flags = all.filter((field) => !field.positional);
  const { values, positionals, tokens } = parseArgs({
    args: match.rest,
    options: Object.fromEntries(
      flags.map((f) => [kebab(f.name), { type: f.type, multiple: f.multiple }]),
    ),
    // Unknown options are reported below, in our words. Not strict, so `--flag --no-sandbox` works.
    strict: false,
    allowPositionals: true,
    tokens: true,
  });
  for (const token of tokens) {
    if (token.kind !== 'option') continue;
    const field = flags.find((f) => kebab(f.name) === token.name);
    if (!field)
      throw usageError(
        t('errorUnknownOption', { option: token.rawName, command: match.id }),
      );
    if (field.type === 'string' && token.value === undefined) {
      throw usageError(t('errorMissingValue', { option: token.rawName }));
    }
    if (field.type === 'boolean' && token.value !== undefined) {
      throw usageError(t('errorUnexpectedValue', { option: token.rawName }));
    }
  }
  const expected = descriptor.positionals.length;
  if (positionals.length > expected) {
    throw usageError(
      t('errorTooManyArguments', { args: positionals.slice(expected).join(' ') }),
    );
  }

  const raw: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) raw[camel(key)] = value;
  descriptor.positionals.forEach((name, i) => {
    if (positionals[i] !== undefined) raw[name] = positionals[i];
  });
  const result = descriptor.input.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0]!;
    const field = all.find((f) => f.name === issue.path[0]);
    const name = field ? displayName(field) : String(issue.path[0] ?? '');
    if (field && raw[field.name] === undefined)
      throw usageError(t('errorMissingArgument', { name }));
    if (field?.choices)
      throw usageError(
        t('errorInvalidChoice', { name, choices: field.choices.join(', ') }),
      );
    throw usageError(t('errorInvalidValue', { name, message: issue.message }));
  }
  return {
    kind: 'command',
    json,
    command: match.id,
    input: result.data as Record<string, unknown>,
  };
}

function table(rows: readonly (readonly [string, string])[]): string[] {
  const width = Math.max(0, ...rows.map(([left]) => left.length));
  return rows.map(([left, right]) => `  ${left.padEnd(width)}  ${right}`.trimEnd());
}

function valueHint(field: Field): string {
  return field.type === 'boolean'
    ? ''
    : ` <${field.choices ? field.choices.join('|') : 'value'}>`;
}

function usageOf(id: CommandId): string {
  const descriptor = descriptorOf(id);
  const required = fields(descriptor)
    .filter((f) => !f.positional && !f.optional)
    .map((f) => `${f.flag}${valueHint(f)}`);
  return [id, ...descriptor.positionals.map((name) => `<${name}>`), ...required].join(
    ' ',
  );
}

function flagHelp(field: Field): string {
  const parts = [t(fieldKey(field.name))];
  if (field.multiple) parts.push(t('helpRepeatable'));
  const value = field.defaultValue;
  if (typeof value === 'string' || (Array.isArray(value) && value.length > 0)) {
    parts.push(
      t('helpDefault', { value: Array.isArray(value) ? value.join(', ') : value }),
    );
  }
  return parts.join(' ');
}

const GLOBAL_ROWS = (): [string, string][] => [
  ['--json', t('argJson')],
  ['--help', t('argHelp')],
];

/** `--help` text: every command (or a group's), or one command's arguments and options. */
export function helpText(target: { command?: CommandId; group?: string }): string {
  if (target.command) {
    const descriptor = descriptorOf(target.command);
    const all = fields(descriptor);
    const positionals = all.filter((f) => f.positional);
    const flags = all.filter((f) => !f.positional);
    return [
      t('helpUsage', { usage: `${PROGRAM} ${usageOf(target.command)} [options]` }),
      '',
      t(descriptor.description),
      '',
      ...(positionals.length > 0
        ? [
            t('helpArguments'),
            ...table(
              positionals.map((f) => [`<${f.name}>`, t(fieldKey(f.name))] as const),
            ),
            '',
          ]
        : []),
      t('helpOptions'),
      ...table([
        ...flags.map((f) => [`${f.flag}${valueHint(f)}`, flagHelp(f)] as const),
        ...GLOBAL_ROWS(),
      ]),
      '',
    ].join('\n');
  }
  const ids = target.group
    ? commandIds.filter((id) => id.startsWith(`${target.group} `))
    : commandIds;
  return [
    t('helpUsage', { usage: `${PROGRAM} <command> [options]` }),
    '',
    t('helpCommands'),
    ...table(ids.map((id) => [usageOf(id), t(descriptorOf(id).description)] as const)),
    '',
    t('helpOptions'),
    ...table(GLOBAL_ROWS()),
    '',
    t('helpMore'),
    '',
  ].join('\n');
}
