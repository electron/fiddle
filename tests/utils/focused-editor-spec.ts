import { getFocusedEditor } from '../../src/utils/focused-editor';
import { ElectronFiddleMock } from '../mocks/electron-fiddle';

describe('focused-editor', () => {
  beforeEach(() => {
    window.ElectronFiddle = new ElectronFiddleMock() as any;
  });

  it('getFocusedEditor() returns the focused editor', () => {
    (window.ElectronFiddle.editors['main.js']!
      .hasTextFocus as jest.Mock<any>).mockReturnValue(true);
    expect((getFocusedEditor() as any).name).toBe('main.js');
  });

  it('getFocusedEditor() returns the focused editor', () => {
    (window.ElectronFiddle.editors['renderer.js']!
      .hasTextFocus as jest.Mock<any>).mockReturnValue(true);
    expect((getFocusedEditor() as any).name).toBe('renderer.js');
  });

  it('getFocusedEditor() returns null if the editor does not exist', () => {
    expect(getFocusedEditor() as any).toBe(null);
  });
});
