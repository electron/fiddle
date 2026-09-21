/** The first-launch offer to move the app to /Applications on macOS. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  app: {
    isPackaged: true,
    isInApplicationsFolder: vi.fn(() => false),
    moveToApplicationsFolder: vi.fn(),
  },
  showMessageBox: vi.fn(async (_options: unknown) => ({ response: 0 })),
  testMode: false,
  error: vi.fn(),
}));

vi.mock('electron', () => ({
  app: mocks.app,
  dialog: { showMessageBox: mocks.showMessageBox },
}));
vi.mock('../i18n', () => ({ tm: () => (key: string) => key }));
vi.mock('../log', () => ({ log: { error: mocks.error } }));
vi.mock('../test-mode', () => ({
  isTestMode: () => mocks.testMode,
}));

import { offerMoveToApplications } from './first-run';

const realPlatform = process.platform;

beforeEach(() => {
  Object.defineProperty(process, 'platform', { value: 'darwin' });
  mocks.app.isPackaged = true;
  mocks.testMode = false;
  mocks.app.isInApplicationsFolder.mockReset().mockReturnValue(false);
  mocks.app.moveToApplicationsFolder.mockReset();
  mocks.showMessageBox.mockReset().mockResolvedValue({ response: 0 });
});
afterEach(() => {
  Object.defineProperty(process, 'platform', { value: realPlatform });
});

describe('offerMoveToApplications', () => {
  it('moves the app when the user agrees, on the first launch of a packaged app outside /Applications', async () => {
    await offerMoveToApplications(true);
    expect(mocks.showMessageBox).toHaveBeenCalledWith(
      expect.objectContaining({ buttons: ['moveButton', 'dontMove'], cancelId: 1 }),
    );
    expect(mocks.app.moveToApplicationsFolder).toHaveBeenCalledOnce();
  });

  it('stays put when the user declines, and survives a move that fails', async () => {
    mocks.showMessageBox.mockResolvedValueOnce({ response: 1 });
    await offerMoveToApplications(true);
    expect(mocks.app.moveToApplicationsFolder).not.toHaveBeenCalled();

    mocks.app.moveToApplicationsFolder.mockImplementation(() => {
      throw new Error('not authorised');
    });
    await expect(offerMoveToApplications(true)).resolves.toBeUndefined();
    expect(mocks.error).toHaveBeenCalled();
  });

  it('never asks on a later launch, elsewhere than macOS, in dev, in tests, or from /Applications', async () => {
    await offerMoveToApplications(false);
    Object.defineProperty(process, 'platform', { value: 'linux' });
    await offerMoveToApplications(true);
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    mocks.app.isPackaged = false;
    await offerMoveToApplications(true);
    mocks.app.isPackaged = true;
    mocks.testMode = true;
    await offerMoveToApplications(true);
    mocks.testMode = false;
    mocks.app.isInApplicationsFolder.mockReturnValue(true);
    await offerMoveToApplications(true);
    expect(mocks.showMessageBox).not.toHaveBeenCalled();
  });
});
