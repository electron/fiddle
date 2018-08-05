import * as electron from 'electron';

import { IpcEvents } from '../../src/ipc-events';
import { ipcMainManager } from '../../src/main/ipc';
import { setupMenu } from '../../src/main/menu';
import { overridePlatform, resetPlatform } from '../utils';

describe('menu', () => {
  beforeEach(() => {
    (electron.app.getName as any).mockReturnValue('Electron Fiddle');
  });

  afterEach(() => {
    resetPlatform();
  });

  describe('setupMenu()', () => {
    it('creates a menu (Darwin)', () => {
      overridePlatform('darwin');

      setupMenu();

      const result = (electron.Menu.buildFromTemplate as any).mock.calls[0][0];
      expect(result.length).toBe(7);

      result.forEach((submenu) => {
        expect(!!submenu.role || !!(submenu.label && submenu.submenu)).toBe(true);
        expect(submenu).toBeTruthy();
      });
    });

    it('creates a menu (Windows)', () => {
      overridePlatform('win32');

      setupMenu();

      const result = (electron.Menu.buildFromTemplate as any).mock.calls[0][0];
      expect(result.length).toBe(6);

      result.forEach((submenu) => {
        expect(!!submenu.role || !!(submenu.label && submenu.submenu)).toBe(true);
        expect(submenu).toBeTruthy();
      });
    });

    it('creates a menu (Linux)', () => {
      overridePlatform('linux');

      setupMenu();

      const result = (electron.Menu.buildFromTemplate as any).mock.calls[0][0];
      expect(result.length).toBe(6);

      result.forEach((submenu) => {
        expect(!!submenu.role || !!(submenu.label && submenu.submenu)).toBe(true);
        expect(submenu).toBeTruthy();
      });
    });
  });

  describe('menu groups', () => {
    beforeEach(() => {
      ipcMainManager.removeAllListeners();
      ipcMainManager.send = jest.fn();
      overridePlatform('darwin');
      setupMenu();
    });

    describe('getHelpItems()', () => {
      let help;

      beforeEach(() => {
        const mock = (electron.Menu.buildFromTemplate as any).mock;
        const menu = mock.calls[0][0];
        help = menu[menu.length - 1];
      });

      it('hows the welcome tour', () => {
        help.submenu[1].click();
        expect(ipcMainManager.send).toHaveBeenCalledWith(IpcEvents.SHOW_WELCOME_TOUR);
      });

      it('toggles developer tools', () => {
        const mockToggle = jest.fn();

        (electron.BrowserWindow.getFocusedWindow as any).mockReturnValueOnce({
          isDestroyed: () => false,
          webContents: {
            openDevTools: mockToggle
          }
        });

        help.submenu[3].click();
        expect(mockToggle).toHaveBeenCalled();
      });

      it('opens the Fiddle repo', () => {
        help.submenu[5].click();
        expect(electron.shell.openExternal).toHaveBeenCalledWith('https://github.com/electron/fiddle');
      });

      it('opens the Electron repo', () => {
        help.submenu[6].click();
        expect(electron.shell.openExternal).toHaveBeenCalledWith('https://github.com/electron/electron');
      });

      it('opens the Electron issues', () => {
        help.submenu[7].click();
        expect(electron.shell.openExternal).toHaveBeenCalledWith('https://github.com/electron/electron/issues');
      });
    });

    describe('getPreferencesItems()', () => {
      let preferences;

      beforeEach(() => {
        const mock = (electron.Menu.buildFromTemplate as any).mock;
        const menu = mock.calls[0][0];
        preferences = menu[0];
      });

      it('shows the preferences', () => {
        preferences.submenu[3].click();
        expect(ipcMainManager.send).toHaveBeenCalledWith(IpcEvents.OPEN_SETTINGS);
      });
    });

    describe('getQuitItems()', () => {
      let quit;

      beforeEach(() => {
        const mock = (electron.Menu.buildFromTemplate as any).mock;
        const menu = mock.calls[0][0];
        quit = menu[0];
      });

      it('quits the app', () => {
        quit.submenu[quit.submenu.length - 1].click();
        expect(electron.app.quit).toHaveBeenCalled();
      });
    });

    describe('getTasksMenu()', () => {
      let tasks;

      beforeEach(() => {
        const mock = (electron.Menu.buildFromTemplate as any).mock;
        const menu = mock.calls[0][0];
        tasks = menu[menu.length - 2];
      });

      it('runs the fiddle', () => {
        tasks.submenu[0].click();
        expect(ipcMainManager.send).toHaveBeenCalledWith(IpcEvents.FIDDLE_RUN);
      });

      it('packages the fiddle', () => {
        tasks.submenu[1].click();
        expect(ipcMainManager.send).toHaveBeenCalledWith(IpcEvents.FIDDLE_PACKAGE);
      });

      it('makes the fiddle', () => {
        tasks.submenu[2].click();
        expect(ipcMainManager.send).toHaveBeenCalledWith(IpcEvents.FIDDLE_MAKE);
      });
    });

    describe('getFileMenu()', () => {
      let file;

      beforeEach(() => {
        const mock = (electron.Menu.buildFromTemplate as any).mock;
        const menu = mock.calls[0][0];
        file = menu[1];
      });

      it('creates a new fiddle', () => {
        file.submenu[0].click();
        expect(ipcMainManager.send).toHaveBeenCalledWith(IpcEvents.FS_NEW_FIDDLE);
      });

      it('opens a fiddle', () => {
        file.submenu[2].click();
        expect(electron.dialog.showOpenDialog).toHaveBeenCalled();
      });

      it('saves a fiddle', () => {
        file.submenu[4].click();
        expect(ipcMainManager.send).toHaveBeenCalledWith(IpcEvents.FS_SAVE_FIDDLE);
      });

      it('saves a fiddle as', () => {
        file.submenu[5].click();
        expect(electron.dialog.showOpenDialog).toHaveBeenCalled();
      });

      it('saves a fiddle as a gist', () => {
        file.submenu[7].click();
        expect(ipcMainManager.send).toHaveBeenCalledWith(IpcEvents.FS_SAVE_FIDDLE_GIST);
      });

      it('saves a fiddle as a forge project', () => {
        file.submenu[8].click();
        expect(electron.dialog.showOpenDialog).toHaveBeenCalled();
      });
    });
  });
});
