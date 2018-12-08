import { shallow } from 'enzyme';
import * as React from 'react';

import { AddressBar } from '../../../src/renderer/components/commands-address-bar';
import { getOctokit } from '../../../src/utils/octokit';

jest.mock('../../../src/utils/octokit');

describe('AddressBar component', () => {
  let store: any;

  beforeEach(() => {
    store = {
      gistId: null
    };
  });

  it('renders', () => {
    const wrapper = shallow(<AddressBar appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('handles change', () => {
    const wrapper = shallow(<AddressBar appState={store} />);
    const instance: AddressBar = wrapper.instance() as any;
    instance.handleChange({ target: { value: 'hi' } } as any);

    expect(wrapper.state('value')).toBe('hi');
  });

  it('handles submit', () => {
    const oldLoadFiddle = AddressBar.prototype.loadFiddle;
    AddressBar.prototype.loadFiddle = jest.fn();
    const preventDefault = jest.fn();
    const wrapper = shallow(<AddressBar appState={store} />);
    const instance: AddressBar = wrapper.instance() as any;

    instance.handleChange({ target: { value: 'abcdtestid' } } as any);
    wrapper.find('form').simulate('submit', { preventDefault });

    expect(wrapper.state('value')).toBe('abcdtestid');
    expect(preventDefault).toHaveBeenCalled();

    AddressBar.prototype.loadFiddle = oldLoadFiddle;
  });

  it('loadFiddle() loads a fiddle', async () => {
    (getOctokit as any).mockReturnValue({
      gists: {
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
      }
    });

    const wrapper = shallow(<AddressBar appState={store} />);
    const instance: AddressBar = wrapper.instance() as any;

    store.gistId = 'abcdtestid';
    (global as any).window.confirm.mockReturnValueOnce(true);

    instance.handleChange({ target: { value: 'abcdtestid' } } as any);
    await (wrapper.instance() as AddressBar).loadFiddle();

    expect(wrapper.state('value')).toBe('abcdtestid');
    expect(document.title).toBe('Electron Fiddle - gist.github.com/abcdtestid');
  });
});
