import { App } from '../../src/renderer/app';
import { AppState } from '../../src/renderer/state';
import { EditorBackup } from '../../src/utils/editor-backup';
import { ElectronFiddleMock } from '../mocks/electron-fiddle';
import { MockState } from '../mocks/state';
import { EditorId } from '../../src/interfaces';
import { defaultDark, defaultLight } from '../../src/renderer/themes-defaults';

jest.mock('../../src/renderer/file-manager', () =>
  require('../mocks/file-manager'),
);
jest.mock('../../src/renderer/state', () => ({
  appState: {
    theme: 'defaultDark',
    getName: () => 'Test',
    closedPanels: {},
  },
}));
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
  beforeAll(() => {
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

  describe('getEditorValues()', () => {
    it('gets values', async () => {
      const app = new App();
      const b = await app.getEditorValues({});

      expect(b.html).toBe('editor-value');
      expect(b.main).toBe('editor-value');
      expect(b.renderer).toBe('editor-value');
      expect(b.package).toBeTruthy();
      expect(JSON.parse(b.package!)).toBeTruthy();
    });

    it('handles missing editors', async () => {
      (window as any).ElectronFiddle.editors.html = null;
      (window as any).ElectronFiddle.editors.main = null;
      (window as any).ElectronFiddle.editors.renderer = null;

      const app = new App();
      const result = await app.getEditorValues({});

      expect(result.html).toBe('');
      expect(result.main).toBe('');
      expect(result.renderer).toBe('');
      expect(result.package).toBeTruthy();
      expect(JSON.parse(result.package!)).toBeTruthy();
    });

    it('throws if the Fiddle object is not present', async () => {
      (window as any).ElectronFiddle = null;

      const app = new App();
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
    let app: App;

    beforeEach(() => {
      app = new App();
      (app.state as Partial<AppState>) = new MockState();
      app.state.isUnsaved = false;
      app.state.setGenericDialogOptions = jest.fn();
      app.state.setVisibleMosaics = jest.fn();
      app.setEditorValues = jest.fn();
    });

    it('sets editor values and source info', (done) => {
      const editorValues = {
        html: 'html-value',
        main: 'main-value',
        renderer: 'renderer-value',
        preload: '',
        css: '',
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
    });

    it('only shows mosaic for non-empty editor contents', (done) => {
      const editorValues = {
        main: 'main-value',
        renderer: 'renderer-value',
        html: 'html-value',
        preload: '',
        css: '/* Empty */',
      };

      app
        .replaceFiddle(editorValues, {
          gistId: 'gistId',
        })
        .then(() => {
          expect(app.state.setVisibleMosaics).toHaveBeenCalledWith([
            EditorId.main,
            EditorId.renderer,
            EditorId.html,
          ]);
          done();
        });
    });

    it('shows visible mosaics in the correct pre-defined order', (done) => {
      // this order is defined inside the replaceFiddle() function
      const editorValues = {
        css: 'css-value',
        html: 'html-value',
        renderer: 'renderer-value',
        main: 'main-value',
      };
      app
        .replaceFiddle(editorValues, {
          gistId: 'gistId',
        })
        .then(() => {
          expect(app.state.setVisibleMosaics).toHaveBeenCalledWith([
            EditorId.main,
            EditorId.renderer,
            EditorId.html,
            EditorId.css,
          ]);
          done();
        });
    });

    it('unsets state of previous source when called', (done) => {
      app.state.isUnsaved = true;
      app.state.localPath = '/fake/path';

      const editorValues = {
        html: 'html-value',
        main: 'main-value',
        renderer: 'renderer-value',
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

    it('marks the new Fiddle as Saved', (done) => {
      const editorValues = {
        html: 'html-value',
        main: 'main-value',
        renderer: 'renderer-value',
      };

      app
        .replaceFiddle(editorValues, {
          gistId: 'gistId',
          templateName: 'templateName',
          filePath: 'localPath',
        })
        .then(() => {
          expect(app.state.isUnsaved).toBe(false);
          done();
        });
    });

    describe('when current Fiddle is unsaved and prompt appears', () => {
      it('takes no action if prompt is rejected', (done) => {
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
        const app = new App();
        (app.state as Partial<AppState>) = new MockState();
        app.state.isUnsaved = true;
        app.state.setVisibleMosaics = jest.fn();
        app.state.setGenericDialogOptions = jest.fn();
        app.setEditorValues = jest.fn();

        const editorValues = {
          html: 'html-value',
          main: 'main-value',
          renderer: 'renderer-value',
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
      const app = new App();
      app.setEditorValues({
        html: 'html-value',
        main: 'main-value',
        renderer: 'renderer-value',
      });

      expect(
        (window as any).ElectronFiddle.editors.html.setValue,
      ).toHaveBeenCalledWith('html-value');
      expect(
        (window as any).ElectronFiddle.editors.main.setValue,
      ).toHaveBeenCalledWith('main-value');
      expect(
        (window as any).ElectronFiddle.editors.renderer.setValue,
      ).toHaveBeenCalledWith('renderer-value');
    });

    it('attempts to set values for closed editors', () => {
      const oldMainEditor = window.ElectronFiddle.editors.main;
      delete window.ElectronFiddle.editors.main;

      const app = new App();
      (app.state.closedPanels as any).main = {
        model: { setValue: jest.fn() },
      };
      app.state.closedPanels.preload = {};
      app.state.closedPanels.css = {};

      app.setEditorValues({
        html: 'html-value',
        main: 'main-value',
        renderer: 'renderer-value',
        preload: 'preload-value',
        css: 'css-value',
      });

      expect(
        (app.state.closedPanels.main as EditorBackup)!.model!.setValue,
      ).toHaveBeenCalledWith('main-value');
      expect(app.state.closedPanels.preload).toEqual({
        value: 'preload-value',
      });
      expect(app.state.closedPanels.css).toEqual({ value: 'css-value' });

      window.ElectronFiddle.editors.main = oldMainEditor;
    });

    it('throws if the Fiddle object is not present', async () => {
      (window as any).ElectronFiddle = null;

      const app = new App();
      let threw = false;
      try {
        await app.setEditorValues({ html: '', main: '', renderer: '' });
      } catch (error) {
        threw = true;
      }

      expect(threw).toBe(true);
    });

    it('does not set a value if none passed in', async () => {
      const app = new App();
      await app.setEditorValues({
        html: 'html-value',
        main: 'main-value',
      });

      expect(
        (window as any).ElectronFiddle.editors.renderer.setValue,
      ).not.toHaveBeenCalled();
    });
  });

  describe('setupResizeListener()', () => {
    it('attaches to the handler', () => {
      window.addEventListener = jest.fn();

      const app = new App();
      app.setupResizeListener();

      expect(window.addEventListener).toHaveBeenCalled();
      expect((window.addEventListener as jest.Mock).mock.calls[0][0]).toBe(
        'resize',
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
});
