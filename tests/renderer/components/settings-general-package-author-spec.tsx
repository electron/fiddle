import * as React from 'react';

import { InputGroup } from '@blueprintjs/core';
import { shallow } from 'enzyme';

import { PackageAuthorSettings } from '../../../src/renderer/components/settings-general-package-author';
import { AppState } from '../../../src/renderer/state';

describe('PackageAuthorSettings component', () => {
  let store: AppState;

  beforeEach(() => {
    ({ state: store } = window.ElectronFiddle.app);
  });

  it('renders', () => {
    const wrapper = shallow(<PackageAuthorSettings appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  describe('handlePackageAuthorChange()', () => {
    it('handles package author', async () => {
      const wrapper = shallow(<PackageAuthorSettings appState={store} />);
      const instance = wrapper.instance() as any;

      const author = 'electron<electron@electron.org>';

      await instance.handlePackageAuthorChange({
        currentTarget: { value: author },
      });

      expect(store.packageAuthor).toEqual(author);
      expect(instance.state.value).toEqual(author);

      await instance.handlePackageAuthorChange({
        currentTarget: { value: 'test' },
      });

      expect(store.packageAuthor).toEqual('test');
      expect(instance.state.value).toEqual('test');

      const event = { currentTarget: { value: 'test-onchange' } };
      wrapper.find(InputGroup).simulate('change', event);

      expect(store.packageAuthor).toEqual('test-onchange');
      expect(instance.state.value).toEqual('test-onchange');
    });
  });
});
