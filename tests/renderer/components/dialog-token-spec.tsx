import * as React from 'react';

import * as electron from 'electron';
import { shallow } from 'enzyme';

import { TokenDialog } from '../../../src/renderer/components/dialog-token';
import { getOctokit } from '../../../src/utils/octokit';
import { StateMock } from '../../mocks/mocks';
import { overridePlatform, resetPlatform } from '../../utils';

jest.mock('../../../src/utils/octokit');

describe('TokenDialog component', () => {
  const mockValidToken = 'testtoken1234567890123456789012345678901';
  const mockInvalidToken = 'testtoken';
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
    /*
    store = {
      isTokenDialogShowing: true,
    };
    */
  });

  it('renders', () => {
    const wrapper = shallow(<TokenDialog appState={store as any} />);

    expect(wrapper).toMatchSnapshot();
  });

  it('tries to read the clipboard on focus and enters it if valid', () => {
    const wrapper = shallow(<TokenDialog appState={store as any} />);
    const instance: any = wrapper.instance() as any;

    (electron as any).clipboard.readText.mockReturnValueOnce(mockValidToken);
    instance.onTokenInputFocused();

    expect((electron as any).clipboard.readText).toHaveBeenCalled();
    expect(wrapper.state('tokenInput')).toBe(mockValidToken);
  });

  it('tries to read the clipboard on focus and does not enter it if too short', () => {
    const wrapper = shallow(<TokenDialog appState={store as any} />);
    const instance: any = wrapper.instance() as any;

    (electron as any).clipboard.readText.mockReturnValueOnce(mockInvalidToken);
    instance.onTokenInputFocused();

    expect((electron as any).clipboard.readText).toHaveBeenCalled();
    expect(wrapper.state('tokenInput')).toBe('');
  });

  it('tries to read the clipboard on focus and does not enter it if invalid', () => {
    const wrapper = shallow(<TokenDialog appState={store as any} />);
    const instance: any = wrapper.instance() as any;

    (electron as any).clipboard.readText.mockReturnValueOnce(
      'String with the right length not a token',
    );
    instance.onTokenInputFocused();

    expect((electron as any).clipboard.readText).toHaveBeenCalled();
    expect(wrapper.state('tokenInput')).toBe('');
  });

  it('tries to read the clipboard on focus and does not enter it if invalid', () => {
    const wrapper = shallow(<TokenDialog appState={store as any} />);
    const instance: any = wrapper.instance() as any;

    (electron as any).clipboard.readText.mockReturnValueOnce(undefined);
    instance.onTokenInputFocused();

    expect((electron as any).clipboard.readText).toHaveBeenCalled();
    expect(wrapper.state('tokenInput')).toBe('');
  });

  it('reset() resets the component', () => {
    const wrapper = shallow(<TokenDialog appState={store as any} />);
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
    const wrapper = shallow(<TokenDialog appState={store as any} />);
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
    const wrapper = shallow(<TokenDialog appState={store as any} />);
    wrapper.setState({ verifying: true, tokenInput: 'hello' });

    const instance: any = wrapper.instance() as any;
    instance.handleChange({ target: { value: 'hi' } } as any);

    expect(wrapper.state('tokenInput')).toBe('hi');
  });

  it('openGenerateTokenExternal() tries to open the link', () => {
    const wrapper = shallow(<TokenDialog appState={store as any} />);
    const instance: any = wrapper.instance() as any;

    wrapper.setState({ verifying: true, tokenInput: 'hello' });
    instance.openGenerateTokenExternal();

    expect(electron.shell.openExternal).toHaveBeenCalled();
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

      (getOctokit as any).mockReturnValue(mockOctokit);
    });

    it('handles missing input', async () => {
      const wrapper = shallow(<TokenDialog appState={store as any} />);
      wrapper.setState({ tokenInput: '' });
      const instance: any = wrapper.instance() as any;

      await instance.onSubmitToken();

      expect(instance.state.verifying).toBe(false);
    });

    it('tries to sign the user in', async () => {
      const wrapper = shallow(<TokenDialog appState={store as any} />);
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

      const wrapper = shallow(<TokenDialog appState={store as any} />);
      wrapper.setState({ tokenInput: mockValidToken });
      const instance: any = wrapper.instance() as any;

      await instance.onSubmitToken();

      expect(wrapper.state('error')).toBe(true);
      expect(store.gitHubToken).toEqual(null);
    });
  });
});
