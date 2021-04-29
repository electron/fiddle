import { DefaultEditorId, MosaicId } from '../../src/interfaces';
import { getEditorValue } from '../../src/utils/editor-value';
import { StateMock } from '../mocks/state';

describe('getEditorValue()', () => {
  it('returns the value for an editor if it exists', () => {
    expect(getEditorValue(DefaultEditorId.html)).toBe('editor-value');
  });

  it('returns the value for the editor backup if it exists', () => {
    // set up mock state that has the editor deleted and a backup
    const oldEditor = window.ElectronFiddle.editors[DefaultEditorId.html];
    window.ElectronFiddle.editors[DefaultEditorId.html] = null;

    window.ElectronFiddle.app.state = new StateMock() as any;
    const mockState = window.ElectronFiddle.app.state;

    mockState.closedPanels = {
      [DefaultEditorId.html as MosaicId]: {
        value: 'editor-backup-value',
      },
    };

    // assert
    expect(getEditorValue(DefaultEditorId.html)).toBe('editor-backup-value');

    // revert to initial state
    window.ElectronFiddle.app.state = new StateMock() as any;
    window.ElectronFiddle.editors[DefaultEditorId.html] = oldEditor;
  });

  it('returns an empty string if window.Fiddle is not ready', () => {
    const oldFiddle = window.ElectronFiddle;
    (window as any).ElectronFiddle = undefined;

    expect(getEditorValue(DefaultEditorId.html)).toBe('');

    window.ElectronFiddle = oldFiddle;
  });

  it('returns an empty string if the editor does not exist', () => {
    const { ElectronFiddle: fiddle } = window as any;
    const oldEditor = fiddle.editors[DefaultEditorId.html];
    delete fiddle.editors[DefaultEditorId.html];

    expect(getEditorValue(DefaultEditorId.html)).toBe('');

    fiddle.editors[DefaultEditorId.html] = oldEditor;
  });
});
