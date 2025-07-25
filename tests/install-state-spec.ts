import { InstallState as FiddleCoreInstallState } from '@electron/fiddle-core';
import { describe, expect, it } from 'vitest';

import { InstallState } from '../src/interfaces';

describe('InstallState', () => {
  it('is in-sync with @electron/fiddle-core', async () => {
    expect(InstallState).toStrictEqual(FiddleCoreInstallState);
  });
});
