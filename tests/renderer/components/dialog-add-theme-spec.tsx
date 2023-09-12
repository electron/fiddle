import * as React from 'react';

import { shallow } from 'enzyme';
import { mocked } from 'jest-mock';

import { AddThemeDialog } from '../../../src/renderer/components/dialog-add-theme';
import { AppState } from '../../../src/renderer/state';
import { LoadedFiddleTheme, defaultLight } from '../../../src/themes-defaults';
import { overrideRendererPlatform } from '../../utils';

class FileMock extends Blob {
  public lastModified: number;
  public webkitRelativePath: string;

  constructor(
    private bits: string[],
    public name: string,
    public path: string,
    type: string,
  ) {
    super(bits, { type });
    this.lastModified = Date.now();
    this.webkitRelativePath = '';
  }

  async text() {
    return this.bits.join('');
  }
}

describe('AddThemeDialog component', () => {
  let store: AppState;

  beforeEach(() => {
    // We render the buttons different depending on the
    // platform, so let' have a uniform platform for unit tests
    overrideRendererPlatform('darwin');

    ({ state: store } = window.app);
  });

  // TODO(dsanders11): Update this test to be accurate
  it('renders', () => {
    const wrapper = shallow(<AddThemeDialog appState={store} />);

    wrapper.setState({
      file: '/test/file',
    });

    expect(wrapper).toMatchSnapshot();
  });

  describe('createNewThemeFromMonaco()', () => {
    it('handles invalid input', async () => {
      const wrapper = shallow(<AddThemeDialog appState={store} />);
      const instance: any = wrapper.instance();

      try {
        await instance.createNewThemeFromMonaco('', {} as LoadedFiddleTheme);
      } catch (err) {
        expect(err.message).toEqual(`Filename  not found`);
        expect(window.ElectronFiddle.createThemeFile).toHaveBeenCalledTimes(0);
        expect(store.setTheme).toHaveBeenCalledTimes(0);
      }
    });

    it('handles valid input', async () => {
      const wrapper = shallow(<AddThemeDialog appState={store} />);
      const instance: any = wrapper.instance();
      wrapper.setState({
        file: new FileMock(
          [JSON.stringify(defaultLight.editor)],
          'file.json',
          '/test/file.json',
          'application/json',
        ),
      });

      const themePath = '~/.electron-fiddle/themes/testingLight';
      mocked(window.ElectronFiddle.createThemeFile).mockResolvedValue({
        file: themePath,
      } as LoadedFiddleTheme);

      await instance.createNewThemeFromMonaco('testingLight', defaultLight);

      expect(window.ElectronFiddle.createThemeFile).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Fiddle (Light)',
          common: expect.anything(),
          file: 'defaultLight',
        }),
        'testingLight',
      );
      expect(store.setTheme).toHaveBeenCalledWith(themePath);
    });
  });

  describe('onSubmit()', () => {
    it('does nothing if there is no file currently set', async () => {
      const wrapper = shallow(<AddThemeDialog appState={store} />);
      const instance: any = wrapper.instance();

      instance.createNewThemeFromMonaco = jest.fn();
      instance.onClose = jest.fn();

      await instance.onSubmit();

      expect(instance.createNewThemeFromMonaco).toHaveBeenCalledTimes(0);
      expect(instance.onClose).toHaveBeenCalledTimes(0);
    });

    it('loads a theme if a file is currently set', async () => {
      const wrapper = shallow(<AddThemeDialog appState={store} />);
      const instance: any = wrapper.instance();

      const file = new FileMock(
        [JSON.stringify(defaultLight.editor)],
        'file.json',
        '/test/file.json',
        'application/json',
      );
      const spy = jest.spyOn(file, 'text');
      wrapper.setState({ file });

      instance.createNewThemeFromMonaco = jest.fn();
      instance.onClose = jest.fn();

      await instance.onSubmit();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(instance.createNewThemeFromMonaco).toHaveBeenCalledTimes(1);
      expect(instance.onClose).toHaveBeenCalledTimes(1);
    });

    it('shows an error dialog for a malformed theme', async () => {
      store.showErrorDialog = jest.fn().mockResolvedValueOnce(true);
      const wrapper = shallow(<AddThemeDialog appState={store} />);
      const instance: any = wrapper.instance();

      const file = new FileMock(
        [JSON.stringify(defaultLight.editor)],
        'file.json',
        '/test/file.json',
        'application/json',
      );
      const spy = jest.spyOn(file, 'text').mockResolvedValue('{}');
      wrapper.setState({ file });

      instance.onClose = jest.fn();

      await instance.onSubmit();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(store.showErrorDialog).toHaveBeenCalledWith(
        expect.stringMatching(/file does not match specifications/i),
      );
    });
  });

  describe('onChangeFile()', () => {
    it('handles valid input', async () => {
      const wrapper = shallow(<AddThemeDialog appState={store} />);

      const files = ['one', 'two'];
      await (wrapper.instance() as any).onChangeFile({
        target: { files } as unknown as EventTarget,
      } as React.FormEvent<HTMLInputElement>);
      expect(wrapper.state('file')).toBe(files[0]);
    });

    it('handles no input', () => {
      const wrapper = shallow(<AddThemeDialog appState={store} />);

      (wrapper.instance() as any).onChangeFile({
        target: { files: null } as unknown as EventTarget,
      } as React.FormEvent<HTMLInputElement>);
      expect(wrapper.state('file')).toBeUndefined();
    });
  });
});
