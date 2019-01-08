import { shallow } from 'enzyme';
import * as React from 'react';

import { AddVersionDialog } from '../../../src/renderer/components/dialog-add-version';
import { overridePlatform, resetPlatform } from '../../utils';

describe('AddVersionDialog component', () => {
  let store: any;

  const mockFile = {
    path: '/test/file'
  };

  beforeAll(() => {
    // We render the buttons different depending on the
    // platform, so let' have a uniform platform for unit tests
    overridePlatform('darwin');
  });

  afterAll(() => {
    resetPlatform();
  });

  beforeEach(() => {
    store = {
      isAddVersionDialogShowing: true,
      addLocalVersion: jest.fn(),
      binaryManager: {
        getIsDownloaded: jest.fn()
      }
    };
  });

  it('renders', () => {
    const wrapper = shallow(<AddVersionDialog appState={store} />);

    wrapper.setState({
      isValidVersion: true,
      isValidElectron: true,
      file: mockFile
    });

    expect(wrapper).toMatchSnapshot();

    wrapper.setState({
      isValidVersion: false,
      isValidElectron: true,
      file: mockFile
    });

    expect(wrapper).toMatchSnapshot();
  });

  describe('onChangeFile()', () => {
    it('handles the change event', async () => {
      const wrapper = shallow(<AddVersionDialog appState={store} />);

      await (wrapper.instance() as any).onChangeFile({ target: { files: [ mockFile ] } });
      expect(wrapper.state('file')).toBe(mockFile);
    });

    it('handles invalid input', async () => {
      const wrapper = shallow(<AddVersionDialog appState={store} />);

      await (wrapper.instance() as any).onChangeFile({ target: { files: [] } });
      expect(wrapper.state('file')).toBe(undefined);
    });

    it('handles the change event and checks for Electron', async () => {
      const wrapper = shallow(<AddVersionDialog appState={store} />);

      store.binaryManager.getIsDownloaded.mockReturnValueOnce(false);

      await (wrapper.instance() as any).onChangeFile({ target: { files: [ mockFile ] } });
      expect(wrapper.state('file')).toBe(mockFile);
      expect(wrapper.state('isValidElectron')).toBe(false);
    });
  });

  describe('onChangeVersion()', () => {
    it('handles valid input', () => {
      const wrapper = shallow(<AddVersionDialog appState={store} />);

      (wrapper.instance() as any).onChangeVersion({ target: { value: '3.3.3' } });
      expect(wrapper.state('isValidVersion')).toBe(true);
      expect(wrapper.state('version')).toBe('3.3.3');
    });

    it('handles invalid input', () => {
      const wrapper = shallow(<AddVersionDialog appState={store} />);

      (wrapper.instance() as any).onChangeVersion({ target: { value: 'foo' } });
      expect(wrapper.state('isValidVersion')).toBe(false);
      expect(wrapper.state('version')).toBe('foo');

      (wrapper.instance() as any).onChangeVersion({ target: { } });
      expect(wrapper.state('isValidVersion')).toBe(false);
      expect(wrapper.state('version')).toBe('');
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
        version: '3.3.3',
        file: {
          path: '/test/path'
        }
      });

      await (wrapper.instance() as any).onSubmit();

      expect(store.addLocalVersion).toHaveBeenCalledTimes(1);

      const result = store.addLocalVersion.mock.calls[0][0];

      expect(result.localPath).toBe('/test/path');
      expect(result.version).toBe('3.3.3');
    });
  });
});
