import { MAIN_JS } from '../../src/interfaces';
import { getEditorBackup } from '../../src/utils/editor-backup';
import { EditorMosaicMock, MonacoEditorMock } from '../mocks/mocks';

describe('getEditorBackup()', () => {
  let editorMosaic: EditorMosaicMock;

  beforeEach(() => {
    ({ editorMosaic } = (window as any).ElectronFiddle.app.state);
  });

  it('returns the value for an editor', () => {
    const filename = MAIN_JS;
    const model = { testModel: true };
    const viewState = { testViewState: true };
    const value = 'editor-value';

    const editor = editorMosaic.editors.get(filename) as MonacoEditorMock;
    editor.model = model as any;
    editor.saveViewState.mockReturnValue(viewState);
    editor.value = value;

    expect(getEditorBackup(filename)).toEqual({ model, value, viewState });
  });
});
