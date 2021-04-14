import { DefaultEditorId } from '../../src/interfaces';
import { updateEditorLayout } from '../../src/utils/editor-layout';
import { ElectronFiddleMock } from '../mocks/electron-fiddle';

describe('editor-layout', () => {
  beforeEach(() => {
    window.ElectronFiddle = new ElectronFiddleMock() as any;
  });

  it('updateEditorLayout calls layout() just once', (done) => {
    updateEditorLayout();
    updateEditorLayout();
    updateEditorLayout();
    updateEditorLayout();

    setTimeout(() => {
      const editors = window.ElectronFiddle.editors;

      expect(
        (editors[DefaultEditorId.main]!.layout as jest.Mock<any>).mock.calls,
      ).toHaveLength(1);
      expect(
        (editors[DefaultEditorId.html]!.layout as jest.Mock<any>).mock.calls,
      ).toHaveLength(1);
      expect(
        (editors[DefaultEditorId.renderer]!.layout as jest.Mock<any>).mock
          .calls,
      ).toHaveLength(1);

      done();
    }, 100);
  });
});
