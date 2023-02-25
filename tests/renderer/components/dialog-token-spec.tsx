import * as React from 'react';

import { shallow } from 'enzyme';

import { TokenDialog } from '../../../src/renderer/components/dialog-token';
import { AppState } from '../../../src/renderer/state';
import { getOctokit } from '../../../src/utils/octokit';
import { overrideRendererPlatform } from '../../utils';

jest.mock('../../../src/utils/octokit');

describe('TokenDialog component', () => {
  const mockValidToken = 'ghp_muuHkYenGrOHrTBQKDALW8WtSD929EXMz63n';
  const mockInvalidToken = 'testtoken';
  let store: AppState;

  beforeEach(() => {
    // We render the buttons different depending on the
    // platform, so let' have a uniform platform for unit tests
    overrideRendererPlatform('darwin');

    ({ state: store } = window.ElectronFiddle.app);
    /*
    store = {
      isTokenDialogShowing: true,
    };
    */
  });

  it('renders', () => {
    const wrapper = shallow(<TokenDialog appState={store} />);

    expect(wrapper).toMatchSnapshot();
  });

  it('tries to read the clipboard on focus and enters it if valid', async () => {
    const wrapper = shallow(<TokenDialog appState={store} />);
    const instance: any = wrapper.instance() as any;

    (window.navigator.clipboard.readText as jest.Mock).mockResolvedValueOnce(
      mockValidToken,
    );
    await instance.onTokenInputFocused();

    expect(window.navigator.clipboard.readText as jest.Mock).toHaveBeenCalled();
    expect(wrapper.state('tokenInput')).toBe(mockValidToken);
  });

  it('tries to read the clipboard on focus and does not enter it if too short', async () => {
    const wrapper = shallow(<TokenDialog appState={store} />);
    const instance: any = wrapper.instance() as any;

    (window.navigator.clipboard.readText as jest.Mock).mockResolvedValueOnce(
      mockInvalidToken,
    );
    await instance.onTokenInputFocused();

    expect(window.navigator.clipboard.readText as jest.Mock).toHaveBeenCalled();
    expect(wrapper.state('tokenInput')).toBe('');
  });

  it('tries to read the clipboard on focus and does not enter it if invalid', async () => {
    const wrapper = shallow(<TokenDialog appState={store} />);
    const instance: any = wrapper.instance() as any;

    (window.navigator.clipboard.readText as jest.Mock).mockResolvedValueOnce(
      'String with the right length not a token',
    );
    await instance.onTokenInputFocused();

    expect(window.navigator.clipboard.readText as jest.Mock).toHaveBeenCalled();
    expect(wrapper.state('tokenInput')).toBe('');
  });

  it('tries to read the clipboard on focus and does not enter it if invalid', async () => {
    const wrapper = shallow(<TokenDialog appState={store} />);
    const instance: any = wrapper.instance() as any;

    (window.navigator.clipboard.readText as jest.Mock).mockResolvedValueOnce(
      'invalid',
    );
    await instance.onTokenInputFocused();

    expect(window.navigator.clipboard.readText as jest.Mock).toHaveBeenCalled();
    expect(wrapper.state('tokenInput')).toBe('');
  });

  it('reset() resets the component', () => {
    const wrapper = shallow(<TokenDialog appState={store} />);
    const instance: any = wrapper.instance() as any;

    wrapper.setState({ verifying: true, tokenInput: 'hello' });
    instance.reset();

    expect(wrapper.state()).toEqual({
      verifying: false,
      error: false,
      tokenInput: '',
    });
  });

  it('onClose() resets the component', () => {
    const wrapper = shallow(<TokenDialog appState={store} />);
    const instance: any = wrapper.instance() as any;

    wrapper.setState({ verifying: true, tokenInput: 'hello' });
    instance.onClose();

    expect(wrapper.state()).toEqual({
      verifying: false,
      error: false,
      tokenInput: '',
    });
  });

  it('handleChange() handles the change event', () => {
    const wrapper = shallow(<TokenDialog appState={store} />);
    wrapper.setState({ verifying: true, tokenInput: 'hello' });

    const instance: any = wrapper.instance() as any;
    instance.handleChange({ target: { value: 'hi' } } as any);

    expect(wrapper.state('tokenInput')).toBe('hi');
  });

  it('openGenerateTokenExternal() tries to open the link', () => {
    const wrapper = shallow(<TokenDialog appState={store} />);
    const instance: any = wrapper.instance() as any;

    wrapper.setState({ verifying: true, tokenInput: 'hello' });
    instance.openGenerateTokenExternal();

    expect(window.open as jest.Mock).toHaveBeenCalled();
  });

  describe('onSubmitToken()', () => {
    let mockOctokit: any;
    const mockUser = {
      avatar_url: 'https://avatars.fake/hi',
      login: 'test-login',
      name: 'Test User',
    } as const;

    beforeEach(() => {
      mockOctokit = {
        authenticate: jest.fn(),
        users: {
          getAuthenticated: jest.fn().mockResolvedValue({ data: mockUser }),
        },
      };

      (getOctokit as jest.Mock).mockReturnValue(mockOctokit);
    });

    it('handles missing input', async () => {
      const wrapper = shallow(<TokenDialog appState={store} />);
      wrapper.setState({ tokenInput: '' });
      const instance: any = wrapper.instance() as any;

      await instance.onSubmitToken();

      expect(instance.state.verifying).toBe(false);
    });

    it('tries to sign the user in', async () => {
      const wrapper = shallow(<TokenDialog appState={store} />);
      wrapper.setState({ tokenInput: mockValidToken });
      const instance: any = wrapper.instance() as any;

      await instance.onSubmitToken();

      expect(store.gitHubToken).toBe(mockValidToken);
      expect(store.gitHubLogin).toBe(mockUser.login);
      expect(store.gitHubName).toBe(mockUser.name);
      expect(store.gitHubAvatarUrl).toBe(mockUser.avatar_url);
    });

    it('handles an error', async () => {
      mockOctokit.users.getAuthenticated.mockReturnValue({ data: null });

      const wrapper = shallow(<TokenDialog appState={store} />);
      wrapper.setState({ tokenInput: mockValidToken });
      const instance: any = wrapper.instance() as any;

      await instance.onSubmitToken();

      expect(wrapper.state('error')).toBe(true);
      expect(store.gitHubToken).toEqual(null);
    });
  });
});
