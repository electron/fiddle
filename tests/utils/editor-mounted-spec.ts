import { waitForEditorsToMount } from '../../src/utils/editor-mounted';

import { EditorId } from '../../src/interfaces';

describe('waitforEditorsToMount', () => {
  it('resolves when editors match list', async () => {
    // these editors should be mounted by default.
    const { ElectronFiddle: fiddle } = window as any;
    await waitForEditorsToMount([
      EditorId.html,
      EditorId.main,
      EditorId.renderer,
    ]);
    expect(fiddle.editors).toHaveProperty(EditorId.html);
    expect(fiddle.editors).toHaveProperty(EditorId.main);
    expect(fiddle.editors).toHaveProperty(EditorId.renderer);
  });

  it('rejects if editors fail to match list', async () => {
    try {
      // css editor shouldn't be mounted by default.
      await waitForEditorsToMount([EditorId.css]);
    } catch (error) {
      expect(error).toMatch('Timed out');
    }
  });
});
