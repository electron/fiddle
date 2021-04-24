import { App } from '../../src/renderer/app';
import { EditorBackup } from '../../src/utils/editor-backup';
import { waitFor } from '../../src/utils/wait-for';
import { DefaultEditorId, PACKAGE_NAME } from '../../src/interfaces';
import { defaultDark, defaultLight } from '../../src/renderer/themes-defaults';

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
      const b = await app.getEditorValues({});
      expect(b[DefaultEditorId.html]).toBe('editor-value');
      expect(b[DefaultEditorId.main]).toBe('editor-value');
      expect(b[DefaultEditorId.renderer]).toBe('editor-value');
      expect(b[PACKAGE_NAME]).toBeTruthy();
      expect(JSON.parse(b[PACKAGE_NAME]!)).toBeTruthy();
    });

    it('handles missing editors', async () => {
      ElectronFiddle.editors[DefaultEditorId.html] = null;
      ElectronFiddle.editors[DefaultEditorId.main] = null;
      ElectronFiddle.editors[DefaultEditorId.renderer] = null;

      const app = new App();
      const result = await app.getEditorValues({});

      expect(result[DefaultEditorId.html]).toBe('');
      expect(result[DefaultEditorId.main]).toBe('');
      expect(result[DefaultEditorId.renderer]).toBe('');
      expect(result[PACKAGE_NAME]).toBeTruthy();
      expect(JSON.parse(result[PACKAGE_NAME]!)).toBeTruthy();
    });

    it('throws if the Fiddle object is not present', async () => {
      const app = new App();

      (window as any).ElectronFiddle = null;
      let threw = false;
      try {
        await app.getEditorValues({});
      } catch (error) {
        threw = true;
      }

      expect(threw).toBe(true);
    });
  });

  describe('replaceFiddle()', () => {
    it('sets editor values and source info', async () => {
      const editorValues = {
        [DefaultEditorId.html]: 'html-value',
        [DefaultEditorId.main]: 'main-value',
        [DefaultEditorId.renderer]: 'renderer-value',
        [DefaultEditorId.css]: '',
        [DefaultEditorId.preload]: '',
      };

      app.setEditorValues = jest.fn();
      await app.replaceFiddle(editorValues, {
        gistId: 'gistId',
        templateName: 'templateName',
        filePath: 'localPath',
      });
      expect(app.setEditorValues).toHaveBeenCalledWith(editorValues);
      expect(app.state.gistId).toBe('gistId');
      expect(app.state.templateName).toBe('templateName');
      expect(app.state.localPath).toBe('localPath');
    });

    it('only shows mosaic for non-empty editor contents', async () => {
      const editorValues = {
        [DefaultEditorId.html]: 'html-value',
        [DefaultEditorId.main]: 'main-value',
        [DefaultEditorId.renderer]: 'renderer-value',
        [DefaultEditorId.css]: '/* Empty */',
        [DefaultEditorId.preload]: '',
      };

      const gistId = 'gistId';
      await app.replaceFiddle(editorValues, { gistId });
      expect(app.state.setVisibleMosaics).toHaveBeenCalledWith([
        DefaultEditorId.main,
        DefaultEditorId.renderer,
        DefaultEditorId.html,
      ]);
    });

    it('shows visible mosaics for non-empty editor contents with custom mosaics', async () => {
      const file = 'file.js';
      const editorValues = {
        [DefaultEditorId.html]: 'html-value',
        [DefaultEditorId.main]: 'main-value',
        [DefaultEditorId.renderer]: 'renderer-value',
        [DefaultEditorId.css]: '/* Empty */',
        [DefaultEditorId.preload]: '',
        [file]: 'file-value',
      };

      const gistId = 'gistId';
      await app.replaceFiddle(editorValues, { gistId });
      expect(app.state.setVisibleMosaics).toHaveBeenCalledWith([
        file,
        DefaultEditorId.main,
        DefaultEditorId.renderer,
        DefaultEditorId.html,
      ]);
    });

    it('shows visible mosaics in the correct pre-defined order', async () => {
      // this order is defined inside the replaceFiddle() function
      const editorValues = {
        [DefaultEditorId.html]: 'html-value',
        [DefaultEditorId.main]: 'main-value',
        [DefaultEditorId.renderer]: 'renderer-value',
        [DefaultEditorId.css]: 'css-value',
      };
      const gistId = 'gistId';
      await app.replaceFiddle(editorValues, { gistId });
      expect(app.state.setVisibleMosaics).toHaveBeenCalledWith([
        DefaultEditorId.main,
        DefaultEditorId.renderer,
        DefaultEditorId.html,
        DefaultEditorId.css,
      ]);
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
        app.setEditorValues = jest.fn();
        app.state.isUnsaved = true;
        expect(app.state.localPath).toBeUndefined();
        expect(app.state.gistId).toBe('');
        expect(app.state.templateName).toBeUndefined();

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
            expect(app.setEditorValues).not.toHaveBeenCalled();
            expect(app.state.localPath).toBeUndefined();
            expect(app.state.gistId).toBe('');
            expect(app.state.templateName).toBeUndefined();
            done();
          });

        setTimeout(() => {
          expect(app.state.isGenericDialogShowing).toBe(true);
          app.state.genericDialogLastResult = false;
          app.state.isGenericDialogShowing = false;
        });
      });

      it('sets editor values and source info if prompt is accepted', (done) => {
        app.setEditorValues = jest.fn();
        app.state.isUnsaved = true;

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
            expect(app.setEditorValues).toHaveBeenCalledWith(editorValues);
            expect(app.state.gistId).toBe('gistId');
            expect(app.state.templateName).toBe('templateName');
            expect(app.state.localPath).toBe('localPath');
            done();
          });

        setTimeout(() => {
          expect(app.state.isGenericDialogShowing).toBe(true);
          app.state.genericDialogLastResult = true;
          app.state.isGenericDialogShowing = false;
        });
      });
    });
  });

  describe('setEditorValues()', () => {
    it('attempts to set values', () => {
      app.setEditorValues({
        [DefaultEditorId.html]: 'html-value',
        [DefaultEditorId.main]: 'main-value',
        [DefaultEditorId.renderer]: 'renderer-value',
      });

      expect(
        (window as any).ElectronFiddle.editors[DefaultEditorId.html].setValue,
      ).toHaveBeenCalledWith('html-value');
      expect(
        (window as any).ElectronFiddle.editors[DefaultEditorId.main].setValue,
      ).toHaveBeenCalledWith('main-value');
      expect(
        (window as any).ElectronFiddle.editors[DefaultEditorId.renderer]
          .setValue,
      ).toHaveBeenCalledWith('renderer-value');
    });

    it('attempts to set values for closed editors', () => {
      const { editors } = ElectronFiddle;

      const oldMainEditor = editors[DefaultEditorId.main];
      delete editors[DefaultEditorId.main];

      (app.state.closedPanels as any)[DefaultEditorId.main] = {
        model: { setValue: jest.fn() },
      };
      app.state.closedPanels[DefaultEditorId.preload] = {};
      app.state.closedPanels[DefaultEditorId.css] = {};

      app.setEditorValues({
        [DefaultEditorId.html]: 'html-value',
        [DefaultEditorId.main]: 'main-value',
        [DefaultEditorId.renderer]: 'renderer-value',
        [DefaultEditorId.preload]: 'preload-value',
        [DefaultEditorId.css]: 'css-value',
      });

      expect(
        (app.state.closedPanels[DefaultEditorId.main] as EditorBackup)!.model!
          .setValue,
      ).toHaveBeenCalledWith('main-value');
      expect(app.state.closedPanels[DefaultEditorId.preload]).toEqual({
        value: 'preload-value',
      });
      expect(app.state.closedPanels[DefaultEditorId.css]).toEqual({
        value: 'css-value',
      });

      editors[DefaultEditorId.main] = oldMainEditor;
    });

    it('throws if the Fiddle object is not present', async () => {
      (window as any).ElectronFiddle = null;
      let threw = false;
      try {
        await app.setEditorValues({
          [DefaultEditorId.html]: '',
          [DefaultEditorId.main]: '',
          [DefaultEditorId.renderer]: '',
        });
      } catch (error) {
        threw = true;
      }

      expect(threw).toBe(true);
    });

    it('does not set a value if none passed in', async () => {
      await app.setEditorValues({
        [DefaultEditorId.html]: 'html-value',
        [DefaultEditorId.main]: 'main-value',
      });

      expect(
        (window as any).ElectronFiddle.editors[DefaultEditorId.renderer]
          .setValue,
      ).not.toHaveBeenCalled();
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
