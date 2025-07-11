/**
 * @vitest-environment node
 */

import { app, dialog } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { onFirstRunMaybe } from '../../src/main/first-run';
import { isFirstRun } from '../../src/main/utils/check-first-run';
import { overridePlatform, resetPlatform } from '../utils';

vi.mock('../../src/main/utils/check-first-run', () => ({
  isFirstRun: vi.fn(),
}));

const mockDialogResponse = {
  response: 1,
  checkboxChecked: false,
};

describe('first-run', () => {
  const oldDefaultApp = process.defaultApp;

  beforeEach(() => {
    overridePlatform('darwin');

    vi.mocked(dialog.showMessageBox).mockResolvedValue(mockDialogResponse);
  });

  afterEach(() => {
    resetPlatform();
  });

  afterEach(() => {
    (process as any).defaultApp = oldDefaultApp;
  });

  describe('onFirstRunMaybe()', () => {
    it(`doesn't run unless required (not first run)`, () => {
      onFirstRunMaybe();
      expect(dialog.showMessageBox).toHaveBeenCalledTimes(0);
    });

    it(`doesn't run unless required (is already in app folder)`, () => {
      vi.mocked(isFirstRun).mockReturnValueOnce(true);
      vi.mocked(app.isInApplicationsFolder).mockReturnValue(true);

      onFirstRunMaybe();

      expect(dialog.showMessageBox).toHaveBeenCalledTimes(0);
    });

    it(`doesn't run unless required (dev mode)`, () => {
      vi.mocked(isFirstRun).mockReturnValueOnce(true);
      (process as any).defaultApp = true;
      vi.mocked(app.isInApplicationsFolder).mockReturnValue(false);

      onFirstRunMaybe();

      expect(dialog.showMessageBox).toHaveBeenCalledTimes(0);
    });

    it(`doesn't run unless required (Windows, Linux)`, () => {
      overridePlatform('win32');

      vi.mocked(isFirstRun).mockReturnValueOnce(true);
      vi.mocked(app.isInApplicationsFolder).mockReturnValue(false);

      onFirstRunMaybe();

      expect(dialog.showMessageBox).toHaveBeenCalledTimes(0);
    });

    it(`moves the app when requested to do so`, async () => {
      vi.mocked(isFirstRun).mockReturnValue(true);
      vi.mocked(app.isInApplicationsFolder).mockReturnValue(false);

      mockDialogResponse.response = 1;
      await onFirstRunMaybe();
      expect(app.moveToApplicationsFolder).toHaveBeenCalledTimes(0);

      mockDialogResponse.response = 0;
      await onFirstRunMaybe();
      expect(app.moveToApplicationsFolder).toHaveBeenCalledTimes(1);
    });
  });
});
