import { isJest } from '../../src/utils/is-jest';

describe('isJest', () => {
  it('always retrun true in test', () => {
    expect(isJest()).toBe(true);
  });
});
