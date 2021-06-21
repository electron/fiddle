import { shell } from 'electron';
import { shallow } from 'enzyme';
import * as React from 'react';
import * as fs from 'fs-extra';

import { AddThemeDialog } from '../../../src/renderer/components/dialog-add-theme';
import { overridePlatform, resetPlatform } from '../../utils';
import {
  defaultLight,
  LoadedFiddleTheme,
} from '../../../src/renderer/themes-defaults';

import { StateMock } from '../../mocks/mocks';

jest.mock('../../../src/renderer/ipc');
jest.mock('../../../src/renderer/binary');

describe('AddThemeDialog component', () => {
  let store: StateMock;

  beforeAll(() => {
    // We render the buttons different depending on the
    // platform, so let' have a uniform platform for unit tests
    overridePlatform('darwin');
  });

  afterAll(() => {
    resetPlatform();
  });

  beforeEach(() => {
    ({ state: store } = (window as any).ElectronFiddle.app);
  });

  it('renders', () => {
    const wrapper = shallow(<AddThemeDialog appState={store as any} />);

    wrapper.setState({
      file: '/test/file',
    });

    expect(wrapper).toMatchSnapshot();
  });

  describe('createNewThemeFromMonaco()', () => {
    it('handles invalid input', async () => {
      const wrapper = shallow(<AddThemeDialog appState={store as any} />);
      const instance: AddThemeDialog = wrapper.instance() as any;

      try {
        await instance.createNewThemeFromMonaco('', {} as LoadedFiddleTheme);
      } catch (err) {
        expect(err.message).toEqual(`Filename  not found`);
        expect(fs.outputJSON).toHaveBeenCalledTimes(0);
        expect(store.setTheme).toHaveBeenCalledTimes(0);
        expect(shell.showItemInFolder).toHaveBeenCalledTimes(0);
      }
    });

    it('handles valid input', async () => {
      const wrapper = shallow(<AddThemeDialog appState={store as any} />);
      const instance: AddThemeDialog = wrapper.instance() as any;
      wrapper.setState({ file: '/test/file' });

      (fs.outputJSON as jest.Mock).mockResolvedValue({});

      await instance.createNewThemeFromMonaco('testingLight', defaultLight);

      expect(fs.outputJSON).toHaveBeenCalled();

      const args = (fs.outputJSON as jest.Mock).mock.calls[0];
      expect(args[0].includes(`.electron-fiddle`)).toBe(true);
      expect(args[1].name).toEqual('testingLight');
      expect(args[1].common).toBeDefined();
      expect(args[1].file).toBeDefined();

      const themePath = '~/.electron-fiddle/themes/testingLight';
      expect(store.setTheme).toHaveBeenCalledWith(themePath);
      expect(shell.showItemInFolder).toHaveBeenCalledWith(themePath);
    });
  });

  describe('onSubmit()', () => {
    it('does nothing if there is no file currently set', async () => {
      const wrapper = shallow(<AddThemeDialog appState={store as any} />);
      const instance: AddThemeDialog = wrapper.instance() as any;

      instance.createNewThemeFromMonaco = jest.fn();
      instance.onClose = jest.fn();

      await instance.onSubmit();

      expect(fs.readJSONSync).toHaveBeenCalledTimes(0);
      expect(instance.createNewThemeFromMonaco).toHaveBeenCalledTimes(0);
      expect(instance.onClose).toHaveBeenCalledTimes(0);
    });

    it('loads a theme if a file is currently set', async () => {
      const wrapper = shallow(<AddThemeDialog appState={store as any} />);
      const instance: AddThemeDialog = wrapper.instance() as any;

      wrapper.setState({ file: '/test/file' });

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
      const wrapper = shallow(<AddThemeDialog appState={store as any} />);
      const instance: AddThemeDialog = wrapper.instance() as any;

      wrapper.setState({ file: '/test/file' });

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
      const wrapper = shallow(<AddThemeDialog appState={store as any} />);

      const files = ['one', 'two'];
      (wrapper.instance() as any).onChangeFile({
        target: { files },
      });
      expect(wrapper.state('file')).toBe(files[0]);
    });

    it('handles no input', () => {
      const wrapper = shallow(<AddThemeDialog appState={store as any} />);

      (wrapper.instance() as any).onChangeFile({
        target: { files: null },
      });
      expect(wrapper.state('file')).toBeUndefined();
    });
  });
});
