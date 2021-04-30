import { DefaultEditorId, EditorId } from '../../src/interfaces';
import { getFocusedEditor } from '../../src/utils/focused-editor';
import { EditorMosaicMock, MonacoEditorMock } from '../mocks/mocks';

describe('focused-editor', () => {
  let editorMosaic: EditorMosaicMock;

  beforeEach(() => {
    ({ editorMosaic } = (window as any).ElectronFiddle.app.state);
  });

  function setFocus(editor?: MonacoEditorMock) {
    for (const e of editorMosaic.editors.values()) {
      e.hasTextFocus.mockReturnValue(e === editor);
    }
  }

  function expectCanFocus(name: EditorId) {
    const editor = editorMosaic.editors.get(name);
    setFocus(editor);
    expect(getFocusedEditor()).toBe(editor);
  }

  it('getFocusedEditor() returns the focused editor when it is main.js', () => {
    expectCanFocus(DefaultEditorId.main);
  });

  it('getFocusedEditor() returns the focused editor when it is preload.js', () => {
    expectCanFocus(DefaultEditorId.preload);
  });

  it('getFocusedEditor() returns the focused editor when it is index.html', () => {
    expectCanFocus(DefaultEditorId.html);
  });

  it('getFocusedEditor() returns the focused editor when it is renderer.js', () => {
    expectCanFocus(DefaultEditorId.renderer);
  });

  it('getFocusedEditor() returns the focused editor when it is custom', () => {
    const file = 'file.js';
    const editor = new MonacoEditorMock();
    editorMosaic.editors.set(file, editor);
    expectCanFocus(file);
  });

  it('getFocusedEditor() returns null if the editor does not exist', () => {
    setFocus(undefined);
    expect(getFocusedEditor()).toBe(null);
  });
});
