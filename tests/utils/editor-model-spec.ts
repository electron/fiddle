import { DefaultEditorId } from '../../src/interfaces';
import { getEditorModel } from '../../src/utils/editor-model';

describe('getEditorModel()', () => {
  it('returns the value for an editor', () => {
    expect(getEditorModel(DefaultEditorId.html)).toEqual({ testModel: true });
  });

  it('returns null if the editor does not exist', () => {
    const { ElectronFiddle: fiddle } = window as any;
    const oldEditor = fiddle.editors[DefaultEditorId.html];
    delete fiddle.editors[DefaultEditorId.html];

    expect(getEditorModel(DefaultEditorId.html)).toEqual(null);

    fiddle.editors[DefaultEditorId.html] = oldEditor;
  });

  it('returns null if window.Fiddle is not ready', () => {
    const { ElectronFiddle: fiddle } = window as any;
    (window as any).ElectronFiddle = undefined;

    expect(getEditorModel(DefaultEditorId.html)).toEqual(null);

    window.ElectronFiddle = fiddle;
  });
});
