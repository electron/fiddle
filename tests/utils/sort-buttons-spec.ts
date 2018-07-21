import { sortButtons } from '../../src/utils/sort-buttons';

describe('sort-buttons', () => {
  const platform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: platform,
      writable: true
    });
  });

  it('sorts an array on Windows', () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32'
    });

    const result = sortButtons([ { type: 'close' }, { type: 'confirm' } ] as any);
    expect(result[0]).toEqual({ type: 'close' });
  });

  it('sorts an array on Linux', () => {
    Object.defineProperty(process, 'platform', {
      value: 'linux'
    });

    const result = sortButtons([ { type: 'close' }, { type: 'confirm' } ] as any);
    expect(result[0]).toEqual({ type: 'close' });
  });

  it('sorts an array on macOS', () => {
    Object.defineProperty(process, 'platform', {
      value: 'darwin'
    });

    const result = sortButtons([ { type: 'close' }, { type: 'confirm' } ] as any);
    expect(result[0]).toEqual({ type: 'confirm' });
  });
});
