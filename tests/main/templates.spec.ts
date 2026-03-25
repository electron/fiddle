import * as path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { MAIN_JS } from '../../src/interfaces';
import { getTemplateValues } from '../../src/main/templates';
import { getEmptyContent } from '../../src/utils/editor-utils';

vi.unmock('fs-extra');
vi.mock('../../src/main/constants', () => ({
  STATIC_DIR: path.join(__dirname, '../../static'),
}));

describe('templates', () => {
  const KNOWN_GOOD_TEMPLATE = 'clipboard';
  const KNOWN_BAD_TEMPLATE = 'not-a-real-show-me';

  describe('getTemplateValues()', () => {
    it('loads templates', async () => {
      const values = await getTemplateValues(KNOWN_GOOD_TEMPLATE);
      expect(values[MAIN_JS].length).toBeGreaterThan(0);
    });

    it('handles errors', async () => {
      const values = await getTemplateValues(KNOWN_BAD_TEMPLATE);
      expect(values[MAIN_JS]).toBe(getEmptyContent(MAIN_JS));
    });

    it('reports missing files', async () => {
      console.log = vi.fn();

      await getTemplateValues(KNOWN_BAD_TEMPLATE);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching('Got Fiddle from'),
        [MAIN_JS],
      );

      vi.mocked(console.log).mockClear();
    });
  });
});
