import * as electron from 'electron';
import { shallow } from 'enzyme';
import * as React from 'react';

import { TokenDialog } from '../../../src/renderer/components/token-dialog';
import { getOctokit } from '../../../src/utils/octokit';
import { overridePlatform, resetPlatform } from '../../utils';

jest.mock('../../../src/utils/octokit');

describe('TokenDialog component', () => {
  const mockValidToken = 'testtoken1234567890123456789012345678901';
  const mockInvalidToken = 'testtoken';

  beforeAll(() => {
    // We render the buttons different depending on the
    // platform, so let' have a uniform platform for unit tests
    overridePlatform('darwin');
  });

  afterAll(() => {
    resetPlatform();
  });

  beforeEach(() => {
    this.store = {
      isTokenDialogShowing: true
    };
  });

  it('renders', () => {
    const wrapper = shallow(<TokenDialog appState={this.store} />);

    expect(wrapper).toMatchSnapshot();
  });

  it('tries to read the clipboard on focus and enters it if valid', () => {
    const wrapper = shallow(<TokenDialog appState={this.store} />);

    (electron as any).clipboard.readText.mockReturnValueOnce(mockValidToken);

    wrapper.find('input').simulate('focus');
    expect((electron as any).clipboard.readText).toHaveBeenCalled();
    expect(wrapper.state('tokenInput')).toBe(mockValidToken);
  });

  it('tries to read the clipboard on focus and does not enter it if too short', () => {
    const wrapper = shallow(<TokenDialog appState={this.store} />);

    (electron as any).clipboard.readText.mockReturnValueOnce(mockInvalidToken);

    wrapper.find('input').simulate('focus');
    expect((electron as any).clipboard.readText).toHaveBeenCalled();
    expect(wrapper.state('tokenInput')).toBe(undefined);
  });

  it('tries to read the clipboard on focus and does not enter it if invalid', () => {
    const wrapper = shallow(<TokenDialog appState={this.store} />);

    (electron as any).clipboard.readText.mockReturnValueOnce('String with the right length not a token');

    wrapper.find('input').simulate('focus');
    expect((electron as any).clipboard.readText).toHaveBeenCalled();
    expect(wrapper.state('tokenInput')).toBe(undefined);
  });

  it('renders a spinner while verifying', () => {
    const wrapper = shallow(<TokenDialog appState={this.store} />);

    wrapper.setState({ verifying: true });
    expect(wrapper.find('.tokenSpinner').exists()).toBe(true);
  });

  it('renders a spinner while verifying', () => {
    const wrapper = shallow(<TokenDialog appState={this.store} />);

    wrapper.setState({ verifying: true });
    expect(wrapper.find('.tokenSpinner').exists()).toBe(true);
  });

  it('reset() resets the component', () => {
    const wrapper = shallow(<TokenDialog appState={this.store} />);

    wrapper.setState({ verifying: true, tokenInput: 'hello' });
    (wrapper.instance() as any).reset();

    expect(wrapper.state()).toEqual({
      verifying: false,
      error: false,
      tokenInput: ''
    });
  });

  it('reset() resets the component', () => {
    const wrapper = shallow(<TokenDialog appState={this.store} />);

    wrapper.setState({ verifying: true, tokenInput: 'hello' });
    (wrapper.instance() as any).reset();

    expect(wrapper.state()).toEqual({
      verifying: false,
      error: false,
      tokenInput: ''
    });
  });

  it('handleChange() handles the change event', () => {
    const wrapper = shallow(<TokenDialog appState={this.store} />);

    wrapper.setState({ verifying: true, tokenInput: 'hello' });
    wrapper.find('input').simulate('change', { target: { value: 'hi' } });

    expect(wrapper.state('tokenInput')).toBe('hi');
  });

  it('openGenerateTokenExternal() tries to open the link', () => {
    const wrapper = shallow(<TokenDialog appState={this.store} />);

    wrapper.setState({ verifying: true, tokenInput: 'hello' });
    (wrapper.instance() as any).openGenerateTokenExternal();

    expect(electron.shell.openExternal).toHaveBeenCalled();
  });

  it('onSubmitToken() tries to sign the user in', async () => {
    const mockUser = {
      avatar_url: 'https://avatars.fake/hi',
      login: 'test-login',
      name: 'Test User'
    };
    const mockOctokit = {
      authenticate: jest.fn(),
      users: {
        get: jest.fn(async () => ({ data: mockUser }))
      }
    };

    (getOctokit as any).mockReturnValue(mockOctokit);

    const wrapper = shallow(<TokenDialog appState={this.store} />);
    wrapper.setState({ tokenInput: mockValidToken });

    await (wrapper.instance() as any).onSubmitToken();

    expect(this.store.gitHubToken).toBe(mockValidToken);
    expect(this.store.gitHubLogin).toBe(mockUser.login);
    expect(this.store.gitHubName).toBe(mockUser.name);
    expect(this.store.gitHubAvatarUrl).toBe(mockUser.avatar_url);
  });

  it('onSubmitToken() handles an error', async () => {
    const mockUser = {
      avatar_url: 'https://avatars.fake/hi',
      login: 'test-login',
      name: 'Test User'
    };
    const mockOctokit = {
      authenticate: jest.fn(),
      users: {
        get: jest.fn(async () => ({ data: null }))
      }
    };

    (getOctokit as any).mockReturnValue(mockOctokit);

    const wrapper = shallow(<TokenDialog appState={this.store} />);
    wrapper.setState({ tokenInput: mockValidToken });

    await (wrapper.instance() as any).onSubmitToken();

    expect(wrapper.state('error')).toBe(true);
  });
});
