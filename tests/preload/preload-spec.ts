/**
 * @jest-environment node
 */

import { setupFiddleGlobal } from '../../src/preload/preload';

describe('preload', () => {
  // We instantiate this in `tests/setup.js` for the main and
  // renderer processes, but we don't need these mocks since
  // these things are being instantiated within the preload
  beforeEach(() => {
    delete (window as any).ElectronFiddle;
  });

  describe('setupGlobalWindow()', () => {
    it('sets up a window.ElectronFiddle object', async () => {
      await setupFiddleGlobal();

      expect(window.ElectronFiddle).toMatchObject({ app: null });
    });
  });
});
