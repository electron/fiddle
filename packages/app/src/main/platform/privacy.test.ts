/** Help > Reset privacy permissions: macOS only, after a confirmation, for the app and the Electron its fiddles run on. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorCode } from '../../shared/errors';

const mocks = vi.hoisted(() => ({
  execFile: vi.fn(),
  confirm: vi.fn(async () => true),
}));

vi.mock('node:child_process', () => ({ execFile: mocks.execFile }));
vi.mock('../dialogs', () => ({ confirm: mocks.confirm }));
vi.mock('../i18n', () => ({ tm: () => (key: string) => key }));
vi.mock('../log', () => ({ log: { error: vi.fn() } }));

import {
  BUNDLE_ID,
  ELECTRON_BUNDLE_ID,
  resetPrivacyPermissions,
  TCCUTIL,
} from './privacy';

const realPlatform = process.platform;
type ExecCallback = (error: Error | null, stdout: string, stderr: string) => void;

beforeEach(() => {
  Object.defineProperty(process, 'platform', { value: 'darwin' });
  mocks.confirm.mockReset().mockResolvedValue(true);
  mocks.execFile
    .mockReset()
    .mockImplementation((_file: string, _args: string[], done: ExecCallback) =>
      done(null, '', ''),
    );
});
afterEach(() => {
  Object.defineProperty(process, 'platform', { value: realPlatform });
});

describe('resetPrivacyPermissions', () => {
  it('is unavailable outside macOS', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    await expect(resetPrivacyPermissions('w')).rejects.toMatchObject({
      code: ErrorCode.unavailable,
    });
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it('asks first, with Cancel as the default, and does nothing when the user cancels', async () => {
    mocks.confirm.mockResolvedValue(false);
    expect(await resetPrivacyPermissions('w')).toBe(false);
    expect(mocks.confirm).toHaveBeenCalledWith(
      'w',
      expect.objectContaining({ type: 'warning', defaultId: 1 }),
    );
    expect(mocks.execFile).not.toHaveBeenCalled();
  });

  it('resets every grant of the app and of stock Electron with tccutil', async () => {
    expect(await resetPrivacyPermissions('w')).toBe(true);
    expect(mocks.execFile.mock.calls.map((call) => [call[0], call[1]])).toEqual([
      [TCCUTIL, ['reset', 'All', BUNDLE_ID]],
      [TCCUTIL, ['reset', 'All', ELECTRON_BUNDLE_ID]],
    ]);
  });

  it('reports a tccutil failure as an internal error', async () => {
    mocks.execFile.mockImplementation(
      (_file: string, _args: string[], done: ExecCallback) =>
        done(new Error('exit code 70'), '', ''),
    );
    await expect(resetPrivacyPermissions('w')).rejects.toMatchObject({
      code: ErrorCode.internal,
      message: 'resetPrivacyFailed',
    });
  });
});
