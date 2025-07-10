import { describe, expect, it, vi } from 'vitest';

import { getUsername } from '../../../src/main/utils/get-username';

vi.mock('node:os', () => ({
  userInfo: () => ({
    username: 'test-user',
  }),
}));

describe('get-username', () => {
  it('returns the OS username', () => {
    expect(getUsername()).toBe('test-user');
  });
});
