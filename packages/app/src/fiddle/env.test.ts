import { describe, expect, it } from 'vitest';

import {
  ADVANCED_LOGGING_ENV,
  buildFiddleEnv,
  cleanFlags,
  isBlockedUserEnvKey,
  isDeniedParentEnvKey,
  parseEnvEntries,
  parseEnvEntry,
} from './env';

describe('parseEnvEntries', () => {
  it('parses, drops empties, and reports bad and blocked entries', () => {
    const result = parseEnvEntries([
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
    ]);
    expect(result.env).toEqual({ A: 'override', B: 'two', C: 'quoted value', D: 'x', E: '', F: 'a=b' });
    expect(result.invalid).toEqual(['bad', '=x', '1A=2']);
    expect(result.blocked).toEqual(['LD_PRELOAD', 'DYLD_INSERT_LIBRARIES']);
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
  it('blocks LD_PRELOAD and every DYLD_ variable', () => {
    for (const key of ['LD_PRELOAD', 'DYLD_INSERT_LIBRARIES', 'DYLD_FRAMEWORK_PATH', 'DYLD_LIBRARY_PATH', 'DYLD_ANYTHING']) {
      expect(isBlockedUserEnvKey(key)).toBe(true);
    }
    expect(isBlockedUserEnvKey('LD_LIBRARY_PATH')).toBe(false);
    expect(isBlockedUserEnvKey('NODE_ENV')).toBe(false);
  });
});

describe('parent denylist', () => {
  it.each([
    'MY_TOKEN',
    'OPENAI_API_KEY',
    'GITHUB_TOKEN',
    'GH_TOKEN',
    'NPM_TOKEN',
    'NODE_AUTH_TOKEN',
    'SENTRY_DSN',
    'SENTRY_AUTH_TOKEN',
    'ELECTRON_FIDDLE_E2E_DRIVER',
    'github_token',
  ])('denies %s', (key) => expect(isDeniedParentEnvKey(key)).toBe(true));

  it.each(['PATH', 'HOME', 'TOKENIZER', 'API_KEY_FILE', 'ELECTRON_OVERRIDE_DIST_PATH'])('allows %s', (key) =>
    expect(isDeniedParentEnvKey(key)).toBe(false),
  );

  it('takes extra entries', () => {
    expect(isDeniedParentEnvKey('FIDDLE_DRIVER', { keys: ['FIDDLE_DRIVER'] })).toBe(true);
    expect(isDeniedParentEnvKey('APP_X', { prefixes: ['APP_'] })).toBe(true);
    expect(isDeniedParentEnvKey('X_SECRET', { suffixes: ['_SECRET'] })).toBe(true);
  });
});

describe('buildFiddleEnv', () => {
  const parentEnv = {
    PATH: '/usr/bin',
    HOME: '/home/me',
    GITHUB_TOKEN: 'ghp_x',
    SENTRY_DSN: 'x',
    ELECTRON_ENABLE_LOGGING: '1',
    UNDEFINED: undefined,
  };

  it('drops denied parent variables and inherited logging variables', () => {
    expect(buildFiddleEnv({ parentEnv })).toEqual({ PATH: '/usr/bin', HOME: '/home/me' });
  });

  it('adds advanced logging', () => {
    expect(buildFiddleEnv({ parentEnv, advancedLogging: true })).toEqual({
      PATH: '/usr/bin',
      HOME: '/home/me',
      ...ADVANCED_LOGGING_ENV,
    });
    expect(Object.keys(ADVANCED_LOGGING_ENV).sort()).toEqual([
      'ELECTRON_DEBUG_NOTIFICATIONS',
      'ELECTRON_ENABLE_LOGGING',
      'ELECTRON_ENABLE_STACK_DUMPING',
    ]);
  });

  it('adds user variables last, except blocked ones', () => {
    const env = buildFiddleEnv({
      parentEnv,
      userEnv: { PATH: '/custom', MY_TOKEN: 'user-set', LD_PRELOAD: 'x', DYLD_LIBRARY_PATH: 'y' },
    });
    expect(env).toEqual({ PATH: '/custom', HOME: '/home/me', MY_TOKEN: 'user-set' });
  });

  it('keeps a variable named like an Object method', () => {
    expect(buildFiddleEnv({ parentEnv: { toString: 'x' } })).toEqual({ toString: 'x' });
  });
});

describe('cleanFlags', () => {
  it('drops empty flags', () => {
    expect(cleanFlags(['--a', '', '  ', ' --b ', 'x\0y'])).toEqual(['--a', '--b']);
  });
});
