import { DefaultEditorId } from '../../src/interfaces';
import { getEditorModel } from '../../src/utils/editor-model';
import { EditorMosaicMock } from '../mocks/editor-mosaic';

describe('getEditorModel()', () => {
  const filename = DefaultEditorId.html;
  let editorMosaic: EditorMosaicMock;

  beforeEach(() => {
    ({ editorMosaic } = (window as any).ElectronFiddle.app.state);
  });

  it('returns the value for an editor', () => {
    const model = { testModel: true };
    const editor = editorMosaic.editors.get(filename);
    editor!.getModel.mockReturnValue(model);

    expect(getEditorModel(filename)).toBe(model);
  });

  it('returns null if the editor does not exist', () => {
    editorMosaic.editors.delete(filename);
    expect(getEditorModel(filename)).toBeNull();
  });

  it('returns null if window.Fiddle is not ready', () => {
    (window as any).ElectronFiddle = undefined;
    expect(getEditorModel(filename)).toBeNull();
  });
});
