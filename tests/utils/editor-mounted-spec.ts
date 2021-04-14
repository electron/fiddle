import { waitForEditorsToMount } from '../../src/utils/editor-mounted';

import { DefaultEditorId } from '../../src/interfaces';

describe('waitforEditorsToMount', () => {
  it('resolves when editors match list', async () => {
    // these editors should be mounted by default.
    const { ElectronFiddle: fiddle } = window as any;
    const ids = [
      DefaultEditorId.html,
      DefaultEditorId.main,
      DefaultEditorId.preload,
      DefaultEditorId.renderer,
    ];
    await waitForEditorsToMount(ids);

    const editors = Object.getOwnPropertyNames(fiddle.editors);
    expect(editors.sort()).toEqual(ids.sort());
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
