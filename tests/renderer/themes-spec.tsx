import { activateTheme, getTheme } from '../../src/renderer/themes';

describe('themes', () => {
  describe('activateTheme()', () => {
    it('attempts to activate a theme', async () => {
      const { editor } = window.ElectronFiddle.monaco;

      activateTheme(await getTheme());

      expect(editor.setTheme).toHaveBeenCalled();
      expect(editor.defineTheme).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ base: 'vs-dark' }),
      );
    });
  });

  describe('getTheme()', () => {
    it('returns a default theme', async () => {
      const theme = await getTheme();
      expect(theme.name).toBe('Fiddle (Dark)');
    });

    it('returns a default theme for null', async () => {
      const theme = await getTheme(null);
      expect(theme.name).toBe('Fiddle (Dark)');
    });

    it('returns a named theme', async () => {
      (window.ElectronFiddle.readThemeFile as jest.Mock).mockReturnValue({
        name: 'Test',
        common: { test: true },
      });

      const theme = await getTheme('test');
      expect(theme.name).toBe('Test');
    });

    it('handles a read error', async () => {
      (window.ElectronFiddle.readThemeFile as jest.Mock).mockReturnValue(null);

      const theme = await getTheme('test');
      expect(theme.name).toBe('Fiddle (Dark)');
    });
  });
});
