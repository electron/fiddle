import { getName } from '../../src/utils/get-name';

describe('get-name', () => {
  describe('getName()', () => {
    it('returns a random name', async () => {
      const result = await getName({} as any);
      expect(result).toBeTruthy();
    });

    it('returns a name from the local path if saved', async () => {
      const result = await getName({ localPath: 'a/b/myFiddle' } as any);
      expect(result).toBe('myFiddle');
    });
  });
});
