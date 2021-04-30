import { DefaultEditorId } from '../../src/interfaces';
import { getEditorViewState } from '../../src/utils/editor-viewstate';
import { EditorMosaicMock } from '../mocks/mocks';

describe('getEditorViewState()', () => {
  const filename = DefaultEditorId.html;
  let editorMosaic: EditorMosaicMock;

  beforeEach(() => {
    ({ editorMosaic } = (window as any).ElectronFiddle.app.state);
  });

  it('returns the value for an editor', () => {
    const viewState = { testViewState: true };
    editorMosaic.editors
      .get(filename)!
      .saveViewState.mockReturnValue(viewState);
    expect(getEditorViewState(filename)).toBe(viewState);
  });

  it('returns null if the editor does not exist', () => {
    editorMosaic.editors.delete(filename);
    expect(getEditorViewState(filename)).toEqual(null);
  });

  it('throws if window.Fiddle is not ready', () => {
    (window as any).ElectronFiddle = undefined;
    expect(getEditorViewState(filename)).toBeNull();
  });
});
