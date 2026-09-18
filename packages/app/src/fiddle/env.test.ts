import { describe, expect, it } from 'vitest';

import {
  ADVANCED_LOGGING_ENV,
  cleanFlags,
  envFromEntries,
  fiddleProcessEnv,
  isBlockedUserEnvKey,
  parseEnvEntries,
  parseEnvEntry,
} from './env';

/** Runs `fn` with `process.platform` set to `platform`. */
function withPlatform<T>(platform: NodeJS.Platform, fn: () => T): T {
  const original = Object.getOwnPropertyDescriptor(process, 'platform')!;
  Object.defineProperty(process, 'platform', { ...original, value: platform });
  try {
    return fn();
  } finally {
    Object.defineProperty(process, 'platform', original);
  }
}

describe('parseEnvEntries', () => {
  it('parses, drops empties, and reports bad and blocked entries', () => {
    const result = parseEnvEntries(
      [
        'A=1',
        ' B = two ',
        'C="quoted value"',
        "D='x'",
        'E=',
        '',
        '   ',
        'bad',
        '=x',
        '1A=2',
        'LD_PRELOAD=/x.so',
        'DYLD_INSERT_LIBRARIES=/y',
        'F=a=b',
        'A=override',
      ],
      'linux',
    );
    expect(result.env).toEqual({
      A: 'override',
      B: 'two',
      C: 'quoted value',
      D: 'x',
      E: '',
      F: 'a=b',
    });
    expect(result.invalid).toEqual(['bad', '=x', '1A=2']);
    expect(result.blocked).toEqual(['LD_PRELOAD', 'DYLD_INSERT_LIBRARIES']);
  });

  it('treats names that differ only in case as one variable on Windows', () => {
    expect(parseEnvEntries(['Path=a', 'x=1', 'PATH=b'], 'win32').env).toEqual({
      x: '1',
      PATH: 'b',
    });
    expect(parseEnvEntries(['Path=a', 'PATH=b'], 'linux').env).toEqual({
      Path: 'a',
      PATH: 'b',
    });
  });

  it('parses single entries', () => {
    expect(parseEnvEntry('KEY=value')).toEqual(['KEY', 'value']);
    expect(parseEnvEntry('_k1=v')).toEqual(['_k1', 'v']);
    expect(parseEnvEntry('KEY="')).toEqual(['KEY', '"']);
    expect(parseEnvEntry('A-B=1')).toBeNull();
    expect(parseEnvEntry('A=\0')).toBeNull();
  });
});

describe('blocked user keys', () => {
  it('blocks every LD_ and DYLD_ variable, as core does', () => {
    const keys = [
      'LD_PRELOAD',
      'LD_LIBRARY_PATH',
      'ld_audit',
      'DYLD_INSERT_LIBRARIES',
      'DYLD_LIBRARY_PATH',
      'dyld_anything',
    ];
    for (const key of keys) expect(isBlockedUserEnvKey(key)).toBe(true);
    expect(isBlockedUserEnvKey('NODE_ENV')).toBe(false);
    expect(isBlockedUserEnvKey('OLD_PATH')).toBe(false);
    expect(
      parseEnvEntries(
        keys.map((key) => `${key}=x`),
        'linux',
      ),
    ).toEqual({ env: {}, invalid: [], blocked: keys });
  });

  it('blocks NODE_OPTIONS and ELECTRON_RUN_AS_NODE, which change what Electron runs', () => {
    for (const key of [
      'NODE_OPTIONS',
      'node_options',
      'ELECTRON_RUN_AS_NODE',
      'Electron_Run_As_Node',
    ]) {
      expect(isBlockedUserEnvKey(key)).toBe(true);
    }
    expect(isBlockedUserEnvKey('NODE_OPTIONS_X')).toBe(false);
    expect(isBlockedUserEnvKey('ELECTRON_ENABLE_LOGGING')).toBe(false);
    expect(
      parseEnvEntries(
        ['NODE_OPTIONS=--require /tmp/x.js', 'ELECTRON_RUN_AS_NODE=1', 'A=1'],
        'linux',
      ),
    ).toEqual({
      env: { A: '1' },
      invalid: [],
      blocked: ['NODE_OPTIONS', 'ELECTRON_RUN_AS_NODE'],
    });
  });
});

describe('envFromEntries', () => {
  it('lets later entries win and skips undefined values', () => {
    expect(
      envFromEntries(
        [
          ['A', '1'],
          ['B', undefined],
          ['A', '2'],
        ],
        'linux',
      ),
    ).toEqual({ A: '2' });
  });

  it('keeps names like __proto__ and toString as plain variables', () => {
    const env = envFromEntries(
      [
        ['__proto__', 'x'],
        ['toString', 'y'],
      ],
      'linux',
    );
    expect(Object.keys(env)).toEqual(['__proto__', 'toString']);
    expect(Object.getPrototypeOf(env)).toBe(Object.prototype);
  });
});

describe('fiddleProcessEnv', () => {
  const parent = {
    PATH: '/usr/bin',
    HOME: '/home/me',
    TOKENIZER: 'kept',
    GITHUB_TOKEN: 'ghp_x',
    github_token: 'ghp_y',
    MY_API_KEY: 'k',
    SENTRY_DSN: 'x',
    ELECTRON_FIDDLE_E2E_DRIVER: '1',
    UNDEFINED: undefined,
  };

  it('drops denied and app-internal parent variables', () => {
    expect(withPlatform('linux', () => fiddleProcessEnv({}, parent))).toEqual({
      PATH: '/usr/bin',
      HOME: '/home/me',
      TOKENIZER: 'kept',
    });
  });

  it('adds advanced logging, then the user variables, except blocked ones', () => {
    const env = withPlatform('linux', () =>
      fiddleProcessEnv(
        {
          advancedLogging: true,
          userEnv: {
            PATH: '/custom',
            MY_TOKEN: 'user-set',
            ELECTRON_ENABLE_LOGGING: 'false',
            LD_PRELOAD: 'x',
            DYLD_LIBRARY_PATH: 'y',
          },
        },
        parent,
      ),
    );
    expect(env).toEqual({
      ...ADVANCED_LOGGING_ENV,
      PATH: '/custom',
      HOME: '/home/me',
      TOKENIZER: 'kept',
      MY_TOKEN: 'user-set',
      ELECTRON_ENABLE_LOGGING: 'false',
    });
  });

  it('replaces differently-cased copies on Windows', () => {
    const env = withPlatform('win32', () =>
      fiddleProcessEnv(
        {
          advancedLogging: true,
          userEnv: { electron_enable_logging: 'false', PATH: 'C:\\bin' },
        },
        { Path: 'C:\\old', SystemRoot: 'C:\\Windows' },
      ),
    );
    expect(env).toEqual({
      SystemRoot: 'C:\\Windows',
      PATH: 'C:\\bin',
      ELECTRON_DEBUG_NOTIFICATIONS: 'true',
      ELECTRON_ENABLE_STACK_DUMPING: 'true',
      electron_enable_logging: 'false',
    });
  });
});

describe('cleanFlags', () => {
  it('drops empty flags', () => {
    expect(cleanFlags(['--a', '', '  ', ' --b ', 'x\0y'])).toEqual(['--a', '--b']);
  });
});
