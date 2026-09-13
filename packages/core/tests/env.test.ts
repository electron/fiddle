import { describe, expect, it } from 'vitest';

import { ALWAYS_BLOCKED_ENV, DEFAULT_ENV_DENYLIST, buildChildEnv } from '../src/index.js';

const parent = {
  PATH: '/usr/bin',
  HOME: '/home/me',
  GITHUB_TOKEN: 'ghp',
  GH_TOKEN: 'gh',
  NPM_TOKEN: 'npm',
  NODE_AUTH_TOKEN: 'node',
  MY_SERVICE_TOKEN: 'token',
  OPENAI_API_KEY: 'key',
  SENTRY_DSN: 'dsn',
  LD_PRELOAD: '/evil.so',
  DYLD_INSERT_LIBRARIES: '/evil.dylib',
};

describe('buildChildEnv()', () => {
  it('removes the default denylist and blocked variables from the parent', () => {
    expect(buildChildEnv({}, parent)).toStrictEqual({
      PATH: '/usr/bin',
      HOME: '/home/me',
    });
  });

  it('matches patterns without regard to case', () => {
    const env = buildChildEnv({}, { my_token: 'x', Sentry_Release: 'y', KEEP: 'z' });
    expect(env).toStrictEqual({ KEEP: 'z' });
  });

  it('uses a custom denylist instead of the default', () => {
    const env = buildChildEnv({ denylist: ['HOME'] }, parent);
    expect(env).toHaveProperty('GITHUB_TOKEN', 'ghp');
    expect(env).not.toHaveProperty('HOME');
    expect(env).not.toHaveProperty('LD_PRELOAD');
    expect(env).not.toHaveProperty('DYLD_INSERT_LIBRARIES');
  });

  it('adds user variables after filtering', () => {
    const env = buildChildEnv({ vars: { FOO: 'bar', GITHUB_TOKEN: 'explicit' } }, parent);
    expect(env).toStrictEqual({
      PATH: '/usr/bin',
      HOME: '/home/me',
      FOO: 'bar',
      GITHUB_TOKEN: 'explicit',
    });
  });

  it('never passes LD_PRELOAD or DYLD_* from user variables', () => {
    const vars = { LD_PRELOAD: '/x.so', ld_preload: '/y.so', DYLD_LIBRARY_PATH: '/z' };
    expect(buildChildEnv({ vars }, {})).toStrictEqual({});
  });

  it('exports its default lists', () => {
    expect(DEFAULT_ENV_DENYLIST).toEqual(
      expect.arrayContaining(['*_TOKEN', '*_API_KEY', 'GITHUB_TOKEN', 'SENTRY_*']),
    );
    expect(ALWAYS_BLOCKED_ENV).toStrictEqual(['LD_PRELOAD', 'DYLD_*']);
  });
});
