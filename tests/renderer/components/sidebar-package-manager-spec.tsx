import * as React from 'react';

import { Button } from '@blueprintjs/core';
import { mount, shallow } from 'enzyme';

import { SidebarPackageManager } from '../../../src/renderer/components/sidebar-package-manager';

jest.mock('../../../src/renderer/npm-search', () => ({
  npmSearch: {
    // this is just enough mocking to hit the right code paths
    // by stubbing out the npmSearch utility.
    search: () => ({
      hits: [
        {
          versions: ['1.0.0'],
        },
      ],
    }),
  },
}));

describe('SidebarPackageManager component', () => {
  let store: any;
  beforeEach(() => {
    store = {
      modules: new Map<string, string>([['cow', '1.0.0']]),
    };
  });

  it('renders', () => {
    const wrapper = shallow(<SidebarPackageManager appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('can add a package', () => {
    const wrapper = shallow(<SidebarPackageManager appState={store} />);
    const instance = wrapper.instance();
    instance.state = {
      suggestions: [],
      versionsCache: new Map(),
    };

    (instance as any).addModuleToFiddle({
      name: 'say',
      version: '2.0.0',
      versions: ['1.0.0', '2.0.0'],
    });

    expect(
      Array.from((store.modules as Map<string, string>).entries()),
    ).toMatchSnapshot([
      ['cow', '1.0.0'],
      ['say', '2.0.0'],
    ]);
  });

  it('can remove a package', async () => {
    const wrapper = mount(<SidebarPackageManager appState={store} />);

    const instance = wrapper.instance();
    instance.state = {
      suggestions: [],
      versionsCache: new Map(),
    };

    const btn = wrapper.find(Button);
    btn.simulate('click');
    expect((store.modules as Map<string, string>).size).toBe(0);

    // dumb timeout for setState to finish running
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });
});
