
import { App } from '../../src/renderer/app';
import { ElectronFiddleMock } from '../mocks/electron-fiddle';

jest.mock('electron', () => require('../../mocks/electron'));
jest.mock('../../src/renderer/file-manager', () => require('../mocks/file-manager'));
jest.mock('../../src/renderer/state', () => ({
  appState: {
    getName: () => 'Test'
  }
}));

describe('Editrors component', () => {
  beforeEach(() => {
    this.store = {
      isTokenDialogShowing: false,
      isSettingsShowing: false
    };

    this.monaco = {
      editor: {
        defineTheme: jest.fn()
      }
    };

    (window as any).ElectronFiddle = new ElectronFiddleMock();
  });

  describe('getValues()', () => {
    it('gets values', async () => {
      const app = new App();
      const b = await app.getValues({});

      expect(b.html).toBe('editor-value');
      expect(b.main).toBe('editor-value');
      expect(b.renderer).toBe('editor-value');
      expect(b.package).toBeTruthy();
      expect(JSON.parse(b.package)).toBeTruthy();
    });

    it('handles missing editors', async () => {
      (window as any).ElectronFiddle.editors.html = null;
      (window as any).ElectronFiddle.editors.main = null;
      (window as any).ElectronFiddle.editors.renderer = null;

      const app = new App();
      const result = await app.getValues({});

      expect(result.html).toBe('');
      expect(result.main).toBe('');
      expect(result.renderer).toBe('');
      expect(result.package).toBeTruthy();
      expect(JSON.parse(result.package)).toBeTruthy();
    });

    it('throws if the Fiddle object is not present', async () => {
      (window as any).ElectronFiddle = null;

      const app = new App();
      let threw = false;
      try {
        const result = await app.getValues({});
      } catch (error) {
        threw = true;
      }

      expect(threw).toBe(true);
    });
  });

  describe('setValues()', () => {
    it('attempts to set values', () => {
      const app = new App();
      app.setValues({
        html: 'html-value',
        main: 'main-value',
        renderer: 'renderer-value'
      });

      expect((window as any).ElectronFiddle.editors.html.setValue)
        .toHaveBeenCalledWith('html-value');
      expect((window as any).ElectronFiddle.editors.main.setValue)
        .toHaveBeenCalledWith('main-value');
      expect((window as any).ElectronFiddle.editors.renderer.setValue)
        .toHaveBeenCalledWith('renderer-value');
    });

    it('throws if the Fiddle object is not present', async () => {
      (window as any).ElectronFiddle = null;

      const app = new App();
      let threw = false;
      try {
        const result = await app.setValues({ html: '', main: '', renderer: ''});
      } catch (error) {
        threw = true;
      }

      expect(threw).toBe(true);
    });
  });

  describe('setupResizeListener()', () => {
    it('attaches to the handler', () => {
      window.addEventListener = jest.fn();

      const app = new App();
      app.setupResizeListener();

      expect(window.addEventListener)
        .toHaveBeenCalled();
      expect((window.addEventListener as jest.Mock).mock.calls[0][0])
        .toBe('resize');
    });
  });

  it('renders', () => {
    const app = new App();
  });
});
