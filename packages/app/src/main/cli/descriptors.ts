// Input fields named in `positionals` are positional arguments, in order; the
// rest are flags. Help for a field is the `mainCli` key `arg<Field>`.
import { z } from 'zod';

import type mainCli from '../../i18n/generated/en/mainCli';
import { defaultSettings, releaseChannelSchema } from '../../shared/settings';
import { tm } from '../i18n';

export type CliKey = keyof typeof mainCli;

export interface Descriptor<I extends z.ZodObject = z.ZodObject> {
  description: CliKey;
  positionals: readonly (keyof I['shape'] & string)[];
  input: I;
}

function command<I extends z.ZodObject>(descriptor: Descriptor<I>): Descriptor<I> {
  return descriptor;
}

const fiddle = z.string().min(1);
const version = z
  .string()
  .regex(/^v?\d/, { error: () => tm('mainCli')('invalidVersion') });
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

/** `package` and `make`: the same inputs. */
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
  });
}

export const descriptors = {
  run: command({
    description: 'cmdRun',
    positionals: ['fiddle'],
    input: z.object({ fiddle, ...electron, ...execution }),
  }),
  bisect: command({
    description: 'cmdBisect',
    positionals: ['fiddle'],
    input: z.object({ fiddle, good: version, bad: version, ...execution, ...channels }),
  }),
  'versions list': command({
    description: 'cmdVersionsList',
    positionals: [],
    input: z.object({ ...channels }),
  }),
  'versions download': command({
    description: 'cmdVersionsDownload',
    positionals: ['version'],
    input: z.object({ version }),
  }),
  'versions remove': command({
    description: 'cmdVersionsRemove',
    positionals: ['version'],
    input: z.object({ version }),
  }),
  'gist publish': command({
    description: 'cmdGistPublish',
    positionals: ['dir'],
    input: z.object({
      dir,
      public: z.boolean().default(defaultSettings.gistVisibility === 'public'),
      description: z.string().optional(),
    }),
  }),
  'gist update': command({
    description: 'cmdGistUpdate',
    positionals: ['id', 'dir'],
    input: z.object({ id: gistId, dir }),
  }),
  'gist delete': command({
    description: 'cmdGistDelete',
    positionals: ['id'],
    input: z.object({ id: gistId }),
  }),
  'gist history': command({
    description: 'cmdGistHistory',
    positionals: ['id'],
    input: z.object({ id: gistId }),
  }),
  export: command({
    description: 'cmdExport',
    positionals: ['fiddle'],
    input: z.object({
      fiddle,
      revision: z.string().min(1).optional(),
      out: dir,
      forge: z.boolean().default(false),
    }),
  }),
  package: forgeTask('cmdPackage'),
  make: forgeTask('cmdMake'),
};

export type CommandId = keyof typeof descriptors;
export type CommandInput<K extends CommandId> = z.output<
  (typeof descriptors)[K]['input']
>;

export const commandIds = Object.keys(descriptors) as CommandId[];

/** A command's descriptor, typed loosely for code that handles every command. */
export function descriptorOf(id: CommandId): Descriptor {
  return descriptors[id] as unknown as Descriptor;
}
