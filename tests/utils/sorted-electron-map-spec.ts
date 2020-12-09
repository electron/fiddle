import { sortedElectronMap } from '../../src/utils/sorted-electron-map';

describe('sorted-electron-map', () => {
  it('sorts a record of electron versions', () => {
    const map: any = {
      '1.0.0': {
        version: 'v1.0.0',
      },
      '3.0.0': {
        version: 'v3.0.0',
      },
      '2.0.0': {
        version: 'v2.0.0',
      },
    };

    const result = sortedElectronMap(map, (_k, e) => e);
    expect(result).toStrictEqual<any>([
      { version: 'v3.0.0' },
      { version: 'v2.0.0' },
      { version: 'v1.0.0' },
    ]);
  });

  it('sorts nightly and beta versions correctly', () => {
    const map: any = {
      '2.0.0-nightly.20200101': {
        version: 'v2.0.0-nightly.20200101',
      },
      '2.0.0-nightly.20200102': {
        version: 'v2.0.0-nightly.20200102',
      },
      '2.0.0': {
        version: 'v2.0.0',
      },
      '3.0.0-nightly.20200105': {
        version: 'v3.0.0-nightly.20200105',
      },
      '3.0.0': {
        version: 'v3.0.0',
      },
      '3.0.0-beta.1': {
        version: 'v3.0.0-beta.1',
      },
      '2.0.0-beta.1': {
        version: 'v2.0.0-beta.1',
      },
      '2.0.0-beta.2': {
        version: 'v2.0.0-beta.2',
      },
      '2.0.0-beta.3': {
        version: 'v2.0.0-beta.3',
      },
    };

    const result = sortedElectronMap(map, (_k, e) => e);
    expect(result).toStrictEqual<any>([
      { version: 'v3.0.0' },
      { version: 'v3.0.0-beta.1' },
      { version: 'v3.0.0-nightly.20200105' },
      { version: 'v2.0.0' },
      { version: 'v2.0.0-beta.3' },
      { version: 'v2.0.0-beta.2' },
      { version: 'v2.0.0-beta.1' },
      { version: 'v2.0.0-nightly.20200102' },
      { version: 'v2.0.0-nightly.20200101' },
    ]);
  });

  it('handles invalid versions', () => {
    const map: any = {
      moreGarbage: {
        version: 'moreGarbage',
      },
      '1.0.0': {
        version: 'v1.0.0',
      },
      '3.0.0': {
        version: 'v3.0.0',
      },
      garbage: {
        version: 'garbage',
      },
    };

    const result = sortedElectronMap(map, (_k, e) => e);
    expect(result).toStrictEqual<any>([
      { version: 'garbage' },
      { version: 'moreGarbage' },
      { version: 'v3.0.0' },
      { version: 'v1.0.0' },
    ]);
  });
});
