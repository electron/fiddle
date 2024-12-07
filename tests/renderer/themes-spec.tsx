import { mocked } from 'jest-mock';

import { activateTheme, getTheme } from '../../src/renderer/themes';
import { LoadedFiddleTheme } from '../../src/themes-defaults';

describe('themes', () => {
  beforeEach(() => {
    window.app.state.isUsingSystemTheme = false;
  });

  describe('activateTheme()', () => {
    it('attempts to activate a theme', async () => {
      const { editor } = window.monaco;

      activateTheme(await getTheme(window.app.state, null));

      expect(editor.setTheme).toHaveBeenCalled();
      expect(editor.defineTheme).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ base: 'vs-dark' }),
      );
    });
  });

  describe('getTheme()', () => {
    it('returns a default theme', async () => {
      const theme = await getTheme(window.app.state, '');
      expect(theme.name).toBe('Fiddle (Dark)');
    });

    it('returns a default theme for null', async () => {
      const theme = await getTheme(window.app.state, null);
      expect(theme.name).toBe('Fiddle (Dark)');
    });

    it('returns default theme according to system when isUsingSystemTheme', async () => {
      let theme: LoadedFiddleTheme;
      window.app.state.isUsingSystemTheme = true;

      mocked(window.matchMedia).mockReturnValueOnce({
        matches: true,
      } as MediaQueryList);
      theme = await getTheme(window.app.state, null);
      expect(theme.name).toBe('Fiddle (Dark)');

      mocked(window.matchMedia).mockReturnValueOnce({
        matches: false,
      } as MediaQueryList);
      theme = await getTheme(window.app.state, null);
      expect(theme.name).toBe('Fiddle (Light)');
    });

    it('returns a named theme', async () => {
      mocked(window.ElectronFiddle.readThemeFile).mockResolvedValue({
        name: 'Test',
        common: { test: true },
      } as unknown as LoadedFiddleTheme);

      const theme = await getTheme(window.app.state, 'test');
      expect(theme.name).toBe('Test');
    });

    it('handles a read error', async () => {
      mocked(window.ElectronFiddle.readThemeFile).mockResolvedValue(null);

      const theme = await getTheme(window.app.state, 'test');
      expect(theme.name).toBe('Fiddle (Dark)');
    });
  });
});
