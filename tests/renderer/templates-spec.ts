import { getTemplateValues } from '../../src/renderer/templates';

jest.unmock('fs-extra');

describe('templates', () => {
  const KNOWN_GOOD_TEMPLATE = 'clipboard';
  const KNOWN_BAD_TEMPLATE = 'not-a-real-show-me';

  describe('getTemplateValues()', () => {
    it('loads templates', async () => {
      const values = await getTemplateValues(KNOWN_GOOD_TEMPLATE);

      expect(values.html).toMatch(/^<!DOCTYPE html>/);
      expect(values.main.length).toBeGreaterThan(0);
      expect(values.renderer.length).toBeGreaterThan(0);
    });

    it('handles errors', async () => {
      const values = await getTemplateValues(KNOWN_BAD_TEMPLATE);

      expect(values.html).toBe('');
      expect(values.main).toBe('');
      expect(values.renderer).toBe('');
    });

    it('reports missing files', async () => {
      console.log = jest.fn();

      await getTemplateValues(KNOWN_BAD_TEMPLATE);

      expect(console.log).toHaveBeenCalledTimes(1);
      expect((console.log as jest.Mock).mock.calls[0][0]).toMatch(
        'Missed: index.html, main.js, package.json, preload.js, renderer.js, styles.css',
      );

      (console.log as jest.Mock).mockClear();
    });
  });
});
