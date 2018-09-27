import { shallow } from 'enzyme';
import * as React from 'react';

import { AddressBar } from '../../../src/renderer/components/address-bar';
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
    wrapper.find('input').simulate('change', { target: { value: 'hi' } });

    expect(wrapper.state('value')).toBe('hi');
    expect(wrapper.find('input').html())
      .toBe('<input ' +
        'pattern="https:\\/\\/gist\\.github\\.com\\/(.+)$" ' +
        'placeholder="https://gist.github.com/..." ' +
        'value="hi"/>');
  });

  it('handles submit', () => {
    const oldLoadFiddle = AddressBar.prototype.loadFiddle;
    AddressBar.prototype.loadFiddle = jest.fn();
    const preventDefault = jest.fn();
    const wrapper = shallow(<AddressBar appState={store} />);

    wrapper.find('input').simulate('change', {
      target: { value: 'abcdtestid' }
    });
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

    store.gistId = 'abcdtestid';
    (global as any).window.confirm.mockReturnValueOnce(true);

    wrapper.find('input').simulate('change', {
      target: { value: 'abcdtestid' }
    });

    await (wrapper.instance() as AddressBar).loadFiddle();

    expect(wrapper.state('value')).toBe('abcdtestid');
    expect(document.title).toBe('Electron Fiddle - gist.github.com/abcdtestid');
  });
});
