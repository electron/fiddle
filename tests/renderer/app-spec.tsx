import { App } from '../../src/renderer/app';
import { AppState } from '../../src/renderer/state';
import { EditorBackup } from '../../src/utils/editor-backup';
import { ElectronFiddleMock } from '../mocks/electron-fiddle';
import { MockState } from '../mocks/state';
import { overridePlatform, resetPlatform } from '../utils';

jest.mock('../../src/renderer/file-manager', () =>
  require('../mocks/file-manager')
);
jest.mock('../../src/renderer/state', () => ({
  appState: {
    theme: 'defaultDark',
    getName: () => 'Test',
    closedPanels: {}
  }
}));
jest.mock('../../src/renderer/components/header', () => ({
  Header: () => 'Header;'
}));
jest.mock('../../src/renderer/components/dialogs', () => ({
  Dialogs: () => 'Dialogs;'
}));
jest.mock('../../src/renderer/components/output-editors-wrapper', () => ({
  OutputEditorsWrapper: () => 'OutputEditorsWrapper;'
}));

describe('Editors component', () => {
  beforeEach(() => {
    (window as any).ElectronFiddle = new ElectronFiddleMock();
  });

  describe('setup()', () => {
    it('renders the app', async () => {
      document.body.innerHTML = '<div id="app" />';
      jest.useFakeTimers();

      const app = new App();
      const result = (await app.setup()) as HTMLDivElement;
      app.setupUnsavedOnChangeListener = jest.fn();
      jest.runAllTimers();

      expect(result.innerHTML).toBe('Dialogs;Header;OutputEditorsWrapper;');
      expect(app.setupUnsavedOnChangeListener).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('creates a touch bar manager on macOS', () => {
      overridePlatform('darwin');

      const app = new App();
      expect(app.touchBarManager).toBeTruthy();

      resetPlatform();
    });

    it('does not create a touch bar manager on Windows and Linux', () => {
      overridePlatform('win32');
      expect(new App().touchBarManager).toBeFalsy();

      overridePlatform('linux');
      expect(new App().touchBarManager).toBeFalsy();

      resetPlatform();
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
    it('sets editor values and source info', (done) => {
      const app = new App();
      (app.state as Partial<AppState>) = new MockState();
      app.state.isUnsaved = false;
      app.setEditorValues = jest.fn();

      const editorValues = {
        html: 'html-value',
        main: 'main-value',
        renderer: 'renderer-value',
        preload: ''
      };

      app.replaceFiddle(editorValues, {
        gistId: 'gistId',
        templateName: 'templateName',
        filePath: 'localPath'
      })
        .then(() => {
          expect(app.setEditorValues).toHaveBeenCalledWith(editorValues);
          expect(app.state.gistId).toBe('gistId');
          expect(app.state.templateName).toBe('templateName');
          expect(app.state.localPath).toBe('localPath');
          done();
        });
    });

    it('unsets state of previous source when called', (done) => {
      const app = new App();
      (app.state as Partial<AppState>) = new MockState();
      app.state.isUnsaved = true;
      app.state.localPath = '/fake/path';
      app.state.setWarningDialogTexts = jest.fn();
      app.setEditorValues = jest.fn();

      const editorValues = {
        html: 'html-value',
        main: 'main-value',
        renderer: 'renderer-value'
      };

      expect(app.state.localPath).toBe('/fake/path');

      app.replaceFiddle(editorValues, {
        gistId: 'gistId',
      })
        .then(() => {
          expect(app.state.localPath).toBeUndefined();
          done();
        });

      setTimeout(() => {
        expect(app.state.isWarningDialogShowing).toBe(true);
        app.state.warningDialogLastResult = true;
        app.state.isWarningDialogShowing = false;
      });
    });

    it('marks the new Fiddle as Saved', (done) => {
      const app = new App();
      (app.state as Partial<AppState>) = new MockState();
      app.state.isUnsaved = false;
      app.setupUnsavedOnChangeListener = jest.fn();
      app.setEditorValues = jest.fn();

      const editorValues = {
        html: 'html-value',
        main: 'main-value',
        renderer: 'renderer-value'
      };

      app.replaceFiddle(editorValues, {
        gistId: 'gistId',
        templateName: 'templateName',
        filePath: 'localPath'
      })
        .then(() => {
          expect(app.state.isUnsaved).toBe(false);
          expect(app.setupUnsavedOnChangeListener).toHaveBeenCalled();
          done();
        });
    });
    describe('when current Fiddle is unsaved and prompt appears', () => {
      it('takes no action if prompt is rejected', (done) => {
        const app = new App();
        (app.state as Partial<AppState>) = new MockState();
        app.state.isUnsaved = true;
        app.state.setWarningDialogTexts = jest.fn();
        app.setEditorValues = jest.fn();

        expect(app.state.localPath).toBeUndefined();
        expect(app.state.gistId).toBe('');
        expect(app.state.templateName).toBeUndefined();

        app.replaceFiddle({}, {
          gistId: 'gistId',
          templateName: 'templateName',
          filePath: 'localPath'
        })
          .then(() => {
            expect(app.setEditorValues).not.toHaveBeenCalled();
            expect(app.state.localPath).toBeUndefined();
            expect(app.state.gistId).toBe('');
            expect(app.state.templateName).toBeUndefined();
            done();
          });

        setTimeout(() => {
          expect(app.state.isWarningDialogShowing).toBe(true);
          app.state.warningDialogLastResult = false;
          app.state.isWarningDialogShowing = false;
        });
      });

      it('sets editor values and source info if prompt is accepted', (done) => {
        const app = new App();
        (app.state as Partial<AppState>) = new MockState();
        app.state.isUnsaved = true;
        app.state.setWarningDialogTexts = jest.fn();
        app.setEditorValues = jest.fn();

        const editorValues = {
          html: 'html-value',
          main: 'main-value',
          renderer: 'renderer-value'
        };

        app.replaceFiddle(editorValues, {
          gistId: 'gistId',
          templateName: 'templateName',
          filePath: 'localPath'
        })
          .then(() => {
            expect(app.setEditorValues).toHaveBeenCalledWith(editorValues);
            expect(app.state.gistId).toBe('gistId');
            expect(app.state.templateName).toBe('templateName');
            expect(app.state.localPath).toBe('localPath');
            done();
          });

        setTimeout(() => {
          expect(app.state.isWarningDialogShowing).toBe(true);
          app.state.warningDialogLastResult = true;
          app.state.isWarningDialogShowing = false;
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
        renderer: 'renderer-value'
      });

      expect(
        (window as any).ElectronFiddle.editors.html.setValue
      ).toHaveBeenCalledWith('html-value');
      expect(
        (window as any).ElectronFiddle.editors.main.setValue
      ).toHaveBeenCalledWith('main-value');
      expect(
        (window as any).ElectronFiddle.editors.renderer.setValue
      ).toHaveBeenCalledWith('renderer-value');
    });

    it('attempts to set values for closed editors', () => {
      const oldMainEditor = window.ElectronFiddle.editors.main;
      delete window.ElectronFiddle.editors.main;

      const app = new App();
      (app.state.closedPanels as any).main = { model: { setValue: jest.fn() } };
      app.setEditorValues({
        html: 'html-value',
        main: 'main-value',
        renderer: 'renderer-value',
      });

      expect(
        (app.state.closedPanels.main as EditorBackup)!.model!.setValue
      ).toHaveBeenCalledWith('main-value');

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
        main: 'main-value'
      });

      expect(
        (window as any).ElectronFiddle.editors.renderer.setValue
      ).not.toHaveBeenCalled();
    });
  });

  describe('setupUnsavedOnChangeListener()', () => {
    it('listens for model change events', async () => {
      const app = new App();

      app.setupUnsavedOnChangeListener();

      const fn = window.ElectronFiddle.editors!.renderer!
        .onDidChangeModelContent;
      const call = (fn as jest.Mock<any>).mock.calls[0];
      const cb = call[0];

      cb();

      expect(app.state.isUnsaved).toBe(true);
    });
  });

  describe('setupResizeListener()', () => {
    it('attaches to the handler', () => {
      window.addEventListener = jest.fn();

      const app = new App();
      app.setupResizeListener();

      expect(window.addEventListener).toHaveBeenCalled();
      expect((window.addEventListener as jest.Mock).mock.calls[0][0]).toBe(
        'resize'
      );
    });
  });

  describe('setupTheme()', () => {
    it(`adds the current theme's css to the document`, async () => {
      document.head!.innerHTML = "<style id='fiddle-theme'></style>";

      const app = new App();
      await app.setupTheme();

      expect(document.head!.innerHTML).toEqual(
        // tslint:disable:max-line-length
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
        </style>`.replace(/        /gm, '')
      );
      // tslint:enable:max-line-length
    });

    it('removes the dark theme option if required', async () => {
      document.body.classList.add('bp3-dark');

      const app = new App();
      app.state.theme = 'defaultLight';

      await app.setupTheme();

      expect(document.body.classList.value).toBe('');
    });

    it('adds the dark theme option if required', async () => {
      const app = new App();
      app.state.theme = 'custom-dark';

      await app.setupTheme();

      expect(document.body.classList.value).toBe('bp3-dark');
    });
  });
});
