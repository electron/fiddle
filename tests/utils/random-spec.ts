import { getRandomNumber } from '../../src/utils/random';

describe('random', () => {
  it('returns a random number', () => {
    const min = 1;
    const max = 999999;
    const a = getRandomNumber(min, max);
    const b = getRandomNumber(min, max);

    expect(a).toBeLessThanOrEqual(max);
    expect(b).toBeLessThanOrEqual(max);
    expect(a).toBeGreaterThanOrEqual(min);
    expect(b).toBeGreaterThanOrEqual(min);
    expect(a === b).toBe(false);
  });

  it('handles no input', () => {
    const result = getRandomNumber();
    expect(result === 0 || result === 1).toBeTruthy();
  });
});
