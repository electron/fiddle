import { DefaultEditorId } from '../../src/interfaces';
import { getFocusedEditor } from '../../src/utils/focused-editor';
import { EditorMock } from '../mocks/editors';
import { ElectronFiddleMock } from '../mocks/electron-fiddle';

describe('focused-editor', () => {
  beforeEach(() => {
    window.ElectronFiddle = new ElectronFiddleMock() as any;
  });

  it('getFocusedEditor() returns the focused editor when it is main.js', () => {
    (window.ElectronFiddle.editors[DefaultEditorId.main]!
      .hasTextFocus as jest.Mock<any>).mockReturnValue(true);
    expect((getFocusedEditor() as any).name).toBe(DefaultEditorId.main);
  });

  it('getFocusedEditor() returns the focused editor when it is preload.js', () => {
    (window.ElectronFiddle.editors[DefaultEditorId.preload]!
      .hasTextFocus as jest.Mock<any>).mockReturnValue(true);
    expect((getFocusedEditor() as any).name).toBe(DefaultEditorId.preload);
  });

  it('getFocusedEditor() returns the focused editor when it is index.html', () => {
    (window.ElectronFiddle.editors[DefaultEditorId.html]!
      .hasTextFocus as jest.Mock<any>).mockReturnValue(true);
    expect((getFocusedEditor() as any).name).toBe(DefaultEditorId.html);
  });

  it('getFocusedEditor() returns the focused editor when it is renderer.js', () => {
    (window.ElectronFiddle.editors[DefaultEditorId.renderer]!
      .hasTextFocus as jest.Mock<any>).mockReturnValue(true);
    expect((getFocusedEditor() as any).name).toBe(DefaultEditorId.renderer);
  });

  it('getFocusedEditor() returns the focused editor when it is custom', () => {
    const file = new EditorMock('file.js');
    window.ElectronFiddle.editors['file.js'] = file;

    (window.ElectronFiddle.editors['file.js']!
      .hasTextFocus as jest.Mock<any>).mockReturnValue(true);
    expect((getFocusedEditor() as any).name).toBe('file.js');
  });

  it('getFocusedEditor() returns null if the editor does not exist', () => {
    expect(getFocusedEditor() as any).toBe(null);
  });
});
