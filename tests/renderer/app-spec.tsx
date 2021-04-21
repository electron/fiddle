import { reaction } from 'mobx';

import { App } from '../../src/renderer/app';
import { AppState } from '../../src/renderer/state';
import { EditorMosaic } from '../../src/renderer/editor-mosaic';
import { EditorValues } from '../../src/interfaces';
import { IpcEvents } from '../../src/ipc-events';
import { defaultDark, defaultLight } from '../../src/renderer/themes-defaults';
import { ipcRendererManager } from '../../src/renderer/ipc';
import { waitFor } from '../../src/utils/wait-for';

import { ElectronFiddleMock } from '../mocks/electron-fiddle';
import { MockState } from '../mocks/state';
import { createEditorValues } from '../mocks/editor-values';

jest.mock('fs-extra');
jest.mock('../../src/renderer/binary', () => ({
  downloadBinary: jest.fn().mockImplementation(() => Promise.resolve()),
  getVersionState: jest.fn().mockReturnValue('ready'),
  setupBinary: jest.fn().mockImplementation(() => Promise.resolve()),
}));
jest.mock('../../src/renderer/fetch-types', () => ({
  fetchTypeDefinitions: jest.fn(),
  updateEditorTypeDefinitions: jest.fn(),
}));
jest.mock('../../src/renderer/file-manager', () =>
  require('../mocks/file-manager'),
);
jest.mock('../../src/renderer/components/dialogs', () => ({
  Dialogs: () => 'Dialogs;',
}));
jest.mock('../../src/renderer/components/header', () => ({
  Header: () => 'Header;',
}));
jest.mock('../../src/renderer/components/output-editors-wrapper', () => ({
  OutputEditorsWrapper: () => 'OutputEditorsWrapper;',
}));

