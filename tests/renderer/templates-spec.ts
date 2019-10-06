import { getTemplateValues } from '../../src/renderer/templates';

jest.mock('fs-extra');
jest.mock('path');
jest.mock('../../src/renderer/constants', () => ({
  USER_DATA_PATH: 'user/data/'
}));
jest.mock('../../src/utils/import', () => ({
  fancyImport: async (p: string) => require(p)
}));

describe('templates', () => {
  describe('getTemplateValues()', () => {
    it('attempts to load template values', async () => {
      const fs = require('fs-extra');

      fs.readFile.mockReturnValueOnce('renderer');
      fs.readFile.mockReturnValueOnce('main');
      fs.readFile.mockReturnValueOnce('html');

      const values = await getTemplateValues('test');

      expect(values.html).toBe('html');
      expect(values.main).toBe('main');
      expect(values.renderer).toBe('renderer');
    });

    it('handles errors', async () => {
      const fs = require('fs-extra');

      fs.readFile.mockReturnValue(Promise.reject('bwap'));

      const values = await getTemplateValues('test');

      expect(values.html).toBe('');
      expect(values.main).toBe('');
      expect(values.renderer).toBe('');
    });

    it('handles errors and reports the templates content', async () => {
      const fs = require('fs-extra');

      fs.readFile.mockReturnValue(Promise.reject('bwap'));
      fs.existsSync.mockReturnValue(true);

      await getTemplateValues('test');
      expect(fs.existsSync).toHaveBeenCalledTimes(4);
      expect(fs.readdirSync).toHaveBeenCalledTimes(4);
    });
  });
});
