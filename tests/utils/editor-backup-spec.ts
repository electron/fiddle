import { DefaultEditorId } from '../../src/interfaces';
import { getEditorBackup } from '../../src/utils/editor-backup';

describe('getEditorBackup()', () => {
  const id = DefaultEditorId.html;

  it('returns the value for an editor', () => {
    expect(getEditorBackup(id)).toEqual({
      model: { testModel: true },
      value: 'editor-value',
      viewState: { testViewState: true },
    });
  });

  it('fails gracefully if the editor does not exist', () => {
    const { ElectronFiddle: fiddle } = window as any;

    const oldEditor = fiddle.editors[id];
    delete fiddle.editors[id];

    expect(getEditorBackup(id)).toEqual({
      model: null,
      value: '',
      viewState: null,
    });

    fiddle.editors[id] = oldEditor;
  });

  it('fails gracefully if window.Fiddle is not ready', () => {
    const { ElectronFiddle: fiddle } = window as any;
    (window as any).ElectronFiddle = undefined;

    expect(getEditorBackup(id)).toEqual({
      model: null,
      value: '',
      viewState: null,
    });

    window.ElectronFiddle = fiddle;
  });
});
