import { EditorId } from '../../src/interfaces';
import { getEditorModel } from '../../src/utils/editor-model';

describe('getEditorModel()', () => {
  it('returns the value for an editor', () => {
    expect(getEditorModel(EditorId.html)).toEqual({ testModel: true });
  });

  it('returns null if the editor does not exist', () => {
    const { ElectronFiddle: fiddle } = window as any;
    const oldEditor = fiddle.editors[EditorId.html];
    delete fiddle.editors[EditorId.html];

    expect(getEditorModel(EditorId.html)).toEqual(null);

    fiddle.editors[EditorId.html] = oldEditor;
  });

  it('throws if window.Fiddle is not ready', () => {
    const { ElectronFiddle: fiddle } = window as any;
    (window as any).ElectronFiddle = undefined;

    expect(() => getEditorModel(EditorId.html)).toThrow('Fiddle not ready');

    window.ElectronFiddle = fiddle;
  });
});
