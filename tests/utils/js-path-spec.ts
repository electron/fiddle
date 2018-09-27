import { getAtPath, setAtPath } from '../../src/utils/js-path';

describe('js-path', () => {
  describe('getAtPath()', () => {
    it('works with an object', () => {
      const input = { a: { b: { c: true } } };
      const output = getAtPath('a.b.c', input);

      expect(output).toBe(true);
    });

    it('works with a simple object', () => {
      const input = { a: 3 };
      const output = getAtPath('a', input);

      expect(output).toBe(3);
    });
  });

  describe('setAtPath()', () => {
    it('works with an object', () => {
      const input = { a: { b: { c: true } } };
      setAtPath('a.b.c', input, 3);

      expect(input.a.b.c).toBe(3);
    });
  });
});
