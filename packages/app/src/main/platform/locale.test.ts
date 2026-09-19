import { EventEmitter } from 'node:events';

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events');
  return {
    app: Object.assign(new EventEmitter(), { relaunch: vi.fn(), quit: vi.fn() }),
  };
});
vi.mock('../test-mode', () => ({ isTestMode: () => false }));

import { app } from 'electron';

import {
  cancelRelaunch,
  installRelaunchOnQuit,
  localeSettingFrom,
  relaunchApp,
} from './locale';

const mockApp = app as unknown as EventEmitter & {
  relaunch: ReturnType<typeof vi.fn>;
  quit: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  mockApp.removeAllListeners();
  mockApp.relaunch.mockClear();
  mockApp.quit.mockClear();
  cancelRelaunch();
  installRelaunchOnQuit();
});

describe('relaunchApp', () => {
  it('quits first and relaunches only once the app has quit', () => {
    relaunchApp();
    expect(mockApp.quit).toHaveBeenCalledOnce();
    expect(mockApp.relaunch).not.toHaveBeenCalled();

    mockApp.emit('quit');
    expect(mockApp.relaunch).toHaveBeenCalledOnce();
  });

  it('does not relaunch after a cancelled quit', () => {
    relaunchApp();
    cancelRelaunch();
    mockApp.emit('quit');
    expect(mockApp.relaunch).not.toHaveBeenCalled();
  });

  it('does not relaunch on an ordinary quit', () => {
    mockApp.emit('quit');
    expect(mockApp.relaunch).not.toHaveBeenCalled();
  });
});

describe('localeSettingFrom', () => {
  it('reads a chosen language and ignores the system default and invalid values', () => {
    expect(localeSettingFrom({ locale: 'de' })).toBe('de');
    expect(localeSettingFrom({ locale: 'pt-BR' })).toBe('pt-BR');
    expect(localeSettingFrom({ locale: 'system' })).toBeUndefined();
    expect(localeSettingFrom({ locale: 3 })).toBeUndefined();
    expect(localeSettingFrom({ locale: 'not a language' })).toBeUndefined();
    expect(localeSettingFrom({})).toBeUndefined();
    expect(localeSettingFrom(undefined)).toBeUndefined();
  });
});
