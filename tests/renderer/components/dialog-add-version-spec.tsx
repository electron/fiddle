import * as React from 'react';

import { shallow } from 'enzyme';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AddVersionDialog } from '../../../src/renderer/components/dialog-add-version';
import { AppState } from '../../../src/renderer/state';
import { overrideRendererPlatform } from '../../utils';

describe('AddVersionDialog component', () => {
  let store: AppState;

  const mockFile = '/test/file';

  beforeEach(() => {
    // We render the buttons different depending on the
    // platform, so let' have a uniform platform for unit tests
    overrideRendererPlatform('darwin');

    ({ state: store } = window.app);
  });

  it('renders', () => {
    const wrapper = shallow(<AddVersionDialog appState={store} />);

    wrapper.setState({
      isValidName: true,
      isValidElectron: true,
      folderPath: mockFile,
    });

    expect(wrapper).toMatchSnapshot();

    wrapper.setState({
      isValidName: false,
      isValidElectron: true,
      folderPath: mockFile,
    });

    expect(wrapper).toMatchSnapshot();

    wrapper.setState({
      isValidName: true,
      isValidElectron: true,
      existingLocalVersion: {
        version: '2.2.2',
        localPath: mockFile,
      },
      folderPath: mockFile,
    });

    expect(wrapper).toMatchSnapshot();
  });

  it('overrides default input with Electron dialog', () => {
    const preventDefault = vi.fn();

    const wrapper = shallow(<AddVersionDialog appState={store} />);
    const inp = wrapper.find('#custom-electron-version');
    inp.dive().find('input[type="file"]').simulate('click', { preventDefault });

    expect(window.ElectronFiddle.selectLocalVersion).toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalled();
  });

  describe('selectLocalVersion()', () => {
    it('updates state', async () => {
      const wrapper = shallow(<AddVersionDialog appState={store} />);
      vi.mocked(window.ElectronFiddle.selectLocalVersion).mockResolvedValue({
        folderPath: '/test/',
        isValidElectron: true,
        localName: 'Test',
      });
      await (wrapper.instance() as any).selectLocalVersion();

      expect(wrapper.state('isValidElectron')).toBe(true);
      expect(wrapper.state('folderPath')).toBe('/test/');
      expect(wrapper.state('localName')).toBe('Test');
      expect(wrapper.state('name')).toBe('Test');
      expect(wrapper.state('isValidName')).toBe(true);
    });
  });

  describe('onChangeName()', () => {
    it('handles valid input', () => {
      const wrapper = shallow(<AddVersionDialog appState={store} />);

      (wrapper.instance() as any).onChangeName({
        target: { value: 'My Build' },
      });
      expect(wrapper.state('isValidName')).toBe(true);
      expect(wrapper.state('name')).toBe('My Build');
    });

    it('handles empty input', () => {
      const wrapper = shallow(<AddVersionDialog appState={store} />);

      (wrapper.instance() as any).onChangeName({ target: { value: '' } });
      expect(wrapper.state('isValidName')).toBe(false);
      expect(wrapper.state('name')).toBe('');
    });

    it('handles whitespace-only input', () => {
      const wrapper = shallow(<AddVersionDialog appState={store} />);

      (wrapper.instance() as any).onChangeName({ target: { value: '   ' } });
      expect(wrapper.state('isValidName')).toBe(false);
      expect(wrapper.state('name')).toBe('   ');
    });

    it('handles missing value', () => {
      const wrapper = shallow(<AddVersionDialog appState={store} />);

      (wrapper.instance() as any).onChangeName({ target: {} });
      expect(wrapper.state('isValidName')).toBe(false);
      expect(wrapper.state('name')).toBe('');
    });
  });

  describe('onSubmit', () => {
    it('does not do anything without a file', async () => {
      const wrapper = shallow(<AddVersionDialog appState={store} />);

      await (wrapper.instance() as any).onSubmit();

      expect(store.addLocalVersion).toHaveBeenCalledTimes(0);
    });

    it('adds a local version using the given data', async () => {
      const wrapper = shallow(<AddVersionDialog appState={store} />);

      wrapper.setState({
        name: 'My Custom Build',
        folderPath: '/test/path',
        isValidElectron: true,
        isValidName: true,
      });

      await (wrapper.instance() as any).onSubmit();

      expect(store.addLocalVersion).toHaveBeenCalledTimes(1);
      expect(store.addLocalVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          localPath: '/test/path',
          version: expect.stringMatching(/^0\.0\.0-local\.\d+$/),
          name: 'My Custom Build',
        }),
      );
    });

    it('shows dialog warning when adding duplicate local versions', async () => {
      const wrapper = shallow(<AddVersionDialog appState={store} />);

      wrapper.setState({
        isValidElectron: true,
        folderPath: '/test/path',
        name: 'My Build',
        isValidName: true,
        existingLocalVersion: {
          version: '2.2.2',
          localPath: '/test/path',
        },
      });

      expect(wrapper).toMatchSnapshot();
    });
  });
});
