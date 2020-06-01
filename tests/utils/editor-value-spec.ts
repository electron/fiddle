import { EditorId } from '../../src/interfaces';
import { getEditorValue } from '../../src/utils/editor-value';

describe('getEditorValue()', () => {
  it('returns the value for an editor', () => {
    expect(getEditorValue(EditorId.html)).toBe('editor-value');
  });

  it('returns an empty string if window.Fiddle is not ready', () => {
    const oldFiddle = window.ElectronFiddle;
    (window as any).ElectronFiddle = undefined;

    expect(getEditorValue(EditorId.html)).toBe('');

    window.ElectronFiddle = oldFiddle;
  });

  it('returns an empty string if the editor does not exist', () => {
    const { ElectronFiddle: fiddle } = window as any;
    const oldEditor = fiddle.editors[EditorId.html];
    delete fiddle.editors[EditorId.html];

    expect(getEditorValue(EditorId.html)).toBe('');

    fiddle.editors[EditorId.html] = oldEditor;
  });
});
