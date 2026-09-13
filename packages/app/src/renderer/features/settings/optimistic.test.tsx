import { describe, expect, it } from 'vitest';

import { defaultSettings } from '../../../shared/settings';
import { outstanding, withPending, type PendingChange } from './optimistic';

describe('optimistic settings', () => {
  it('shows pending changes on top of the store, in order', () => {
    const pending: PendingChange[] = [
      { id: 1, key: 'packageManager', value: 'yarn' },
      { id: 2, key: 'showObsolete', value: true },
      { id: 3, key: 'packageManager', value: 'npm' },
    ];
    const shown = withPending(defaultSettings, pending, 0);
    expect(shown.packageManager).toBe('npm');
    expect(shown.showObsolete).toBe(true);
  });

  it('keeps a change until the store reaches its rev', () => {
    const pending: PendingChange[] = [{ id: 1, key: 'showObsolete', value: true, rev: 5 }];
    // A stale push (rev 4) doesn't overwrite the pending value.
    expect(withPending(defaultSettings, pending, 4).showObsolete).toBe(true);
    expect(outstanding(pending, 4)).toHaveLength(1);
    // Once the store includes it, the store value wins.
    expect(withPending(defaultSettings, pending, 5).showObsolete).toBe(false);
    expect(outstanding(pending, 5)).toEqual([]);
  });

  it('returns the store value itself when nothing is pending', () => {
    expect(withPending(defaultSettings, [], 3)).toBe(defaultSettings);
  });
});
