import { waitForEditorsToMount } from '../../src/utils/editor-mounted';

import { EditorId } from '../../src/interfaces';

describe('waitforEditorsToMount', () => {
  it('resolves when editors match list', async () => {
    // these editors should be mounted by default.
    const { ElectronFiddle: fiddle } = window as any;
    const ids = [
      EditorId.html,
      EditorId.main,
      EditorId.preload,
      EditorId.renderer,
    ];
    await waitForEditorsToMount(ids);
    for (const id of ids) {
      expect(fiddle.editors).toHaveProperty(id);
    }
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
