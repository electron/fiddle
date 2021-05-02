import { updateEditorLayout } from '../../src/utils/editor-layout';
import { EditorMosaicMock } from '../mocks/mocks';

describe('editor-layout', () => {
  let editorMosaic: EditorMosaicMock;

  beforeEach(() => {
    ({ editorMosaic } = (window as any).ElectronFiddle.app.state);
  });

  it('updateEditorLayout calls layout() just once', (done) => {
    updateEditorLayout();
    updateEditorLayout();
    updateEditorLayout();
    updateEditorLayout();

    setTimeout(() => {
      for (const editor of editorMosaic.editors.values()) {
        expect(editor.layout).toHaveBeenCalledTimes(1);
      }
      done();
    }, 100);
  });
});
