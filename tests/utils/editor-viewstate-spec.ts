import { EditorId } from '../../src/interfaces';
import { getEditorViewState } from '../../src/utils/editor-viewstate';

describe('getEditorViewState()', () => {
  it('returns the value for an editor', () => {
    expect(getEditorViewState(EditorId.html)).toEqual({ testViewState: true });
  });

  it('returns null if the editor does not exist', () => {
    const { ElectronFiddle: fiddle } = window as any;
    const oldEditor = fiddle.editors[EditorId.html];
    delete fiddle.editors[EditorId.html];

    expect(getEditorViewState(EditorId.html)).toEqual(null);

    fiddle.editors[EditorId.html] = oldEditor;
  });

  it('throws if window.Fiddle is not ready', () => {
    const { ElectronFiddle: fiddle } = window as any;
    (window as any).ElectronFiddle = undefined;

    expect(() => getEditorViewState(EditorId.html)).toThrow('Fiddle not ready');

    window.ElectronFiddle = fiddle;
  });
});
