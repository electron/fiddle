import { App } from '../../src/renderer/app';
import { DefaultEditorId, EditorValues } from '../../src/interfaces';
import { EditorMosaicMock, createEditorValues } from '../mocks/mocks';
import { IpcEvents } from '../../src/ipc-events';
import { defaultDark, defaultLight } from '../../src/renderer/themes-defaults';
import { ipcRendererManager } from '../../src/renderer/ipc';
import { waitFor } from '../../src/utils/wait-for';
import { setupBinary } from '../../src/renderer/binary';

global.fetch = window.fetch = jest.fn();

jest.mock('../../src/renderer/components/header', () => ({
  Header: () => 'Header;',
}));
jest.mock('../../src/renderer/components/dialogs', () => ({
  Dialogs: () => 'Dialogs;',
}));
jest.mock('../../src/renderer/components/output-editors-wrapper', () => ({
  OutputEditorsWrapper: () => 'OutputEditorsWrapper;',
}));

// TODO(ckerr): these two `jest.mock` calls are required because
// instantiating a new App instantiates a new State, which
// calls setVersion(), which tries to fetch binary & types.
jest.mock('../../src/renderer/binary', () => ({
  getVersionState: jest.fn(),
  setupBinary: jest.fn(),
}));
jest.mock('../../src/renderer/fetch-types', () => ({
  getLocalTypePathForVersion: jest.fn(),
  updateEditorTypeDefinitions: jest.fn(),
}));

