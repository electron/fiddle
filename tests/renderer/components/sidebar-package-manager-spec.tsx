import { Button } from '@blueprintjs/core';
import { mount, shallow } from 'enzyme';
import * as React from 'react';
import { SidebarPackageManager } from '../../../src/renderer/components/sidebar-package-manager';

describe('SidebarPackageManager component', () => {
  let store: any;
  beforeEach(() => {
    store = {
      modules: new Map<string, string>([['cow', '*']]),
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
      search: 'say',
    };

    (instance as any).addPackageToSearch({
      key: 'Enter',
    });

    expect(
      Array.from((store.modules as Map<string, string>).entries()),
    ).toMatchSnapshot([
      ['cow', '*'],
      ['say', '*'],
    ]);
  });

  it('can remove a package', () => {
    const wrapper = mount(<SidebarPackageManager appState={store} />);
    const instance = wrapper.instance();
    instance.state = {
      search: 'say',
    };

    const btn = wrapper.find(Button);
    btn.simulate('click');
    expect((store.modules as Map<string, string>).size).toBe(0);
  });
});
