import { App } from '../../src/renderer/app';
import { waitFor } from '../../src/utils/wait-for';
import { DefaultEditorId } from '../../src/interfaces';
import { defaultDark, defaultLight } from '../../src/renderer/themes-defaults';
import { createEditorValues } from '../mocks/mocks';

jest.mock('../../src/renderer/components/header', () => ({
  Header: () => 'Header;',
}));
jest.mock('../../src/renderer/components/dialogs', () => ({
  Dialogs: () => 'Dialogs;',
}));
jest.mock('../../src/renderer/components/output-editors-wrapper', () => ({
  OutputEditorsWrapper: () => 'OutputEditorsWrapper;',
}));

describe('App component', () => {
  let app: App;
  let ElectronFiddle: any;

  beforeAll(() => {
    document.body.innerHTML = '<div id="app" />';
  });

  beforeEach(() => {
    ({ ElectronFiddle } = window as any);

    // make a real App and inject it into the mocks
    app = new App();
    const { app: appMock } = ElectronFiddle;
    const { state, fileManager, remoteLoader, runner } = appMock;
    Object.assign(app, { state, fileManager, remoteLoader, runner });
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

    it('unsets state of previous source when called', (done) => {
      app.state.isUnsaved = true;
      app.state.localPath = '/fake/path';

      const editorValues = {
        [DefaultEditorId.html]: 'html-value',
        [DefaultEditorId.main]: 'main-value',
        [DefaultEditorId.renderer]: 'renderer-value',
      };

      expect(app.state.localPath).toBe('/fake/path');

      app
        .replaceFiddle(editorValues, {
          gistId: 'gistId',
        })
        .then(() => {
          expect(app.state.localPath).toBeUndefined();
          done();
        });

      setTimeout(() => {
        expect(app.state.isGenericDialogShowing).toBe(true);
        app.state.genericDialogLastResult = true;
        app.state.isGenericDialogShowing = false;
      });
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
      expect(app.state.isUnsaved).toBe(false);
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
      expect(app.state.isUnsaved).toBe(false);
    });

    describe('when current Fiddle is unsaved and prompt appears', () => {
      it('takes no action if prompt is rejected', (done) => {
        const { state } = app;

        state.isUnsaved = true;
        expect(state.localPath).toBeUndefined();
        expect(state.gistId).toBe('');
        expect(state.templateName).toBeUndefined();

        app
          .replaceFiddle(
            {},
            {
              gistId: 'gistId',
              templateName: 'templateName',
              filePath: 'localPath',
            },
          )
          .then(() => {
            expect(state.editorMosaic.set).not.toHaveBeenCalled();
            expect(state.localPath).toBeUndefined();
            expect(state.gistId).toBe('');
            expect(state.templateName).toBeUndefined();
            done();
          });

        setTimeout(() => {
          expect(state.isGenericDialogShowing).toBe(true);
          state.genericDialogLastResult = false;
          state.isGenericDialogShowing = false;
        });
      });

      it('sets editor values and source info if prompt is accepted', (done) => {
        const { state } = app;
        state.isUnsaved = true;

        const editorValues = {
          [DefaultEditorId.html]: 'html-value',
          [DefaultEditorId.main]: 'main-value',
          [DefaultEditorId.renderer]: 'renderer-value',
        };

        app
          .replaceFiddle(editorValues, {
            gistId: 'gistId',
            templateName: 'templateName',
            filePath: 'localPath',
          })
          .then(() => {
            expect(state.editorMosaic.set).toHaveBeenCalledWith(editorValues);
            expect(state.gistId).toBe('gistId');
            expect(state.templateName).toBe('templateName');
            expect(state.localPath).toBe('localPath');
            done();
          });

        setTimeout(() => {
          expect(state.isGenericDialogShowing).toBe(true);
          state.genericDialogLastResult = true;
          state.isGenericDialogShowing = false;
        });
      });
    });
  });

  describe('setupResizeListener()', () => {
    it('attaches to the handler', () => {
      window.addEventListener = jest.fn();

      const app = new App();
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

      const app = new App();
      await app.loadTheme();

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

      const app = new App();
      app.state.theme = 'defaultLight';

      await app.loadTheme();

      expect(document.body.classList.value).toBe('');
    });

    it('adds the dark theme option if required', async () => {
      const app = new App();
      app.state.theme = 'custom-dark';

      await app.loadTheme();

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
});
