import { getTemplateValues } from '../../src/renderer/templates';
import {
  INDEX_HTML_NAME,
  MAIN_JS_NAME,
  PRELOAD_JS_NAME,
  RENDERER_JS_NAME,
} from '../../src/shared-constants';

import * as path from 'path';

jest.mock('fs-extra');
jest.mock('../../src/utils/import', () => ({
  fancyImport: async (p: string) => require(p),
}));

describe('templates', () => {
  describe('getTemplateValues()', () => {
    it('attempts to load template values', async () => {
      const fs = require('fs-extra');
      fs.readFile.mockImplementation((dir: string) => path.basename(dir));
      const values = await getTemplateValues('test');
      expect(values.html).toBe(INDEX_HTML_NAME);
      expect(values.main).toBe(MAIN_JS_NAME);
      expect(values.preload).toBe(PRELOAD_JS_NAME);
      expect(values.renderer).toBe(RENDERER_JS_NAME);
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
      expect(fs.existsSync).toHaveBeenCalledTimes(5);
      expect(fs.readdirSync).toHaveBeenCalledTimes(5);
    });
  });
});
