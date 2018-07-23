import { sortButtons } from '../../src/utils/sort-buttons';
import { overridePlatform, resetPlatform } from '../utils';

describe('sort-buttons', () => {
  afterEach(() => {
    resetPlatform();
  });

  it('sorts an array on Windows', () => {
    overridePlatform('win32');

    const result = sortButtons([ { type: 'close' }, { type: 'confirm' } ] as any);
    expect(result[0]).toEqual({ type: 'close' });
  });

  it('sorts an array on Linux', () => {
    overridePlatform('linux');

    const result = sortButtons([ { type: 'close' }, { type: 'confirm' } ] as any);
    expect(result[0]).toEqual({ type: 'close' });
  });

  it('sorts an array on macOS', () => {
    overridePlatform('darwin');

    const result = sortButtons([ { type: 'close' }, { type: 'confirm' } ] as any);
    expect(result[0]).toEqual({ type: 'confirm' });
  });
});
