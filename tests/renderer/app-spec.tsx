import { reaction } from 'mobx';
import { App } from '../../src/renderer/app';
import { AppState } from '../../src/renderer/state';
import { EditorMosaic } from '../../src/renderer/editor-mosaic';
import { EditorValues } from '../../src/interfaces';
// import { EditorValues, MAIN_JS, PACKAGE_NAME } from '../../src/interfaces';
// import { defaultDark, defaultLight } from '../../src/renderer/themes-defaults';
// import { waitFor } from '../../src/utils/wait-for';

import { ElectronFiddleMock } from '../mocks/electron-fiddle';
import { MockState } from '../mocks/state';
import { createEditorValues } from '../mocks/editor-values';

jest.mock('fs-extra');
jest.mock('../../src/renderer/file-manager', () =>
  require('../mocks/file-manager'),
);
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
});
