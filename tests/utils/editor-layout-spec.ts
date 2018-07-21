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
      const { main, html, renderer } = window.ElectronFiddle.editors;
      expect(main.layout.mock.calls).toHaveLength(1);
      expect(html.layout.mock.calls).toHaveLength(1);
      expect(renderer.layout.mock.calls).toHaveLength(1);

      done();
    }, 100);
  });
});
