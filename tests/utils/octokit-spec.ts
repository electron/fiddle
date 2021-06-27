import { getOctokit } from '../../src/utils/octokit';

let mockConstructed = 0;

jest.mock('@octokit/rest', () => ({
  Octokit: class OctokitMock {
    authenticate: jest.Mock;
    constructor() {
      ++mockConstructed;
      this.authenticate = jest.fn();
    }
  },
}));

describe('octokit', () => {
  describe('getOctokit()', () => {
    it('constructs the Octokit only once', () => {
      getOctokit();
      getOctokit();
      expect(mockConstructed).toBe(1);
    });

    it('uses GitHub authentication when available', () => {
      const mockStore = {
        gistId: 'abcdtestid',
        gitHubToken: 'testToken',
      };
      const { authenticate } = getOctokit(mockStore as any);

      expect(authenticate).toHaveBeenCalledTimes(1);
      expect((authenticate as jest.Mock).mock.calls[0][0]).toEqual({
        type: 'token',
        token: mockStore.gitHubToken,
      });
    });
  });
});
