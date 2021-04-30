import { DefaultEditorId } from '../../src/interfaces';
import { getEditorBackup } from '../../src/utils/editor-backup';
import { EditorMosaicMock } from '../mocks/mocks';

describe('getEditorBackup()', () => {
  let editorMosaic: EditorMosaicMock;

  beforeEach(() => {
    ({ editorMosaic } = (window as any).ElectronFiddle.app.state);
  });

  it('returns the value for an editor', () => {
    const filename = DefaultEditorId.html;
    const editor = editorMosaic.editors.get(filename);
    const model = { testModel: true };
    const viewState = { testViewState: true };
    const value = 'editor-value';

    (editor as any).model = model;
    editor!.saveViewState.mockReturnValue(viewState);
    editor!.value = value;

    expect(getEditorBackup(filename)).toEqual({ model, value, viewState });
  });
});
