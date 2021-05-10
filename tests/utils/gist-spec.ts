import { getGistId, idFromUrl, urlFromId } from '../../src/utils/gist';

jest.mock('os', () => ({
  userInfo: () => ({
    username: 'test-user',
  }),
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

    it('returns an empty string if id is undefined', () => {
      const result = urlFromId();
      expect(result).toBe('');
    });
  });

  describe('getGistId', () => {
    const GIST_ID = 'af3e1a018f5dcce4a2ff40004ef5bab5';

    it('recognizes lowercase gist ids', () => {
      const expected = GIST_ID.toLowerCase();
      const input = expected;
      const actual = getGistId(input);
      expect(actual).toBe(expected);
    });

    it('recognizes uppercase gist ids', () => {
      const expected = GIST_ID.toUpperCase();
      const input = expected;
      const actual = getGistId(input);
      expect(actual).toBe(expected);
    });

    it('trims extra spaces from the gist url', () => {
      const expected = GIST_ID;
      const input = `   https://gist.github.com/${expected} `;
      const actual = getGistId(input);
      expect(actual).toBe(expected);
    });

    it('recognizes gist URLs without usernames', () => {
      const expected = GIST_ID;
      const input = `https://gist.github.com/${expected}`;
      const actual = getGistId(input);
      expect(actual).toBe(expected);
    });

    it('recognizes gist URLs with usernames', () => {
      const expected = GIST_ID;
      const input = `https://gist.github.com/ckerr/${expected}`;
      const actual = getGistId(input);
      expect(actual).toBe(expected);
    });

    it('recognizes gist URLs with trailing `/`', () => {
      const expected = GIST_ID;
      const input = `https://gist.github.com/${expected}/`;
      const actual = getGistId(input);
      expect(actual).toBe(expected);
    });
  });
});
