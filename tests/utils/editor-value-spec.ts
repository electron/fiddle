import { EditorId } from '../../src/interfaces';
import { getEditorValue } from '../../src/utils/editor-value';
import { MockState } from '../mocks/state';

describe('getEditorValue()', () => {
  it('returns the value for an editor if it exists', () => {
    expect(getEditorValue(EditorId.html)).toBe('editor-value');
  });

  it('returns the value for the editor backup if it exists', () => {
    // set up mock state that has the editor deleted and a backup
    const oldEditor = window.ElectronFiddle.editors[EditorId.html];
    window.ElectronFiddle.editors[EditorId.html] = null;

    window.ElectronFiddle.app.state = new MockState() as any;
    const mockState = window.ElectronFiddle.app.state;

    mockState.closedPanels = {
      [EditorId.html]: {
        value: 'editor-backup-value',
      },
    };

    // assert
    expect(getEditorValue(EditorId.html)).toBe('editor-backup-value');

    // revert to initial state
    window.ElectronFiddle.app.state = new MockState() as any;
    window.ElectronFiddle.editors[EditorId.html] = oldEditor;
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
