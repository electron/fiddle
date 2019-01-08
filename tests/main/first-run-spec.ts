import { app, dialog } from 'electron';

import { onFirstRunMaybe } from '../../src/main/first-run';
import { isFirstRun } from '../../src/utils/check-first-run';

jest.mock('../../src/utils/check-first-run', () => ({
  isFirstRun: jest.fn()
}));

describe('first-run', () => {
  const oldDefaultApp = process.defaultApp;
  const oldPlatform = process.platform;

  beforeEach(() => {
    Object.defineProperty(process, 'platform', {
      value: 'darwin'
    });
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: oldPlatform
    });
  });

  afterEach(() => {
    process.defaultApp = oldDefaultApp;
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
      process.defaultApp = true;
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

    it(`moves the app when requested to do so`, () => {
      (isFirstRun as jest.Mock).mockReturnValueOnce(true);
      (app.isInApplicationsFolder as jest.Mock).mockReturnValue(false);

      onFirstRunMaybe();

      const call = (dialog.showMessageBox as jest.Mock<any>).mock.calls[0];
      const cb = call[1];

      cb(1);

      expect(app.moveToApplicationsFolder).toHaveBeenCalledTimes(0);

      cb(0);

      expect(app.moveToApplicationsFolder).toHaveBeenCalledTimes(1);
    });
  });
});
