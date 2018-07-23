import { idFromUrl, urlFromId } from '../../src/utils/gist';

jest.mock('os', () => ({
  userInfo: () => ({
    username: 'test-user'
  })
}));

describe('gist', () => {
  const mockId = '452864a60efdf57a0dfa19b9fa853529';

  describe('idFromUrl()', () => {
    it('gets an id from a URL (direct format)', () => {
      const result = idFromUrl(`https://gist.github.com/${mockId}`);
      expect(result).toBe('452864a60efdf57a0dfa19b9fa853529');
    });

    it('gets an id from a URL ("with user" format)', () => {
      const result = idFromUrl(`https://gist.github.com/test/${mockId}`);
      expect(result).toBe('452864a60efdf57a0dfa19b9fa853529');
    });

    it('handles garbage', () => {
      const result = idFromUrl('https://google.com');
      expect(result).toBe(null);
    });
  });

  describe('urlFromId', () => {
    it('returns a url for an id', () => {
      const result = urlFromId(mockId);
      expect(result).toBe(`https://gist.github.com/${mockId}`);
    });
  });
});
