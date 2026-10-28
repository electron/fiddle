import { describe, expect, it } from 'vitest';

import { autoBisect } from './auto';

const range = ['1.0.0', '2.0.0', '3.0.0', '4.0.0', '5.0.0'];

describe('autoBisect', () => {
  it('finds the last good and first bad version', async () => {
    const checked: string[] = [];
    const result = await autoBisect(range, async (version) => {
      checked.push(version);
      return version < '4.0.0';
    });
    expect(result).toEqual({ good: '3.0.0', bad: '4.0.0' });
    expect(checked.slice(0, 2)).toEqual(['1.0.0', '5.0.0']);
  });

  it('stops when an end gives the wrong result', async () => {
    expect(await autoBisect(range, async () => false)).toEqual({
      stopped: true,
      unexpected: '1.0.0',
    });
    expect(await autoBisect(range, async () => true)).toEqual({
      stopped: true,
      unexpected: '5.0.0',
    });
  });

  it('stops when a check is invalid', async () => {
    const result = await autoBisect(range, async (version) =>
      version === '3.0.0' ? undefined : version === '1.0.0',
    );
    expect(result).toEqual({ stopped: true });
  });
});
