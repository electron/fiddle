/**
 * @jest-environment node
 */

import * as electron from 'electron';

import { BlockableAccelerator } from '../../src/interfaces';
import { IpcEvents } from '../../src/ipc-events';
import { ipcMainManager } from '../../src/main/ipc';
import { setupMenu } from '../../src/main/menu';
import { createMainWindow } from '../../src/main/windows';
import { overridePlatform, resetPlatform } from '../utils';

jest.mock('../../src/main/windows');
jest.mock('../../src/main/ipc');

describe('menu', () => {
  beforeEach(() => {
    electron.app.name = 'Electron Fiddle';
    (electron.dialog.showOpenDialog as jest.Mock).mockResolvedValue({});
  });

  afterEach(() => {
    resetPlatform();
  });

  describe('setupMenu()', () => {
    it('creates a menu (Darwin)', () => {
      overridePlatform('darwin');

      setupMenu();

      const result = (electron.Menu.buildFromTemplate as jest.Mock).mock
        .calls[0][0];
      expect(result.length).toBe(8);

      result.forEach((submenu: Electron.MenuItemConstructorOptions) => {
        expect(!!submenu.role || !!(submenu.label && submenu.submenu)).toBe(
          true,
        );
        expect(submenu).toBeTruthy();
      });
    });

    it('creates a menu (Windows)', () => {
      overridePlatform('win32');

      setupMenu();

      const result = (electron.Menu.buildFromTemplate as jest.Mock).mock
        .calls[0][0];
      expect(result.length).toBe(7);

      result.forEach((submenu: Electron.MenuItemConstructorOptions) => {
        expect(!!submenu.role || !!(submenu.label && submenu.submenu)).toBe(
          true,
        );
        expect(submenu).toBeTruthy();
      });
    });

    it('creates a menu (Linux)', () => {
      overridePlatform('linux');

      setupMenu();

      const result = (electron.Menu.buildFromTemplate as jest.Mock).mock
        .calls[0][0];
      expect(result.length).toBe(7);

      result.forEach((submenu: Electron.MenuItemConstructorOptions) => {
        expect(!!submenu.role || !!(submenu.label && submenu.submenu)).toBe(
          true,
        );
        expect(submenu).toBeTruthy();
      });
    });

    it('adds Monaco toggle options', () => {
      overridePlatform('linux');

      setupMenu();

      const result = (electron.Menu.buildFromTemplate as jest.Mock).mock
        .calls[0][0];
      const submenu = result[2]
        .submenu as Array<Electron.MenuItemConstructorOptions>;

      const toggleSoftWrap = submenu.find(
        ({ label }) => label === 'Toggle Soft Wrap',
      );
      (toggleSoftWrap as any).click();
      expect(ipcMainManager.send).toHaveBeenCalledTimes(1);

      const toggleMap = submenu.find(
        ({ label }) => label === 'Toggle Mini Map',
      );
      (toggleMap as any).click();
      expect(ipcMainManager.send).toHaveBeenCalledTimes(2);
    });

    it('adds Bisect toggle', () => {
      overridePlatform('linux');

      setupMenu();

      const result = (electron.Menu.buildFromTemplate as jest.Mock).mock
        .calls[0][0];
      const submenu = result[2]
        .submenu as Array<Electron.MenuItemConstructorOptions>;

      const toggleSoftWrap = submenu.find(
        ({ label }) => label === 'Toggle Bisect Helper',
      );
      (toggleSoftWrap as any).click();
      expect(ipcMainManager.send).toHaveBeenCalledWith<any>(
        IpcEvents.BISECT_COMMANDS_TOGGLE,
      );
    });

    it('overwrites Select All command', () => {
      setupMenu();

      const result = (electron.Menu.buildFromTemplate as jest.Mock).mock
        .calls[0][0];
      // use find here because the index is platform-specific
      const submenu = result.find((r: any) => r.label === 'Edit')
        .submenu as Array<Electron.MenuItemConstructorOptions>;

      const selectAll = submenu.find(({ label }) => label === 'Select All');
      (selectAll as any).click();
      expect(ipcMainManager.send).toHaveBeenCalledWith<any>(
        IpcEvents.SELECT_ALL_IN_EDITOR,
      );
    });

    describe('setup Show Me menu', () => {
      it('show me menu correctly contains no check when no template is selected', () => {
        overridePlatform('darwin');
        setupMenu();

        const result = (electron.Menu.buildFromTemplate as jest.Mock).mock
          .calls[0][0];
        const showMeMenu = result[result.length - 2];

        const showMeItemChecked = showMeMenu?.submenu[0]?.submenu[0]?.checked;
        expect(showMeItemChecked).toEqual(false);
      });

      it('checks correct show me radio button after click', () => {
        overridePlatform('darwin');
        // simulate the menu rebuild after click that sends correct templateName
        setupMenu({ activeTemplate: 'App' });

        const result = (electron.Menu.buildFromTemplate as jest.Mock).mock
          .calls[0][0];
        const showMeMenu = result[result.length - 2];

        const showMeItemChecked = showMeMenu?.submenu[0]?.submenu[0]?.checked;
        expect(showMeItemChecked).toEqual(true);
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
      let help: any;

      beforeEach(() => {
        const mock = (electron.Menu.buildFromTemplate as jest.Mock).mock;
        const menu = mock.calls[0][0];
        help = menu[menu.length - 1];
      });

      it('shows the welcome tour', () => {
        help.submenu[1].click();
        expect(ipcMainManager.send).toHaveBeenCalledWith<any>(
          IpcEvents.SHOW_WELCOME_TOUR,
        );
      });

      it('toggles developer tools', () => {
        const mocks = {
          toggleDevTools: jest.fn(),
        };

        (electron.BrowserWindow.getFocusedWindow as jest.Mock).mockReturnValue({
          isDestroyed: () => false,
          webContents: mocks,
        });

        help.submenu[3].click();
        expect(mocks.toggleDevTools).toHaveBeenCalled();
      });

      it('opens the Fiddle repo', () => {
        help.submenu[5].click();
        expect(electron.shell.openExternal).toHaveBeenCalledWith<any>(
          'https://github.com/electron/fiddle',
        );
      });

      it('opens the Electron repo', () => {
        help.submenu[6].click();
        expect(electron.shell.openExternal).toHaveBeenCalledWith<any>(
          'https://github.com/electron/electron',
        );
      });

      it('opens the Electron issues', () => {
        help.submenu[7].click();
        expect(electron.shell.openExternal).toHaveBeenCalledWith<any>(
          'https://github.com/electron/electron/issues',
        );
      });
    });

    describe('getPreferencesItems()', () => {
      let preferences: any;

      beforeEach(() => {
        const mock = (electron.Menu.buildFromTemplate as jest.Mock).mock;
        const menu = mock.calls[0][0];
        preferences = menu[0];
      });

      it('shows the preferences', () => {
        preferences.submenu[3].click();
        expect(ipcMainManager.send).toHaveBeenCalledWith<any>(
          IpcEvents.OPEN_SETTINGS,
        );
      });
    });

    describe('getQuitItems()', () => {
      let quit: any;

      beforeEach(() => {
        const mock = (electron.Menu.buildFromTemplate as jest.Mock).mock;
        const menu = mock.calls[0][0];
        quit = menu[0];
      });

      it('quits the app', () => {
        quit.submenu[quit.submenu.length - 1].click();
        expect(electron.app.quit).toHaveBeenCalled();
      });
    });

    describe('getShowMeMenu()', () => {
      let showMe: any;

      beforeEach(() => {
        const mock = (electron.Menu.buildFromTemplate as jest.Mock).mock;
        const menu = mock.calls[0][0];
        showMe = menu[menu.length - 2];
      });

      it('attempts to open a template on click', () => {
        showMe.submenu[0].submenu[0].click();
        expect(ipcMainManager.send).toHaveBeenCalledWith<any>(
          IpcEvents.FS_OPEN_TEMPLATE,
          ['App'],
        );
      });
    });

    describe('getTasksMenu()', () => {
      let tasks: any;

      beforeEach(() => {
        const mock = (electron.Menu.buildFromTemplate as jest.Mock).mock;
        const menu = mock.calls[0][0];
        tasks = menu[menu.length - 3];
      });

      it('runs the fiddle', () => {
        tasks.submenu[0].click();
        expect(ipcMainManager.send).toHaveBeenCalledWith<any>(
          IpcEvents.FIDDLE_RUN,
        );
      });

      it('packages the fiddle', () => {
        tasks.submenu[1].click();
        expect(ipcMainManager.send).toHaveBeenCalledWith<any>(
          IpcEvents.FIDDLE_PACKAGE,
        );
      });

      it('makes the fiddle', () => {
        tasks.submenu[2].click();
        expect(ipcMainManager.send).toHaveBeenCalledWith<any>(
          IpcEvents.FIDDLE_MAKE,
        );
      });
    });

    describe('getFileMenu()', () => {
      let file: any;
      enum Idx {
        NEW_FIDDLE = 0,
        NEW_TEST = 1,
        NEW_WINDOW = 2,
        OPEN = 4,
        OPEN_RECENT = 5,
        SAVE = 7,
        SAVE_AS = 8,
        PUBLISH = 10,
        FORGE = 11,
      }

      beforeEach(() => {
        const mock = (electron.Menu.buildFromTemplate as jest.Mock).mock;
        const menu = mock.calls[0][0];
        file = menu[1];
      });

      it('creates a new fiddle', () => {
        file.submenu[Idx.NEW_FIDDLE].click();
        expect(ipcMainManager.send).toHaveBeenCalledWith<any>(
          IpcEvents.FS_NEW_FIDDLE,
        );
      });

      it('creates a new fiddle', () => {
        file.submenu[Idx.NEW_TEST].click();
        expect(ipcMainManager.send).toHaveBeenCalledWith<any>(
          IpcEvents.FS_NEW_TEST,
        );
      });

      it('creates a new window', () => {
        file.submenu[Idx.NEW_WINDOW].click();
        file.submenu[Idx.NEW_WINDOW].click();
        expect(createMainWindow).toHaveBeenCalledTimes(2);
      });

      it('opens a Fiddle', () => {
        file.submenu[Idx.OPEN].click();
        expect(electron.dialog.showOpenDialog).toHaveBeenCalled();
      });

      it('saves a Fiddle', () => {
        file.submenu[Idx.SAVE].click();
        expect(ipcMainManager.send).toHaveBeenCalledWith<any>(
          IpcEvents.FS_SAVE_FIDDLE,
        );
      });

      it('saves a Fiddle as', () => {
        file.submenu[Idx.SAVE_AS].click();
        expect(electron.dialog.showOpenDialogSync).toHaveBeenCalled();
      });

      it('saves a Fiddle as a gist', () => {
        file.submenu[Idx.PUBLISH].click();
        expect(ipcMainManager.send).toHaveBeenCalledWith<any>(
          IpcEvents.FS_SAVE_FIDDLE_GIST,
        );
      });

      it('saves a Fiddle as a forge project', () => {
        file.submenu[Idx.FORGE].click();
        expect(electron.dialog.showOpenDialogSync).toHaveBeenCalled();
      });

      it('saves a Fiddle with blocked accelerator', () => {
        setupMenu({ acceleratorsToBlock: [BlockableAccelerator.save] });
        file.submenu[Idx.SAVE].click();
        expect(ipcMainManager.send).toHaveBeenCalledWith<any>(
          IpcEvents.FS_SAVE_FIDDLE,
        );
      });

      it('saves as a Fiddle with blocked accelerator', () => {
        setupMenu({ acceleratorsToBlock: [BlockableAccelerator.saveAs] });
        file.submenu[Idx.SAVE_AS].click();
        expect(electron.dialog.showOpenDialogSync).toHaveBeenCalled();
      });
    });
  });
});
