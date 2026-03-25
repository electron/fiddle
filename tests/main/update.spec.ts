/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';

import { mockRequire } from '../utils.js';

vi.useFakeTimers();
vi.spyOn(global, 'setTimeout');

mockRequire('update-electron-app', { updateElectronApp: vi.fn() });

describe('update', async () => {
  const { setupUpdates } = await import('../../src/main/update.js');
  const { updateElectronApp } = require('update-electron-app');

  it('schedules an update check', async () => {
    setupUpdates();

    expect(setTimeout).toHaveBeenCalledTimes(1);
    vi.mocked(setTimeout).mock.calls[0][0]();
    expect(vi.mocked(updateElectronApp)).toHaveBeenCalled();
  });
});
