import * as React from 'react';

import * as path from 'path';

import { shallow } from 'enzyme';
import * as fs from 'fs-extra';

import { AddThemeDialog } from '../../../src/renderer/components/dialog-add-theme';
import { AppState } from '../../../src/renderer/state';
import { createThemeFile } from '../../../src/renderer/themes';
import {
  LoadedFiddleTheme,
  defaultLight,
} from '../../../src/renderer/themes-defaults';
import { overrideRendererPlatform } from '../../utils';

jest.mock('../../../src/renderer/themes', () => ({
  createThemeFile: jest.fn(),
}));

class FileMock {
  constructor(
    private bits: string[],
    public name: string,
    public path: string,
  ) {}

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

    ({ state: store } = window.ElectronFiddle.app);
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
      const instance: any = wrapper.instance() as any;

      try {
        await instance.createNewThemeFromMonaco('', {} as LoadedFiddleTheme);
      } catch (err) {
        expect(err.message).toEqual(`Filename  not found`);
        expect(createThemeFile).toHaveBeenCalledTimes(0);
        expect(store.setTheme).toHaveBeenCalledTimes(0);
      }
    });

    it('handles valid input', async () => {
      const wrapper = shallow(<AddThemeDialog appState={store} />);
      const instance: any = wrapper.instance() as any;
      wrapper.setState({
        file: new FileMock(
          [JSON.stringify(defaultLight.editor)],
          'file.json',
          '/test/file.json',
        ),
      });

      const themePath = path.join(
        '~',
        '.electron-fiddle',
        'themes',
        'testingLight',
      );
      (createThemeFile as jest.Mock).mockResolvedValue({ file: themePath });

      await instance.createNewThemeFromMonaco('testingLight', defaultLight);

      expect(createThemeFile).toHaveBeenCalledWith(
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
      const instance: any = wrapper.instance() as any;

      instance.createNewThemeFromMonaco = jest.fn();
      instance.onClose = jest.fn();

      await instance.onSubmit();

      expect(fs.readJSONSync).toHaveBeenCalledTimes(0);
      expect(instance.createNewThemeFromMonaco).toHaveBeenCalledTimes(0);
      expect(instance.onClose).toHaveBeenCalledTimes(0);
    });

    it('loads a theme if a file is currently set', async () => {
      const wrapper = shallow(<AddThemeDialog appState={store} />);
      const instance: any = wrapper.instance() as any;

      wrapper.setState({
        file: new FileMock(
          [JSON.stringify(defaultLight.editor)],
          'file.json',
          '/test/file.json',
        ),
      });

      (fs.readJSONSync as jest.Mock).mockReturnValue(defaultLight.editor);

      instance.createNewThemeFromMonaco = jest.fn();
      instance.onClose = jest.fn();

      await instance.onSubmit();

      expect(fs.readJSONSync).toHaveBeenCalledTimes(1);
      expect(instance.createNewThemeFromMonaco).toHaveBeenCalledTimes(1);
      expect(instance.onClose).toHaveBeenCalledTimes(1);
    });

    it('shows an error dialog for a malformed theme', async () => {
      store.showErrorDialog = jest.fn().mockResolvedValueOnce(true);
      const wrapper = shallow(<AddThemeDialog appState={store} />);
      const instance: any = wrapper.instance() as any;

      wrapper.setState({
        file: new FileMock(
          [JSON.stringify(defaultLight.editor)],
          'file.json',
          '/test/file.json',
        ),
      });

      (fs.readJSONSync as jest.Mock).mockReturnValue({});

      instance.onClose = jest.fn();

      await instance.onSubmit();

      expect(fs.readJSONSync).toHaveBeenCalledTimes(1);
      expect(store.showErrorDialog).toHaveBeenCalledWith(
        expect.stringMatching(/file does not match specifications/i),
      );
    });
  });

  describe('onChangeFile()', () => {
    it('handles valid input', () => {
      const wrapper = shallow(<AddThemeDialog appState={store} />);

      const files = ['one', 'two'];
      (wrapper.instance() as any).onChangeFile({
        target: { files },
      });
      expect(wrapper.state('file')).toBe(files[0]);
    });

    it('handles no input', () => {
      const wrapper = shallow(<AddThemeDialog appState={store} />);

      (wrapper.instance() as any).onChangeFile({
        target: { files: null },
      });
      expect(wrapper.state('file')).toBeUndefined();
    });
  });
});
