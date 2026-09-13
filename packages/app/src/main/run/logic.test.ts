import { describe, expect, it } from 'vitest';

import { classifyRun, esmNeedsNewerElectron, toPackageName } from './logic';

describe('classifyRun', () => {
  it('is success only for exit code 0', () => {
    expect(classifyRun({ code: 0 })).toBe('success');
    expect(classifyRun({ code: 1 })).toBe('failure');
    expect(classifyRun({ code: null, signal: 'SIGTERM' })).toBe('failure');
  });

  it('treats spawn and install failures as failures', () => {
    expect(classifyRun({ spawnFailed: true })).toBe('failure');
    expect(classifyRun({ installFailed: true, code: 0 })).toBe('failure');
  });

  it('is invalid when a pre-run check refused the run', () => {
    expect(classifyRun({ invalid: true, code: 0 })).toBe('invalid');
  });
});

describe('esmNeedsNewerElectron', () => {
  it('refuses main.mjs below Electron 28', () => {
    expect(esmNeedsNewerElectron('main.mjs', '27.3.1')).toBe(true);
    expect(esmNeedsNewerElectron('main.mjs', '28.0.0-alpha.1')).toBe(false);
    expect(esmNeedsNewerElectron('main.mjs', '43.0.0')).toBe(false);
  });

  it('ignores other entries and local builds', () => {
    expect(esmNeedsNewerElectron('main.js', '10.0.0')).toBe(false);
    expect(esmNeedsNewerElectron('main.mjs', undefined)).toBe(false);
  });
});

describe('toPackageName', () => {
  it('makes a valid npm name', () => {
    expect(toPackageName('Sparkling Pony')).toBe('sparkling-pony');
    expect(toPackageName('.hidden_Thing!!')).toBe('hidden_thing');
    expect(toPackageName('★')).toBe('fiddle');
  });
});
