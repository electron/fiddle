import { getProjectName } from '../../../src/main/utils/get-project-name';

describe('get-project-name', () => {
  describe('getProjectName()', () => {
    it('returns a random name', async () => {
      const result = await getProjectName();
      expect(result).toBeTruthy();
    });

    it('returns a name from the local path if saved', async () => {
      const result = await getProjectName('a/b/myFiddle');
      expect(result).toBe('myFiddle');
    });
  });
});
