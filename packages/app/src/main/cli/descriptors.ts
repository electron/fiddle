/**
 * Operation descriptors for the headless CLI: one per command, with its zod
 * input schema, its description, its output shape and its error codes.
 * `argv.ts` parses the command line and writes `--help` from these. No
 * Electron imports.
 *
 * - Input fields named in `positionals` come from positional arguments, in
 *   order. Every other field is a flag: `electronPath` is `--electron-path`.
 *   Booleans are switches, and arrays can be repeated.
 * - Defaults are the app's default settings: the CLI never reads settings.json.
 * - A field's help is the `mainCli` key `arg<Field>`, e.g. `argElectronPath`.
 * - `--json` and `--help` work with every command.
 */
import { z } from 'zod';

import type mainCli from '../../i18n/generated/en/mainCli';
import { ErrorCode } from '../../shared/errors';
import { defaultSettings, releaseChannelSchema } from '../../shared/settings';
import { CliErrorCode } from './output';

export type CliKey = keyof typeof mainCli;

export interface Descriptor<
  I extends z.ZodObject = z.ZodObject,
  O extends z.ZodType = z.ZodType,
> {
  description: CliKey;
  positionals: readonly (keyof I['shape'] & string)[];
  input: I;
  /** The `data` of the JSON result. */
  output: O;
  /** The error `code`s it can fail with. */
  errors: readonly string[];
}

function command<I extends z.ZodObject, O extends z.ZodType>(
  descriptor: Descriptor<I, O>,
): Descriptor<I, O> {
  return descriptor;
}

const fiddle = z.string().min(1);
const version = z.string().regex(/^v?\d/, 'expected a version like 30.0.0');
const gistId = z.string().min(1);
const dir = z.string().min(1);

/** How a fiddle runs, with the app's defaults. */
const execution = {
  flag: z.array(z.string()).default([...defaultSettings.electronFlags]),
  env: z.array(z.string()).default([...defaultSettings.environmentVariables]),
  module: z.array(z.string()).default([]),
  pm: z.enum(['npm', 'yarn']).default(defaultSettings.packageManager),
  logging: z.boolean().default(defaultSettings.electronLogging),
  trust: z.boolean().default(false),
};

const electron = {
  version: version.optional(),
  electronPath: z.string().min(1).optional(),
};

const channels = {
  channel: z.array(releaseChannelSchema).default([...defaultSettings.channels]),
  obsolete: z.boolean().default(defaultSettings.showObsolete),
};

const common = [ErrorCode.invalidArgument, ErrorCode.internal];
const loading = [...common, ErrorCode.notFound, ErrorCode.network, ErrorCode.unavailable];
const executing = [
  ...loading,
  CliErrorCode.untrusted,
  ErrorCode.installFailed,
  ErrorCode.cancelled,
];
const github = [...loading, ErrorCode.unauthorized, ErrorCode.forbidden];

/** `package` and `make`: the same inputs and output. */
function forgeTask(description: CliKey) {
  return command({
    description,
    positionals: ['fiddle'],
    input: z.object({
      fiddle,
      ...electron,
      module: execution.module,
      pm: execution.pm,
      trust: execution.trust,
    }),
    output: packaged,
    errors: [...executing, CliErrorCode.taskFailed],
  });
}

const gistWrite = z.object({
  id: z.string(),
  url: z.string(),
  revision: z.string().nullable(),
});
const packaged = z.object({ dir: z.string(), out: z.string() });

export const descriptors = {
  run: command({
    description: 'cmdRun',
    positionals: ['fiddle'],
    input: z.object({ fiddle, ...electron, ...execution }),
    output: z.object({
      name: z.string(),
      origin: z.string(),
      version: z.string(),
      result: z.enum(['success', 'failure']),
      exitCode: z.number().int().nullable(),
      signal: z.string().nullable(),
    }),
    errors: executing,
  }),
  bisect: command({
    description: 'cmdBisect',
    positionals: ['fiddle'],
    input: z.object({ fiddle, good: version, bad: version, ...execution, ...channels }),
    output: z.object({
      good: z.string(),
      bad: z.string(),
      url: z.string(),
      steps: z.array(z.object({ version: z.string(), good: z.boolean() })),
    }),
    errors: [...executing, CliErrorCode.bisectFailed],
  }),
  'versions list': command({
    description: 'cmdVersionsList',
    positionals: [],
    input: z.object({ ...channels }),
    output: z.object({
      versions: z.array(
        z.object({
          version: z.string(),
          channel: releaseChannelSchema,
          date: z.string(),
          node: z.string(),
          obsolete: z.boolean(),
          installed: z.boolean(),
        }),
      ),
    }),
    errors: common,
  }),
  'versions download': command({
    description: 'cmdVersionsDownload',
    positionals: ['version'],
    input: z.object({ version }),
    output: z.object({ version: z.string(), path: z.string() }),
    errors: [...loading, ErrorCode.cancelled],
  }),
  'versions remove': command({
    description: 'cmdVersionsRemove',
    positionals: ['version'],
    input: z.object({ version }),
    output: z.object({ version: z.string() }),
    errors: common,
  }),
  'gist load': command({
    description: 'cmdGistLoad',
    positionals: ['id'],
    input: z.object({ id: gistId, revision: z.string().min(1).optional(), out: dir }),
    output: z.object({
      id: z.string(),
      revision: z.string(),
      owner: z.string().nullable(),
      dir: z.string(),
      files: z.array(z.string()),
    }),
    errors: github,
  }),
  'gist publish': command({
    description: 'cmdGistPublish',
    positionals: ['dir'],
    input: z.object({
      dir,
      public: z.boolean().default(defaultSettings.gistVisibility === 'public'),
      description: z.string().optional(),
    }),
    output: gistWrite,
    errors: github,
  }),
  'gist update': command({
    description: 'cmdGistUpdate',
    positionals: ['id', 'dir'],
    input: z.object({ id: gistId, dir }),
    output: gistWrite,
    errors: github,
  }),
  'gist delete': command({
    description: 'cmdGistDelete',
    positionals: ['id'],
    input: z.object({ id: gistId }),
    output: z.object({ id: z.string() }),
    errors: github,
  }),
  'gist history': command({
    description: 'cmdGistHistory',
    positionals: ['id'],
    input: z.object({ id: gistId }),
    output: z.object({
      id: z.string(),
      revisions: z.array(
        z.object({
          sha: z.string(),
          date: z.string(),
          additions: z.number(),
          deletions: z.number(),
          total: z.number(),
        }),
      ),
    }),
    errors: github,
  }),
  export: command({
    description: 'cmdExport',
    positionals: ['fiddle'],
    input: z.object({ fiddle, out: dir, forge: z.boolean().default(false) }),
    output: z.object({ name: z.string(), dir: z.string(), files: z.array(z.string()) }),
    errors: loading,
  }),
  package: forgeTask('cmdPackage'),
  make: forgeTask('cmdMake'),
};

export type CommandId = keyof typeof descriptors;
export type CommandInput<K extends CommandId> = z.output<
  (typeof descriptors)[K]['input']
>;
export type CommandOutput<K extends CommandId> = z.input<
  (typeof descriptors)[K]['output']
>;

export const commandIds = Object.keys(descriptors) as CommandId[];

/** A command's descriptor, typed loosely for code that handles every command. */
export function descriptorOf(id: CommandId): Descriptor {
  return descriptors[id] as unknown as Descriptor;
}
