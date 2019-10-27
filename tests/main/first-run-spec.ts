import { app, dialog } from 'electron';

import { onFirstRunMaybe } from '../../src/main/first-run';
import { isFirstRun } from '../../src/utils/check-first-run';

jest.mock('../../src/utils/check-first-run', () => ({
  isFirstRun: jest.fn()
}));

const mockDialogResponse = {
  response: 1
};

describe('first-run', () => {
  const oldDefaultApp = process.defaultApp;
  const oldPlatform = process.platform;

  beforeEach(() => {
    Object.defineProperty(process, 'platform', {
      value: 'darwin'
    });

    (dialog.showMessageBox as jest.Mock<any>).mockResolvedValue(mockDialogResponse);
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: oldPlatform
    });
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
      (isFirstRun as jest.Mock).mockReturnValueOnce(true);
      (app.isInApplicationsFolder as jest.Mock).mockReturnValue(true);

      onFirstRunMaybe();

      expect(dialog.showMessageBox).toHaveBeenCalledTimes(0);
    });

    it(`doesn't run unless required (dev mode)`, () => {
      (isFirstRun as jest.Mock).mockReturnValueOnce(true);
      (process as any).defaultApp = true;
      (app.isInApplicationsFolder as jest.Mock).mockReturnValue(false);

      onFirstRunMaybe();

      expect(dialog.showMessageBox).toHaveBeenCalledTimes(0);
    });

    it(`doesn't run unless required (Windows, Linux)`, () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32'
      });

      (isFirstRun as jest.Mock).mockReturnValueOnce(true);
      (app.isInApplicationsFolder as jest.Mock).mockReturnValue(false);

      onFirstRunMaybe();

      expect(dialog.showMessageBox).toHaveBeenCalledTimes(0);
    });

    it(`moves the app when requested to do so`, async () => {
      (isFirstRun as jest.Mock).mockReturnValue(true);
      (app.isInApplicationsFolder as jest.Mock).mockReturnValue(false);

      mockDialogResponse.response = 1;
      await onFirstRunMaybe();
      expect(app.moveToApplicationsFolder).toHaveBeenCalledTimes(0);

      mockDialogResponse.response = 0;
      await onFirstRunMaybe();
      expect(app.moveToApplicationsFolder).toHaveBeenCalledTimes(1);
    });
  });
});
