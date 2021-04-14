import { DefaultEditorId } from '../../src/interfaces';
import { getEditorViewState } from '../../src/utils/editor-viewstate';

describe('getEditorViewState()', () => {
  it('returns the value for an editor', () => {
    expect(getEditorViewState(DefaultEditorId.html)).toEqual({
      testViewState: true,
    });
  });

  it('returns null if the editor does not exist', () => {
    const { ElectronFiddle: fiddle } = window as any;
    const oldEditor = fiddle.editors[DefaultEditorId.html];
    delete fiddle.editors[DefaultEditorId.html];

    expect(getEditorViewState(DefaultEditorId.html)).toEqual(null);

    fiddle.editors[DefaultEditorId.html] = oldEditor;
  });

  it('throws if window.Fiddle is not ready', () => {
    const { ElectronFiddle: fiddle } = window as any;
    (window as any).ElectronFiddle = undefined;

    expect(getEditorViewState(DefaultEditorId.html)).toBeNull();

    window.ElectronFiddle = fiddle;
  });
});
