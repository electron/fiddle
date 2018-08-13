import { defaultDark, defaultLight } from '../../src/renderer/themes-defaults';

describe('themes defaults', () => {
  it('exports defaultDark', () => {
    expect(defaultDark.common).toBeTruthy();
    expect(defaultDark.editor.base).toBeTruthy();
    expect(defaultDark.editor.inherit).toBeTruthy();
    expect(defaultDark.editor.rules).toBeTruthy();
    expect(defaultDark.editor.colors).toBeTruthy();
  });

  it('exports defaultLight', () => {
    expect(defaultLight.common).toBeTruthy();
    expect(defaultLight.editor.base).toBeTruthy();
    expect(defaultLight.editor.inherit).toBeTruthy();
    expect(defaultLight.editor.rules).toBeTruthy();
    expect(defaultLight.editor.colors).toBeTruthy();
  });
});
