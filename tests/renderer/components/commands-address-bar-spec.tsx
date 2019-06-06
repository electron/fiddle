import { shallow } from 'enzyme';
import * as React from 'react';

import { AddressBar } from '../../../src/renderer/components/commands-address-bar';
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

describe('AddressBar component', () => {
  let store: any;

  beforeEach(() => {
    store = {
      gistId: null,
      setWarningDialogTexts: jest.fn(),
      toogleWarningDialog: jest.fn()
    };
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

  describe('loadFiddle()', () => {
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

    it('uses GitHub authentication when available', async () => {
      (getOctokit as jest.Mock).mockReturnValue({ gists: mockGists, authenticate: jest.fn() });

      const { authenticate } = await getOctokit();
      const wrapper = shallow(<AddressBar appState={store} />);
      const instance: AddressBar = wrapper.instance() as any;

      store.gistId = 'abcdtestid';
      store.gitHubToken = 'testToken';

      instance.handleChange({ target: { value: 'abcdtestid' } } as any);
      await (wrapper.instance() as AddressBar).fetchGistAndLoad('abcdtestid');

      expect(authenticate).toHaveBeenCalledTimes(1);
      expect((authenticate as jest.Mock).mock.calls[0][0]).toEqual({
        type: 'token',
        token: store.gitHubToken
      });
    });
  });
});
