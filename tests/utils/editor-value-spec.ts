import { DefaultEditorId } from '../../src/interfaces';
import { getEditorValue } from '../../src/utils/editor-value';
import { AppMock, EditorMosaicMock, StateMock } from '../mocks/mocks';

describe('getEditorValue()', () => {
  const filename = DefaultEditorId.html;
  const value = 'editor-value';
  let app: AppMock;
  let state: StateMock;
  let editorMosaic: EditorMosaicMock;

  beforeEach(() => {
    ({ app } = (window as any).ElectronFiddle);
    ({ state } = app);
    ({ editorMosaic } = state);

    for (const editor of editorMosaic.editors.values()) {
      editor.getValue.mockReturnValue(value);
    }
  });

  it('returns the value for an editor if it exists', () => {
    expect(getEditorValue(filename)).toBe(value);
  });

  it('returns the value for the editor backup if it exists', () => {
    // set up mock state that has the editor deleted and a backup
    editorMosaic.editors.delete(filename);
    const value = 'editor-backup-value';
    state.closedPanels = { [filename]: { value } };

    expect(getEditorValue(filename)).toBe(value);
  });

  it('returns an empty string if the editor does not exist', () => {
    editorMosaic.editors.delete(filename);
    expect(getEditorValue(filename)).toBe('');
  });
});
