import { sortedElectronMap } from '../../src/utils/sorted-electron-map';

describe('sorted-eletron-map', () => {
  it('sorts a record of electron versions', () => {
    const map: any = {
      '1.0.0': {
        version: 'v1.0.0'
      },
      '3.0.0': {
        version: 'v3.0.0'
      },
      '2.0.0': {
        version: 'v2.0.0'
      }
    };
    const result = sortedElectronMap(map, (_k, e) => e);

    expect(result[0]).toEqual({ version: 'v3.0.0' });
    expect(result[1]).toEqual({ version: 'v2.0.0' });
    expect(result[2]).toEqual({ version: 'v1.0.0' });
  });

  it('handles invalid versions', () => {
    const map: any = {
      moreGarbage: {
        version: 'moreGarbage'
      },
      '1.0.0': {
        version: 'v1.0.0'
      },
      '3.0.0': {
        version: 'v3.0.0'
      },
      garbage: {
        version: 'garbage'
      }
    };
    const result = sortedElectronMap(map, (_k, e) => e);

    expect(result[0]).toEqual({ version: 'garbage' });
    expect(result[1]).toEqual({ version: 'moreGarbage' });
    expect(result[2]).toEqual({ version: 'v3.0.0' });
    expect(result[3]).toEqual({ version: 'v1.0.0' });
  });
});
