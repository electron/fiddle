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
  CLIENT_SECRET: 'secret',
  DB_PASSWORD: 'password',
  DJANGO_SECRET_KEY: 'django',
  TLS_PRIVATE_KEY: 'pem',
  MINIO_ACCESS_KEY: 'minio',
  GOOGLE_CREDENTIALS: '{}',
  GPG_PASSPHRASE: 'phrase',
  DATABASE_URL: 'postgres://user:pass@host/db',
  CSC_KEY_PASSWORD: 'signing',
  AWS_SECRET_ACCESS_KEY: 'aws',
  AWS_ACCESS_KEY_ID: 'aws-id',
  SSH_AUTH_SOCK: '/tmp/agent.sock',
  'npm_config_//registry.npmjs.org/:_authToken': 'npm-token',
  npm_config__auth: 'npm-auth',
  SENTRY_DSN: 'dsn',
  NODE_OPTIONS: '--require /evil.js',
  ELECTRON_RUN_AS_NODE: '1',
  LD_PRELOAD: '/evil.so',
  LD_LIBRARY_PATH: '/evil',
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
    for (const name of [
      'LD_PRELOAD',
      'LD_LIBRARY_PATH',
      'DYLD_INSERT_LIBRARIES',
      'NODE_OPTIONS',
      'ELECTRON_RUN_AS_NODE',
    ]) {
      expect(env).not.toHaveProperty(name);
    }
  });

  it('adds extraDenylist to the default or custom denylist', () => {
    const withApp = { ...parent, ELECTRON_FIDDLE_SECRET_THING: 'x', FIDDLE: 'kept' };
    const env = buildChildEnv({ extraDenylist: ['ELECTRON_FIDDLE_*'] }, withApp);
    expect(env).toStrictEqual({ PATH: '/usr/bin', HOME: '/home/me', FIDDLE: 'kept' });

    const custom = buildChildEnv(
      { denylist: ['HOME'], extraDenylist: ['ELECTRON_FIDDLE_*'] },
      withApp,
    );
    expect(custom).toHaveProperty('GITHUB_TOKEN', 'ghp');
    expect(custom).not.toHaveProperty('HOME');
    expect(custom).not.toHaveProperty('ELECTRON_FIDDLE_SECRET_THING');
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

  it('lets user variables set NODE_OPTIONS and ELECTRON_RUN_AS_NODE', () => {
    const vars = { NODE_OPTIONS: '--trace-warnings', ELECTRON_RUN_AS_NODE: '1' };
    expect(buildChildEnv({ vars }, parent)).toMatchObject(vars);
  });

  it('never passes LD_* or DYLD_* from user variables', () => {
    const vars = {
      LD_PRELOAD: '/x.so',
      ld_preload: '/y.so',
      LD_LIBRARY_PATH: '/w',
      DYLD_LIBRARY_PATH: '/z',
    };
    expect(buildChildEnv({ vars }, {})).toStrictEqual({});
  });

  it('exports its default lists', () => {
    expect(DEFAULT_ENV_DENYLIST).toEqual(
      expect.arrayContaining([
        '*_TOKEN',
        '*_API_KEY',
        '*_SECRET',
        '*_PASSWORD',
        'AWS_*',
        'SSH_AUTH_SOCK',
        'SENTRY_*',
      ]),
    );
    expect(ALWAYS_BLOCKED_ENV).toStrictEqual(['LD_*', 'DYLD_*']);
  });
});
