import { NpmVersion } from '../../src/interfaces';
import { arrayToStringMap } from '../../src/utils/array-to-stringmap';

describe('array-to-stringmap', () => {
  it('correctly turns an array of versions into a stringmap', () => {
    const input: Array<Partial<NpmVersion>> = [
      {
        version: 'v1.0.0'
      }, {
        version: 'v2.0.0'
      }, {
        version: '3.0.0'
      }
    ];
    const output = arrayToStringMap(input as any);

    expect(output).toEqual({
      '1.0.0': {
        version: 'v1.0.0',
      },
      '2.0.0': {
        version: 'v2.0.0',
      },
      '3.0.0': {
        version: '3.0.0',
      },
    });
  });
});
