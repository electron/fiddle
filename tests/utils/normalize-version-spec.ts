import { normalizeVersion } from '../../src/utils/normalize-version';

describe('normalize-version', () => {
  it('normalizes a version with a leading v', () => {
    expect(normalizeVersion('v3.0.0')).toBe('3.0.0');
  });

  it('normalizes a version without a leading v', () => {
    expect(normalizeVersion('3.0.0')).toBe('3.0.0');
  });
});
