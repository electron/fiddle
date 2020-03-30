import { EditorId } from '../../src/interfaces';
import { getEditorBackup } from '../../src/utils/editor-backup';

describe('getEditorBackup()', () => {
  it('returns the value for an editor', () => {
    expect(getEditorBackup(EditorId.html)).toEqual({
      value: 'editor-value',
      model: { testModel: true },
      viewState: { testViewState: true }
    });
  });
});
