import { getOctokit } from '../../src/utils/octokit';

let mockRequired = 0;
let mockConstructed = 0;

jest.mock('@octokit/rest', () => ({
  get default() {
    mockRequired++;

    return class MockOctokit {
      public authenticate = jest.fn();

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

    it('uses GitHub authentication when available', async () => {
      const mockStore = {
        gistId: 'abcdtestid',
        gitHubToken: 'testToken'
      };
      const { authenticate } = await getOctokit(mockStore as any);

      expect(authenticate).toHaveBeenCalledTimes(1);
      expect((authenticate as jest.Mock).mock.calls[0][0]).toEqual({
        type: 'token',
        token: mockStore.gitHubToken
      });
    });
  });
});
