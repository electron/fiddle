import { getOctokit } from '../../src/utils/octokit';

let mockRequired = 0;
let mockConstructed = 0;

jest.mock('@octokit/rest', () => ({
  get default() {
    mockRequired++;

    return class MockOctokit {
      constructor() {
        mockConstructed++;
      }
    };
  }
}));

describe('octokit', () => {
  describe('getOctokit()', () => {
    it('requires the Octokit only once', async () => {
      let octokit = await getOctokit();
      octokit = await getOctokit();

      expect(octokit).toBeTruthy();
      expect(mockRequired).toBe(1);
      expect(mockConstructed).toBe(1);
    });
  });
});
