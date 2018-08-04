import { mainTheme } from '../../src/renderer/themes';

describe('themes', () => {
  it('exports a theme', () => {
    expect(mainTheme.base).toBeTruthy();
    expect(mainTheme.inherit).toBeTruthy();
    expect(mainTheme.rules).toBeTruthy();
    expect(mainTheme.colors).toBeTruthy();
  });
});
