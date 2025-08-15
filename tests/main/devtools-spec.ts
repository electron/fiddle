/**
 * @vitest-environment node
 */
import { type Mock, beforeAll, describe, expect, it, vi } from 'vitest';

import { setupDevTools } from '../../src/main/devtools';
import { isDevMode } from '../../src/main/utils/devmode';

vi.mock('../../src/main/utils/devmode');

const installExtensionPromise = vi.hoisted(async () => {
  const { mockRequire } = await import('../utils.js');
  const installExtension = vi.fn();

  mockRequire('electron-devtools-installer', {
    default: installExtension,
    REACT_DEVELOPER_TOOLS: 'REACT_DEVELOPER_TOOLS',
    REACT_PERF: 'REACT_PERF',
  });

  return installExtension;
});

describe('devtools', () => {
  let installExtension: Mock;

  beforeAll(async () => {
    installExtension = await installExtensionPromise;
  });

  it('does not set up developer tools if not in dev mode', async () => {
    vi.mocked(isDevMode).mockReturnValue(false);
    await setupDevTools();

    expect(installExtension).toHaveBeenCalledTimes(0);
  });

  it('sets up developer tools if in dev mode', async () => {
    vi.mocked(isDevMode).mockReturnValue(true);
    await setupDevTools();

    expect(installExtension).toHaveBeenCalledTimes(1);
  });

  it('catch error in setting up developer tools', async () => {
    console.warn = vi.fn();
    const error = new Error('devtool error');

    // throw devtool error
    vi.mocked(installExtension).mockRejectedValue(error);
    vi.mocked(isDevMode).mockReturnValue(true);

    await setupDevTools();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(/installDevTools/),
      error,
    );
  });
});
