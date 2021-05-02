import { waitForEditorsToMount } from '../../src/utils/editor-mounted';

import { DefaultEditorId } from '../../src/interfaces';

describe('waitforEditorsToMount', () => {
  it('resolves when editors match list', async () => {
    const { editorMosaic } = (window as any).ElectronFiddle.app.state;

    // these editors should be mounted by default.
    const files = [
      DefaultEditorId.html,
      DefaultEditorId.main,
      DefaultEditorId.preload,
      DefaultEditorId.renderer,
    ];
    await waitForEditorsToMount(files);

    files.every((file) => expect(editorMosaic.editors.has(file)).toBe(true));
  });

  it('rejects if editors fail to match list', async () => {
    try {
      // css editor shouldn't be mounted by default.
      await waitForEditorsToMount([DefaultEditorId.css]);
    } catch (error) {
      expect(error).toMatch('Timed out');
    }
  });
});
