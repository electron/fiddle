import { GitHubVersion } from '../../src/interfaces';
import { arrayToStringMap } from '../../src/utils/array-to-stringmap';

describe('array-to-stringmap', () => {
  it('correctly turns an array of versions into a stringmap', () => {
    const input: Array<Partial<GitHubVersion>> = [
      {
        name: 'Test Version 1',
        tag_name: 'v1.0.0'
      }, {
        name: 'Test Version 2',
        tag_name: 'v2.0.0'
      }, {
        name: 'Test Version 3',
        tag_name: '3.0.0'
      }
    ];
    const output = arrayToStringMap(input as any);

    expect(output).toEqual({
      '1.0.0': {
        name: 'Test Version 1',
        tag_name: 'v1.0.0',
        state: 'unknown'
      },
      '2.0.0': {
        name: 'Test Version 2',
        tag_name: 'v2.0.0',
        state: 'unknown'
      },
      '3.0.0': {
        name: 'Test Version 3',
        tag_name: '3.0.0',
        state: 'unknown'
      },
    });
  });
});
