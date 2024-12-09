import { mocked } from 'jest-mock';
import * as semver from 'semver';

import { EditorValues, MAIN_JS, SetFiddleOptions } from '../../src/interfaces';
import { App } from '../../src/renderer/app';
import { EditorMosaic, EditorPresence } from '../../src/renderer/editor-mosaic';
import { defaultDark, defaultLight } from '../../src/themes-defaults';
import { createEditorValues } from '../mocks/mocks';
import { waitFor } from '../utils';

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

describe('App component', () => {
  let app: App;

  beforeAll(() => {
    document.body.innerHTML = '<div id="app" />';
  });

  beforeEach(() => {
    mocked(window.ElectronFiddle.getTemplate).mockResolvedValue({
      [MAIN_JS]: '// content',
    });
    mocked(window.ElectronFiddle.readThemeFile).mockResolvedValue(defaultDark);
    mocked(window.ElectronFiddle.getReleasedVersions).mockReturnValue([]);
    mocked(window.ElectronFiddle.getLatestStable).mockReturnValue(
      semver.parse('24.0.0')!,
    );

    const { app: appMock } = window;
    const { electronTypes, fileManager, remoteLoader, runner, state } = appMock;
    app = new App();
    jest.spyOn(app.state, 'downloadVersion').mockResolvedValue(undefined);
    Object.assign(app, {
      electronTypes,
      fileManager,
      remoteLoader,
      runner,
      state,
    });
    window.app = app;

    state.editorMosaic.set({ [MAIN_JS]: '// content' });
    state.editorMosaic.files.set(MAIN_JS, EditorPresence.Pending);
  });

  describe('setup()', () => {
    it('renders the app', async () => {
      jest.useFakeTimers();

      const result = (await app.setup()) as HTMLDivElement;
      jest.runAllTimers();

      expect(result.innerHTML).toBe('Header;OutputEditorsWrapper;Dialogs;');

      jest.useRealTimers();
    });

    it('updates electronTypes when state.version changes', async () => {
      const { state } = app;

      // test that electronTypes is set during app.setup
      const spy = jest.spyOn(app.electronTypes, 'setVersion');
      await app.setup();
      expect(spy).toHaveBeenLastCalledWith(state.currentElectronVersion);
      expect(spy).toHaveBeenCalledTimes(1);

      // set up the next test: change state.version to a different version
      const version = Object.values(state.versions).shift()!;
      expect(state.currentElectronVersion).not.toStrictEqual(version);
      await state.setVersion(version.version);
      expect(state.currentElectronVersion).toStrictEqual(version);
      // test that electronTypes was updated when state.version changed
      expect(spy).toHaveBeenLastCalledWith(state.currentElectronVersion);
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  describe('openFiddle()', () => {
    it('understands gists', async () => {
      const { fetchGistAndLoad } = app.remoteLoader;
      mocked(fetchGistAndLoad).mockResolvedValue(true);

      const gistId = '8c5fc0c6a5153d49b5a4a56d3ed9da8f';
      await app.openFiddle({ gistId });
      expect(fetchGistAndLoad).toHaveBeenCalledWith(gistId);
    });

    it('understands files', async () => {
      const { openFiddle } = app.fileManager;
      mocked(openFiddle).mockResolvedValueOnce(undefined);

      const filePath = '/fake/path';
      const files = { [MAIN_JS]: 'foo' };
      await app.openFiddle({ localFiddle: { filePath, files } });
      expect(openFiddle).toHaveBeenCalledWith(filePath, files);
    });
  });

  describe('getEditorValues()', () => {
    it('gets values', async () => {
      const values = createEditorValues();
      jest.spyOn(app.state.editorMosaic, 'values').mockReturnValue(values);
      const b = await app.getEditorValues({});
      expect(b).toStrictEqual(values);
    });
  });

  describe('replaceFiddle()', () => {
    let editorValues: EditorValues;

    beforeEach(() => {
      editorValues = createEditorValues();
    });

    it('sets editor values and source info', async () => {
      const filePath = '/dev/urandom';
      const gistId = '129fe1ed16f97c5b65e86795c7aa9762';
      const templateName = 'clipboard';
      await app.replaceFiddle(editorValues, {
        localFiddle: { filePath, files: {} },
        templateName,
        gistId,
      });

      expect(app.state.gistId).toBe(gistId);
      expect(app.state.templateName).toBe(templateName);
      expect(app.state.localPath).toBe(filePath);
      expect(app.state.editorMosaic.isEdited).toBe(false);
    });

    it.each([
      { gistId: 'ed44613269be4b1eff79' },
      { localFiddle: { filePath: '/etc/passwd', files: {} } },
      { templateName: 'clipboard' },
    ])(
      'updates appState when called with %o',
      async (opts: SetFiddleOptions) => {
        await app.replaceFiddle(editorValues, opts);
        const { state } = app;
        expect(Boolean(state.gistId)).toBe(Boolean(opts.gistId));
        expect(Boolean(state.templateName)).toBe(Boolean(opts.templateName));
        expect(Boolean(state.localPath)).toBe(
          Boolean(opts.localFiddle?.filePath),
        );
      },
    );

    describe('prompting to confirm replacing an unsaved fiddle', () => {
      // make a second fiddle that differs from the first
      const editorValues2: EditorValues = { [MAIN_JS]: '// hello world' };

      async function testDialog(
        confirm: boolean,
        expectedValues: EditorValues,
      ) {
        // load up a fiddle...
        const localPath = '/etc/passwd';
        const gistId = '2c24ecd147c9c28c9b2d0cf738d4993a';
        await app.replaceFiddle(editorValues, {
          localFiddle: { filePath: localPath, files: {} },
        });
        expect(app.state.gistId).toBeFalsy();
        expect(app.state.localPath).toBe(localPath);

        // ...mark it as edited so a confirm dialog will appear before replacing
        app.state.editorMosaic.isEdited = true;
        app.state.showConfirmDialog = jest.fn().mockResolvedValue(confirm);

        // now try to replace
        await app.replaceFiddle(editorValues2, { gistId });
        expect(app.state.showConfirmDialog).toHaveBeenCalled();
        expect(await app.getEditorValues()).toStrictEqual(expectedValues);
      }

      it('does not replace the fiddle if not confirmed', async () => {
        await testDialog(false, editorValues);
      });

      it('replaces the fiddle if confirmed', async () => {
        await testDialog(true, editorValues2);
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
      window.app.state.isUsingSystemTheme = true;

      mocked(window.matchMedia).mockReturnValueOnce({
        matches: true,
      } as MediaQueryList);

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
      mocked(window.ElectronFiddle.readThemeFile).mockResolvedValue(
        defaultLight,
      );
      document.body.classList.add('bp3-dark');

      await app.loadTheme('defaultLight');

      expect(document.body.classList.value).toBe('');
    });

    it('adds the dark theme option if required', async () => {
      await app.loadTheme('custom-dark');

      expect(document.body.classList.value).toBe('bp3-dark');
    });

    it('sets native theme', async () => {
      app.state.isUsingSystemTheme = false;

      mocked(window.ElectronFiddle.readThemeFile).mockResolvedValue(
        defaultLight,
      );
      await app.loadTheme('defaultLight');
      expect(window.ElectronFiddle.setNativeTheme).toHaveBeenCalledWith(
        'light',
      );

      mocked(window.ElectronFiddle.readThemeFile).mockResolvedValue(
        defaultDark,
      );
      await app.loadTheme('custom-dark');
      expect(window.ElectronFiddle.setNativeTheme).toHaveBeenCalledWith('dark');
    });
  });

  describe('setupThemeListeners()', () => {
    describe('isUsingSystemTheme reaction', () => {
      beforeEach(() => {
        window.ElectronFiddle.setNativeTheme = jest.fn();
      });

      it('loads the set theme when not isUsingSystemTheme', () => {
        const spy = jest.spyOn(app, 'loadTheme');
        app.state.theme = 'defaultDark';
        app.state.isUsingSystemTheme = true;
        app.setupThemeListeners();
        app.state.isUsingSystemTheme = false;
        expect(spy).toHaveBeenCalledWith(defaultDark.file);
      });

      it('loads theme according to system when isUsingSystemTheme', () => {
        const spy = jest.spyOn(app, 'loadTheme');
        app.setupThemeListeners();

        // isUsingSystemTheme and prefersDark
        app.state.isUsingSystemTheme = false;
        mocked(window.matchMedia).mockReturnValue({
          matches: true,
        } as MediaQueryList);
        app.state.isUsingSystemTheme = true;
        expect(spy).toHaveBeenLastCalledWith(defaultDark.file);

        // isUsingSystemTheme and not prefersDark
        app.state.isUsingSystemTheme = false;
        mocked(window.matchMedia).mockReturnValue({
          matches: false,
        } as MediaQueryList);
        app.state.isUsingSystemTheme = true;
        expect(spy).toHaveBeenLastCalledWith(defaultLight.file);
      });

      it('sets native theme to system', () => {
        app.state.isUsingSystemTheme = false;
        app.setupThemeListeners();
        app.state.isUsingSystemTheme = true;

        expect(window.ElectronFiddle.setNativeTheme).toHaveBeenCalledWith(
          'system',
        );
      });
    });

    describe('prefers-color-scheme event listener', () => {
      it('adds an event listener to the "change" event', () => {
        const spy = jest.spyOn(window, 'matchMedia');
        app.setupThemeListeners();
        const { addEventListener } = spy.mock.results[0].value;
        expect(addEventListener).toHaveBeenCalledWith(
          'change',
          expect.anything(),
        );
      });

      it('does nothing if not isUsingSystemTheme', () => {
        const matchMediaSpy = jest.spyOn(window, 'matchMedia');
        app.setupThemeListeners();
        const { addEventListener } = matchMediaSpy.mock.results[0].value;
        const callback = addEventListener.mock.calls[0][1];
        app.state.isUsingSystemTheme = false;
        const loadThemeSpy = jest.spyOn(app, 'loadTheme');
        callback({ matches: true });
        expect(loadThemeSpy).not.toHaveBeenCalled();
      });

      it('sets dark theme if isUsingSystemTheme and prefers dark', () => {
        const matchMediaSpy = jest.spyOn(window, 'matchMedia');
        app.setupThemeListeners();
        const { addEventListener } = matchMediaSpy.mock.results[0].value;
        const callback = addEventListener.mock.calls[0][1];
        app.state.isUsingSystemTheme = true;
        const loadThemeSpy = jest.spyOn(app, 'loadTheme');
        callback({ matches: true });
        expect(loadThemeSpy).toHaveBeenCalledWith(defaultDark.file);
      });

      it('sets light theme if isUsingSystemTheme and not prefers dark', () => {
        const matchMediaSpy = jest.spyOn(window, 'matchMedia');
        app.setupThemeListeners();
        const { addEventListener } = matchMediaSpy.mock.results[0].value;
        const callback = addEventListener.mock.calls[0][1];
        app.state.isUsingSystemTheme = true;
        const loadThemeSpy = jest.spyOn(app, 'loadTheme');
        callback({ matches: false });
        expect(loadThemeSpy).toHaveBeenCalledWith(defaultLight.file);
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
    const editorValues2: EditorValues = { [MAIN_JS]: '// hello world' };
    let editorMosaic: EditorMosaic;

    beforeEach(() => {
      ({ editorMosaic } = app.state);
    });

    async function testDialog(confirm: boolean) {
      const localPath = '/etc/passwd';
      const gistId = '2c24ecd147c9c28c9b2d0cf738d4993a';

      // load up a fiddle...
      await app.replaceFiddle(editorValues, {
        localFiddle: { filePath: localPath, files: {} },
      });
      expect(app.state.gistId).toBeFalsy();
      expect(app.state.localPath).toBe(localPath);

      // ...mark it as edited so that trying a confirm dialog
      // will be triggered when we try to replace it
      editorMosaic.isEdited = true;

      // set up a reaction to confirm the replacement
      // when it happens
      app.state.showConfirmDialog = jest.fn().mockResolvedValueOnce(confirm);

      // now try to replace
      await app.replaceFiddle(editorValues2, { gistId });
      expect(app.state.showConfirmDialog).toHaveBeenCalled();
    }

    it('does not replace the fiddle if not confirmed', async () => {
      const setSpy = jest.spyOn(app.state.editorMosaic, 'set').mockReset();
      await testDialog(false);
      expect(setSpy).toHaveBeenCalledTimes(1);
    });

    it('replaces the fiddle if confirmed', async () => {
      const setSpy = jest.spyOn(app.state.editorMosaic, 'set').mockReset();
      await testDialog(true);
      expect(setSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('prompting to confirm exiting an unsaved fiddle', () => {
    beforeEach(() => {
      // setup: mock close & setNativeTheme
      window.close = jest.fn();
      window.ElectronFiddle.setNativeTheme = jest.fn();
      app.setupUnloadListeners();
    });

    it('can close the window if user accepts the dialog', async () => {
      app.state.showConfirmDialog = jest.fn().mockResolvedValueOnce(true);

      // expect the app to be watching for exit if the fiddle is edited
      app.state.editorMosaic.isEdited = true;
      expect(window.onbeforeunload).toBeTruthy();

      const e = {
        returnValue: Boolean,
      };
      window.onbeforeunload!(e as any);
      expect(e.returnValue).toBe(false);

      await waitFor(
        () => mocked(window.ElectronFiddle.showWindow).mock.calls.length > 0,
      );
      expect(window.close).toHaveBeenCalled();
    });

    it('can close the app after user accepts dialog', async () => {
      app.state.isQuitting = true;
      app.state.showConfirmDialog = jest.fn().mockResolvedValueOnce(true);

      // expect the app to be watching for exit if the fiddle is edited
      app.state.editorMosaic.isEdited = true;
      expect(window.onbeforeunload).toBeTruthy();

      const e = {
        returnValue: Boolean,
      };
      window.onbeforeunload!(e as any);
      expect(e.returnValue).toBe(false);

      await waitFor(
        () => mocked(window.ElectronFiddle.showWindow).mock.calls.length > 0,
      );
      expect(window.ElectronFiddle.confirmQuit).toHaveBeenCalled();
      expect(window.close).toHaveBeenCalledTimes(1);
    });

    it('does nothing if user cancels the dialog', async () => {
      app.state.isQuitting = true;
      app.state.showConfirmDialog = jest.fn().mockResolvedValueOnce(false);

      // expect the app to be watching for exit if the fiddle is edited
      app.state.editorMosaic.isEdited = true;
      expect(window.onbeforeunload).toBeTruthy();

      const e = {
        returnValue: Boolean,
      };
      window.onbeforeunload!(e as any);
      expect(e.returnValue).toBe(false);

      await waitFor(
        () => mocked(window.ElectronFiddle.showWindow).mock.calls.length > 0,
      );
      expect(window.close).not.toHaveBeenCalled();
      expect(!app.state.isQuitting);
    });
  });
});
