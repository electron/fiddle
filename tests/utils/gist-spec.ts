import { getGistId, urlFromId } from '../../src/utils/gist';

jest.mock('os', () => ({
  userInfo: () => ({
    username: 'test-user',
  }),
}));

describe('gist', () => {
  const mockId = '452864a60efdf57a0dfa19b9fa853529';

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

    it('handles garbage', () => {
      const result = getGistId('https://google.com');
      expect(result).toBe(undefined);
    });
  });
});