describe('App component', () => {
  let app: App;
  let ElectronFiddle: any;

  beforeAll(() => {
    document.body.innerHTML = '<div id="app" />';
  });

  beforeEach(() => {
    (setupBinary as jest.Mock).mockReturnValue(() => Promise.resolve());

    // make a real App and inject it into the mocks
    ({ ElectronFiddle } = window as any);
    const { app: appMock } = ElectronFiddle;
    const { fileManager, remoteLoader, runner, state } = appMock;
    app = new App();
    Object.assign(app, { fileManager, remoteLoader, runner, state });
    ElectronFiddle.app = app;
  });

  describe('setup()', () => {
    it('renders the app', async () => {
      jest.useFakeTimers();

      const result = (await app.setup()) as HTMLDivElement;
      jest.runAllTimers();

      expect(result.innerHTML).toBe('Dialogs;Header;OutputEditorsWrapper;');

      jest.useRealTimers();
    });
  });

  describe('openFiddle()', () => {
    it('understands gists', async () => {
      const { fetchGistAndLoad } = app.remoteLoader;
      (fetchGistAndLoad as jest.Mock).mockResolvedValue(true);

      const gistId = '8c5fc0c6a5153d49b5a4a56d3ed9da8f';
      await app.openFiddle({ gistId });
      expect(fetchGistAndLoad).toHaveBeenCalledWith(gistId);
    });

    it('understands files', async () => {
      const { openFiddle } = app.fileManager;
      (openFiddle as jest.Mock).mockImplementationOnce(() => Promise.resolve());

      const filePath = '/fake/path';
      await app.openFiddle({ filePath });
      expect(openFiddle).toHaveBeenCalledWith(filePath);
    });
  });

  describe('getEditorValues()', () => {
    it('gets values', async () => {
      const values = createEditorValues();
      (app.state.editorMosaic.values as jest.Mock).mockReturnValue(values);
      const b = await app.getEditorValues({});
      expect(b).toStrictEqual(values);
    });
  });

  describe('replaceFiddle()', () => {
    it('sets editor values and source info', async () => {
      const { state } = app;

      const editorValues = {
        [DefaultEditorId.html]: 'html-value',
        [DefaultEditorId.main]: 'main-value',
        [DefaultEditorId.renderer]: 'renderer-value',
        [DefaultEditorId.css]: '',
        [DefaultEditorId.preload]: '',
      };

      await app.replaceFiddle(editorValues, {
        gistId: 'gistId',
        templateName: 'templateName',
        filePath: 'localPath',
      });
      expect(state.editorMosaic.set).toHaveBeenCalledWith(editorValues);
      expect(state.gistId).toBe('gistId');
      expect(state.templateName).toBe('templateName');
      expect(state.localPath).toBe('localPath');
    });

    it('unsets state of previous source when called', async () => {
      app.state.editorMosaic.isEdited = true;
      app.state.localPath = '/fake/path';

      (app.state.runConfirmationDialog as jest.Mock).mockResolvedValue(true);
      const editorValues = {
        [DefaultEditorId.html]: 'html-value',
        [DefaultEditorId.main]: 'main-value',
        [DefaultEditorId.renderer]: 'renderer-value',
      };

      await app.replaceFiddle(editorValues, { gistId: 'gistId' });
      expect(app.state.localPath).toBeUndefined();
    });

    it('marks the new Fiddle as Saved', async () => {
      const editorValues = {
        [DefaultEditorId.html]: 'html-value',
        [DefaultEditorId.main]: 'main-value',
        [DefaultEditorId.renderer]: 'renderer-value',
      } as const;

      await app.replaceFiddle(editorValues, {
        filePath: 'localPath',
        gistId: 'gistId',
        templateName: 'templateName',
      });
      expect(app.state.editorMosaic.isEdited).toBe(false);
    });

    it('marks the new Fiddle as Saved with custom editors', async () => {
      const file = 'file.js';
      const editorValues = {
        [DefaultEditorId.html]: 'html-value',
        [DefaultEditorId.main]: 'main-value',
        [DefaultEditorId.renderer]: 'renderer-value',
        [file]: 'file-value',
      } as const;

      await app.replaceFiddle(editorValues, {
        filePath: 'localPath',
        gistId: 'gistId',
        templateName: 'templateName',
      });
      expect(app.state.editorMosaic.isEdited).toBe(false);
    });

    describe('when current Fiddle is unsaved and prompt appears', () => {
      it('takes no action if prompt is rejected', async () => {
        const { state } = app;

        state.editorMosaic.isEdited = true;
        expect(state.localPath).toBeUndefined();
        expect(state.gistId).toBe('');
        expect(state.templateName).toBeUndefined();

        (app.state.runConfirmationDialog as jest.Mock).mockResolvedValue(false);

        await app.replaceFiddle(
          {},
          {
            gistId: 'gistId',
            templateName: 'templateName',
            filePath: 'localPath',
          },
        );
        expect(state.editorMosaic.set).not.toHaveBeenCalled();
        expect(state.localPath).toBeUndefined();
        expect(state.gistId).toBe('');
        expect(state.templateName).toBeUndefined();
      });

      it('sets editor values and source info if prompt is accepted', async () => {
        const { state } = app;
        state.editorMosaic.isEdited = true;

        const editorValues = {
          [DefaultEditorId.html]: 'html-value',
          [DefaultEditorId.main]: 'main-value',
          [DefaultEditorId.renderer]: 'renderer-value',
        };

        (app.state.runConfirmationDialog as jest.Mock).mockResolvedValue(true);

        await app.replaceFiddle(editorValues, {
          gistId: 'gistId',
          templateName: 'templateName',
          filePath: 'localPath',
        });
        expect(state.editorMosaic.set).toHaveBeenCalledWith(editorValues);
        expect(state.gistId).toBe('gistId');
        expect(state.templateName).toBe('templateName');
        expect(state.localPath).toBe('localPath');
      });
    });
  });

  describe('setupResizeListener()', () => {
    it('attaches to the handler', () => {
      window.addEventListener = jest.fn();

      app.setupResizeListener();

      expect(window.addEventListener).toHaveBeenCalledWith(
        'resize',
        expect.anything(),
      );
    });
  });

  describe('loadTheme()', () => {
    it(`adds the current theme's css to the document`, async () => {
      document.head!.innerHTML = "<style id='fiddle-theme'></style>";

      await app.loadTheme('');

      expect(document.head!.innerHTML).toEqual(
        `<style id="fiddle-theme">
          html, body {
            --foreground-1: #9feafa;
            --foreground-2: #8ac7d6;
            --foreground-3: #608291;
            --background-4: #21232d;
            --background-3: #2c2e3b;
            --background-2: #1d2427;
            --background-1: #2f3241;
            --border-color-2: #1e2527;
            --border-color-1: #5c5f71;
            --border: 1px solid var(--border-color-1);
            --button-text-color: #000;
            --text-color-1: #ffffff;
            --text-color-2: #1e2527;
            --text-color-3: #dcdcdc;
            --error-color: #df3434;
            --fonts-common: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
          }
        </style>`.replace(/        /gm, ''),
      );
    });

    it('removes the dark theme option if required', async () => {
      document.body.classList.add('bp3-dark');

      await app.loadTheme('defaultLight');

      expect(document.body.classList.value).toBe('');
    });

    it('adds the dark theme option if required', async () => {
      await app.loadTheme('custom-dark');

      expect(document.body.classList.value).toBe('bp3-dark');
    });
  });

  describe('setupThemeListeners()', () => {
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
        expect(addEventListenerMock).toHaveBeenCalledWith(
          'change',
          expect.anything(),
        );
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
    it('updates the document title when state.title changes', async () => {
      const title = 'Hello, World!';
      app.setupTitleListeners();
      (app.state.title as any) = title;
      await waitFor(() => document.title?.length > 0);
      expect(document.title).toMatch(title);
    });
  });

  describe('prompting to confirm replacing an unsaved fiddle', () => {
    // make a second fiddle that differs from the first
    const editorValues = createEditorValues();
    const editorValues2: EditorValues = { MAIN_JS: '// hello world' };
    let editorMosaic: EditorMosaicMock;

    beforeEach(() => {
      ({ editorMosaic } = app.state as any);
    });

    async function testDialog(confirm: boolean) {
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
      (app.state.runConfirmationDialog as jest.Mock).mockResolvedValue(confirm);

      // now try to replace
      await app.replaceFiddle(editorValues2, { gistId });
      expect(app.state.runConfirmationDialog).toHaveBeenCalled();
    }

    it('does not replace the fiddle if not confirmed', async () => {
      await testDialog(false);
      expect(app.state.editorMosaic.set).toHaveBeenCalledTimes(1);
    });

    it('replaces the fiddle if confirmed', async () => {
      await testDialog(true);
      expect(app.state.editorMosaic.set).toHaveBeenCalledTimes(2);
    });
  });

  describe('prompting to confirm exiting an unsaved fiddle', () => {
    beforeEach(() => {
      // setup: mock close & ipc
      window.close = jest.fn();
      ipcRendererManager.send = jest.fn();
      app.setupUnloadListeners();
    });

    it('can close the window if user accepts the dialog', async () => {
      (app.state.runConfirmationDialog as jest.Mock).mockResolvedValue(true);

      // expect the app to be watching for exit if the fiddle is edited
      app.state.editorMosaic.isEdited = true;
      expect(window.onbeforeunload).toBeTruthy();
      const result = await window.onbeforeunload!(undefined as any);
      expect(result).toBe(false);
      expect(window.close).toHaveBeenCalled();
    });

    it('can close the app after user accepts dialog', async () => {
      app.state.isQuitting = true;
      (app.state.runConfirmationDialog as jest.Mock).mockResolvedValue(true);

      // expect the app to be watching for exit if the fiddle is edited
      app.state.editorMosaic.isEdited = true;
      expect(window.onbeforeunload).toBeTruthy();
      const result = await window.onbeforeunload!(undefined as any);

      expect(result).toBe(false);
      expect(window.close).toHaveBeenCalledTimes(1);
      expect(ipcRendererManager.send).toHaveBeenCalledWith(
        IpcEvents.CONFIRM_QUIT,
      );
    });

    it('does nothing if user cancels the dialog', async () => {
      app.state.isQuitting = true;
      (app.state.runConfirmationDialog as jest.Mock).mockResolvedValue(false);

      // expect the app to be watching for exit if the fiddle is edited
      app.state.editorMosaic.isEdited = true;
      expect(window.onbeforeunload).toBeTruthy();
      const result = await window.onbeforeunload!(undefined as any);

      expect(result).toBe(false);
      expect(window.close).not.toHaveBeenCalled();
      expect(ipcRendererManager.send).not.toHaveBeenCalled();
    });
  });
});
