import { sortedElectronMap } from '../../src/utils/sorted-electron-map';

describe('sorted-eletron-map', () => {
  it('sorts a stringmap of electron versions', () => {
    const map: any = {
      '1.0.0': {
        tag_name: 'v1.0.0'
      },
      '3.0.0': {
        tag_name: 'v3.0.0'
      },
      '2.0.0': {
        tag_name: 'v2.0.0'
      }
    };
    const result = sortedElectronMap(map, (k, e) => e);

    expect(result[0]).toEqual({ tag_name: 'v3.0.0' });
    expect(result[1]).toEqual({ tag_name: 'v2.0.0' });
    expect(result[2]).toEqual({ tag_name: 'v1.0.0' });
  });
});