describe('App component', () => {
  let editorValues: EditorValues;

  beforeAll(() => {
    editorValues = createEditorValues();
    document.body.innerHTML = '<div id="app" />';
  });

  beforeEach(() => {
    (window as any).ElectronFiddle = new ElectronFiddleMock();
  });

  describe('setup()', () => {
    it('renders the app', async () => {
      jest.useFakeTimers();

      const app = new App();
      const result = (await app.setup()) as HTMLDivElement;
      jest.runAllTimers();

      expect(result.innerHTML).toBe('Dialogs;Header;OutputEditorsWrapper;');

      jest.useRealTimers();
    });
  });

  describe('openFiddle()', () => {
    it('understands gists', async () => {
      const gistId = '8c5fc0c6a5153d49b5a4a56d3ed9da8f';
      const app = new App();

      const spy = jest.spyOn(app.remoteLoader, 'fetchGistAndLoad');
      spy.mockResolvedValue(true);

      await app.openFiddle({ gistId });

      expect(spy).toHaveBeenCalledWith(gistId);

      spy.mockRestore();
    });

    it('understands files', async () => {
      const filePath = '/fake/path';
      const app = new App();

      const openFiddle = app.fileManager.openFiddle as jest.Mock;
      openFiddle.mockImplementationOnce(() => Promise.resolve());

      await app.openFiddle({ filePath });

      expect(openFiddle).toHaveBeenCalledWith(filePath);
    });
  });

  describe('getEditorValues()', () => {
    it('gets values', async () => {
      const app = new App();
      app.editorMosaic.set(editorValues);
      expect(await app.getEditorValues()).toStrictEqual(editorValues);
    });
  });

  describe('replaceFiddle()', () => {
    let app: App;
    let state: MockState;
    let editorMosaic: EditorMosaic;

    beforeEach(() => {
      app = new App();
      ({ editorMosaic } = app);
      state = new MockState();
      app.state = (state as any) as AppState;
      app.state.setGenericDialogOptions = jest.fn();
    });

    it('sets editor values and source info', async () => {
      const filePath = '/dev/urandom';
      const gistId = '129fe1ed16f97c5b65e86795c7aa9762';
      const templateName = 'clipboard';
      await app.replaceFiddle(editorValues, { filePath, templateName, gistId });

      expect(app.state.gistId).toBe(gistId);
      expect(app.state.templateName).toBe(templateName);
      expect(app.state.localPath).toBe(filePath);
    });

    describe('prompting to confirm replacing an unsaved fiddle', () => {
      // make a second fiddle that differs from the first
      const editorValues2: EditorValues = { MAIN_JS: '// hello world' };

      async function testDialog(
        confirm: boolean,
        expectedValues: EditorValues,
      ) {
        const localPath = '/etc/passwd';
        const gistId = '2c24ecd147c9c28c9b2d0cf738d4993a';

        // load up a fiddle...
        await app.replaceFiddle(editorValues, { filePath: localPath });
        expect(app.state.gistId).toBeFalsy();
        expect(app.state.localPath).toBe(localPath);

        // ...mark it as edited so that trying a confirm dialog
        // will be triggered when we try to replace it
        editorMosaic.isEdited = true;

        // set up a reaction to confirm the replacement
        // when it happens
        const respondToDialog = jest.fn().mockImplementation(() => {
          console.log(new Error('trace'));
          expect(app.state.isGenericDialogShowing).toBe(true);
          app.state.genericDialogLastResult = confirm;
          app.state.isGenericDialogShowing = false;
        });
        const disposer = reaction(
          () => state.isGenericDialogShowing,
          respondToDialog,
        );

        // now try to replace
        await app.replaceFiddle(editorValues2, { gistId });

        expect(respondToDialog).toHaveBeenCalled();
        expect(await app.getEditorValues()).toStrictEqual(expectedValues);

        // cleanup
        disposer();
      }

      it('does not replace the fiddle if not confirmed', async () => {
        await testDialog(false, editorValues);
      });

      it('replaces the fiddle if confirmed', async () => {
        await testDialog(true, editorValues2);
      });
    });
  });

  describe('setupThemeListeners()', () => {
    let app: App;
    const addEventListenerMock = jest.fn();
    beforeEach(() => {
      // matchMedia mock
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: jest.fn(), // Deprecated
          removeListener: jest.fn(), // Deprecated
          addEventListener: addEventListenerMock,
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      // app mock
      app = new App();
      (app.state as Partial<AppState>) = new MockState();
      app.state.isUsingSystemTheme = true;
      app.state.setTheme = jest.fn();
    });

    describe('isUsingSystemTheme reaction', () => {
      it('ignores system theme changes when not isUsingSystemTheme', () => {
        app.state.isUsingSystemTheme = true;
        app.setupThemeListeners();
        app.state.isUsingSystemTheme = false;
        expect(app.state.setTheme).not.toHaveBeenCalled();
      });

      it('sets theme according to system when isUsingSystemTheme', () => {
        app.setupThemeListeners();

        // isUsingSystemTheme and prefersDark
        app.state.isUsingSystemTheme = false;
        (window.matchMedia as jest.Mock).mockReturnValue({
          matches: true,
        });
        app.state.isUsingSystemTheme = true;
        expect(app.state.setTheme).toHaveBeenCalledWith(defaultDark.file);

        // isUsingSystemTheme and not prefersDark
        app.state.isUsingSystemTheme = false;
        (window.matchMedia as jest.Mock).mockReturnValue({
          matches: false,
        });
        app.state.isUsingSystemTheme = true;
        expect(app.state.setTheme).toHaveBeenCalledWith(defaultLight.file);
      });
    });

    describe('prefers-color-scheme event listener', () => {
      it('adds an event listener to the "change" event', () => {
        app.setupThemeListeners();
        expect(addEventListenerMock).toHaveBeenCalled();
        const event = addEventListenerMock.mock.calls[0][0];
        expect(event).toBe('change');
      });

      it('does nothing if not isUsingSystemTheme', () => {
        app.setupThemeListeners();
        const callback = addEventListenerMock.mock.calls[0][1];
        app.state.isUsingSystemTheme = false;
        callback({ matches: true });
        expect(app.state.setTheme).not.toHaveBeenCalled();
      });

      it('sets dark theme if isUsingSystemTheme and prefers dark', () => {
        app.setupThemeListeners();
        const callback = addEventListenerMock.mock.calls[0][1];
        app.state.isUsingSystemTheme = true;
        callback({ matches: true });
        expect(app.state.setTheme).toHaveBeenCalledWith(defaultDark.file);
      });

      it('sets light theme if isUsingSystemTheme and not prefers dark', () => {
        app.setupThemeListeners();
        const callback = addEventListenerMock.mock.calls[0][1];
        app.state.isUsingSystemTheme = true;
        callback({ matches: false });
        expect(app.state.setTheme).toHaveBeenCalledWith(defaultLight.file);
      });
    });
  });

  describe('setupTitleListeners()', () => {
    let app: App;

    beforeEach(() => {
      app = new App();
    });

    it('updates the document title when state.title changes', async () => {
      const oldTitle = document.title;
      const newTitle = '😊';

      const state = new MockState();
      app.state = state as any;
      app.setupTitleListeners();
      state.title = newTitle;

      await waitFor(() => document.title != oldTitle);

      expect(document.title).toMatch(newTitle);
    });
  });

  describe('isUnsaved autorun handler', () => {
    let app: App;

    beforeEach(() => {
      // setup: mock close & ipc
      window.close = jest.fn();
      ipcRendererManager.send = jest.fn();

      // setup: create an app
      app = new App();
      (window as any).ElectronFiddle.app = app;
      app.setupUnloadListeners();

      // expect the app to be watching for exit if the fiddle is edited
      app.editorMosaic.isEdited = true;
      expect(window.onbeforeunload).toBeTruthy();

      // expect that the code watching for exit pops up a confirmation dialog
      const result = window.onbeforeunload!(undefined as any);
      expect(result).toBe(false);
      expect(app.state.isGenericDialogShowing).toBe(true);
    });

    it('can close the window if user accepts the dialog', (done) => {
      app.state.genericDialogLastResult = true;
      app.state.isGenericDialogShowing = false;
      process.nextTick(() => {
        expect(window.close).toHaveBeenCalled();
        done();
      });
    });

    it('can close the app after user accepts dialog', (done) => {
      const { state } = app;
      state.genericDialogLastResult = true;
      state.isGenericDialogShowing = false;
      state.isQuitting = true;

      process.nextTick(() => {
        expect(window.close).toHaveBeenCalledTimes(1);
        expect(ipcRendererManager.send).toHaveBeenCalledWith<any>(
          IpcEvents.CONFIRM_QUIT,
        );
        done();
      });
    });

    it('takes no action if user cancels the dialog', (done) => {
      const { state } = app;
      state.genericDialogLastResult = false;
      state.isGenericDialogShowing = false;
      state.isQuitting = true;

      process.nextTick(() => {
        expect(window.close).toHaveBeenCalledTimes(0);
        expect(ipcRendererManager.send).not.toHaveBeenCalledWith<any>(
          IpcEvents.CONFIRM_QUIT,
        );
        done();
      });
    });
  });
});
