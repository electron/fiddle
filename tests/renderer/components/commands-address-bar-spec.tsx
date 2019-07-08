import { shallow } from 'enzyme';
import * as React from 'react';

import { observable } from 'mobx';
import { AddressBar } from '../../../src/renderer/components/commands-address-bar';
import { INDEX_HTML_NAME, MAIN_JS_NAME, RENDERER_JS_NAME } from '../../../src/shared-constants';
import { getOctokit } from '../../../src/utils/octokit';
import { MockState } from '../../mocks/state';

jest.mock('../../../src/utils/octokit');

const mockGists = {
  get: async () => ({
    data: {
      files: {
        'renderer.js': {
          content: 'renderer-content'
        },
        'main.js': {
          content: 'main-content'
        },
        'index.html': {
          content: 'html'
        }
      }
    }
  })
};

const mockRepos = {
  getContents: async () => ({
    data: [
      {
        name: MAIN_JS_NAME,
        download_url: 'https://main'
      }, {
        name: RENDERER_JS_NAME,
        download_url: 'https://renderer'
      }, {
        name: INDEX_HTML_NAME,
        download_url: 'https://html'
      }, {
        name: 'other_stuff',
        download_url: 'https://google.com'
      }
    ]
  })
};

describe('AddressBar component', () => {
  let store: any;

  class MockStore {
    @observable public gistId: string | null = null;
    @observable public isWarningDialogShowing: boolean = false;
    public setWarningDialogTexts = jest.fn();
    public toogleWarningDialog = jest.fn();
  }

  beforeEach(() => {
    store = new MockStore();
  });

  it('renders', () => {
    const wrapper = shallow(<AddressBar appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('uses an existing gistId as state', () => {
    store.gistId = 'hi';

    const wrapper = shallow(<AddressBar appState={store} />);
    expect((wrapper.state() as any).value).toBe('https://gist.github.com/hi');
  });

  it('handles change', () => {
    const wrapper = shallow(<AddressBar appState={store} />);
    const instance: AddressBar = wrapper.instance() as any;
    instance.handleChange({ target: { value: 'hi' } } as any);

    expect(wrapper.state('value')).toBe('hi');
  });

  it('handles an external state change', () => {
    const mockStore = new MockState() as any;
    const wrapper = shallow(<AddressBar appState={mockStore} />);

    mockStore.gistId = 'hi';

    expect((wrapper.state() as any).value).toBe('https://gist.github.com/hi');
  });

  it('handles submit', () => {
    const oldLoadFiddle = AddressBar.prototype.fetchGistAndLoad;
    AddressBar.prototype.fetchGistAndLoad = jest.fn();
    const preventDefault = jest.fn();
    const wrapper = shallow(<AddressBar appState={store} />);
    const instance: AddressBar = wrapper.instance() as any;

    instance.handleChange({ target: { value: 'abcdtestid' } } as any);
    wrapper.find('form').simulate('submit', { preventDefault });

    expect(wrapper.state('value')).toBe('abcdtestid');
    expect(preventDefault).toHaveBeenCalled();

    AddressBar.prototype.fetchGistAndLoad = oldLoadFiddle;
  });

  it('disables during gist publishing', async () => {
    const wrapper = shallow(<AddressBar appState={store} />);

    wrapper.setProps({appState: {...store, isPublishing: true}}, () => {
      expect(wrapper.find('fieldset').prop('disabled')).toBe(true);
    });

    wrapper.setProps({appState: {...store, isPublishing: false}}, () => {
      expect(wrapper.find('fieldset').prop('disabled')).toBe(false);
    });
  });

  describe('fetchGistAndLoad()', () => {
    it('loads a fiddle', async () => {
      (getOctokit as jest.Mock).mockReturnValue({ gists: mockGists });

      const wrapper = shallow(<AddressBar appState={store} />);
      const instance: AddressBar = wrapper.instance() as any;

      store.gistId = 'abcdtestid';

      instance.handleChange({ target: { value: 'abcdtestid' } } as any);
      await (wrapper.instance() as AddressBar).fetchGistAndLoad('abcdtestid');

      expect(wrapper.state('value')).toBe('abcdtestid');
      expect(document.title).toBe('Electron Fiddle - gist.github.com/abcdtestid');
    });

    it('handles an error', async () => {
      (getOctokit as jest.Mock).mockReturnValue({
        gists: {
          get: async () => {
            throw new Error('Bwap bwap');
          }
        }
      });

      const wrapper = shallow(<AddressBar appState={store} />);
      const result = await (wrapper.instance() as AddressBar).fetchGistAndLoad('abcdtestid');

      expect(result).toBe(false);
    });
  });

  describe('fetchExampleAndLoad()', () => {
    it('loads an Electron exmaple', async () => {
      (getOctokit as jest.Mock).mockReturnValue({ repos: mockRepos });

      const wrapper = shallow(<AddressBar appState={store} />);
      const instance: AddressBar = wrapper.instance() as any;

      // Setup the mock
      (fetch as any).mockResponses(
        [ 'main' ],
        [ 'renderer' ],
        [ 'index' ]
      );

      await instance.fetchExampleAndLoad('4.0.0', 'test/path');

      expect(document.title).toBe('Electron Fiddle - Unsaved');
      const { calls } = (window.ElectronFiddle.app.setValues as any).mock;

      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual([{
        html: 'index',
        main: 'main',
        renderer: 'renderer'
      }]);
    });

    it('handles an error', async () => {
      (getOctokit as jest.Mock).mockReturnValue({
        repos: {
          getContents: async () => {
            throw new Error('Bwap bwap');
          }
        }
      });

      const wrapper = shallow(<AddressBar appState={store} />);
      const instance: AddressBar = wrapper.instance() as any;

      // Setup the mock
      (fetch as any).mockResponses(
        [ 'main' ],
        [ 'renderer' ],
        [ 'index' ]
      );

      const result = await instance.fetchExampleAndLoad('4.0.0', 'test/path');
      expect(result).toBe(false);
    });

    it('handles incorrect results', async () => {
      (getOctokit as jest.Mock).mockReturnValue({
        repos: {
          getContents: async () => ({
            not_an_array: true
          })
        }
      });

      const wrapper = shallow(<AddressBar appState={store} />);
      const instance: AddressBar = wrapper.instance() as any;

      // Setup the mock
      (fetch as any).mockResponses(
        [ 'main' ],
        [ 'renderer' ],
        [ 'index' ]
      );

      const result = await instance.fetchExampleAndLoad('4.0.0', 'test/path');
      expect(result).toBe(false);
      expect(store.setWarningDialogTexts.mock.calls[0][0].label).toEqual(
        'Loading the fiddle failed: Error: The example Fiddle tried to launch is not a valid Electron example'
      );
    });
  });

  describe('verifyRemoteLoad()', () => {
    it('asks the user if they want to load remote content', (done) => {
      const mockStore: any = new MockStore();
      const wrapper = shallow(<AddressBar appState={mockStore} />);
      const instance: AddressBar = wrapper.instance() as any;

      instance.verifyRemoteLoad('test').then(done);

      expect(mockStore.isWarningDialogShowing).toBe(true);
      mockStore.isWarningDialogShowing = false;
    });
  });

  describe('verifyRemoteLoad()', () => {
    it('asks the user if they want to load remote content', (done) => {
      const wrapper = shallow(<AddressBar appState={store} />);
      const instance: AddressBar = wrapper.instance() as any;

      instance.verifyRemoteLoad('test').then(done);

      expect(store.isWarningDialogShowing).toBe(true);
      store.isWarningDialogShowing = false;
    });
  });

  describe('loadFiddleFromElectronExample()', () => {
    it('loads the example with confirmation', async () => {
      const wrapper = shallow(<AddressBar appState={store} />);
      const instance: AddressBar = wrapper.instance() as any;

      instance.verifyRemoteLoad = jest.fn().mockReturnValue(true);
      instance.fetchExampleAndLoad = jest.fn();
      await instance.loadFiddleFromElectronExample(
        {},
        { path: 'test/path', ref: '4.0.0' }
      );

      expect(instance.verifyRemoteLoad).toHaveBeenCalled();
      expect(instance.fetchExampleAndLoad).toHaveBeenCalledWith('4.0.0', 'test/path');
    });

    it('does not load the example without confirmation', async () => {
      const wrapper = shallow(<AddressBar appState={store} />);
      const instance: AddressBar = wrapper.instance() as any;

      instance.verifyRemoteLoad = jest.fn().mockReturnValue(false);
      instance.fetchExampleAndLoad = jest.fn();
      await instance.loadFiddleFromElectronExample(
        {},
        { path: 'test/path', ref: '4.0.0' }
      );

      expect(instance.verifyRemoteLoad).toHaveBeenCalled();
      expect(instance.fetchExampleAndLoad).toHaveBeenCalledTimes(0);
    });
  });

  describe('loadFiddleFromGist()', () => {
    it('loads the example with confirmation', async () => {
      const wrapper = shallow(<AddressBar appState={store} />);
      const instance: AddressBar = wrapper.instance() as any;

      instance.verifyRemoteLoad = jest.fn().mockReturnValue(true);
      instance.fetchGistAndLoad = jest.fn();
      await instance.loadFiddleFromGist(
        {},
        { id: 'gist' }
      );

      expect(instance.verifyRemoteLoad).toHaveBeenCalled();
      expect(instance.fetchGistAndLoad).toHaveBeenCalledWith('gist');
    });

    it('does not load the example without confirmation', async () => {
      const wrapper = shallow(<AddressBar appState={store} />);
      const instance: AddressBar = wrapper.instance() as any;

      instance.verifyRemoteLoad = jest.fn().mockReturnValue(false);
      instance.fetchGistAndLoad = jest.fn();
      await instance.loadFiddleFromGist(
        {},
        { id: 'gist' }
      );

      expect(instance.verifyRemoteLoad).toHaveBeenCalled();
      expect(instance.fetchGistAndLoad).toHaveBeenCalledTimes(0);
    });
  });
});
