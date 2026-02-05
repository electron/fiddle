import * as React from 'react';

import { InputGroup } from '@blueprintjs/core';
import { shallow } from 'enzyme';
import { beforeEach, describe, expect, it } from 'vitest';

import { GistSettings } from '../../../src/renderer/components/settings-general-gist';
import { AppState } from '../../../src/renderer/state';

describe('PackageAuthorSettings component', () => {
  let store: AppState;

  beforeEach(() => {
    ({ state: store } = window.app);
  });

  it('renders', () => {
    const wrapper = shallow(<GistSettings appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  describe('handleGistHistoryChange()', () => {
    it('handles gist history', async () => {
      const wrapper = shallow(<GistSettings appState={store} />);
      const instance: any = wrapper.instance();

      instance.handleGistHistoryChange({
        currentTarget: { checked: true },
      } as React.FormEvent<HTMLInputElement>);

      expect(store.isShowingGistHistory).toEqual(true);
      expect(instance.state.isShowingGistHistory).toEqual(true);

      instance.handleGistHistoryChange({
        currentTarget: { checked: false },
      } as React.FormEvent<HTMLInputElement>);

      expect(store.isShowingGistHistory).toEqual(false);
      expect(instance.state.isShowingGistHistory).toEqual(false);
    });
  });

  describe('handlePackageAuthorChange()', () => {
    it('handles package author', async () => {
      const wrapper = shallow(<GistSettings appState={store} />);
      const instance: any = wrapper.instance();

      const author = 'electron<electron@electron.org>';

      instance.handlePackageAuthorChange({
        currentTarget: { value: author },
      } as React.FormEvent<HTMLInputElement>);

      expect(store.packageAuthor).toEqual(author);
      expect(instance.state.packageAuthor).toEqual(author);

      instance.handlePackageAuthorChange({
        currentTarget: { value: 'test' },
      } as React.FormEvent<HTMLInputElement>);

      expect(store.packageAuthor).toEqual('test');
      expect(instance.state.packageAuthor).toEqual('test');

      const event = { currentTarget: { value: 'test-onchange' } };
      wrapper.find(InputGroup).simulate('change', event);

      expect(store.packageAuthor).toEqual('test-onchange');
      expect(instance.state.packageAuthor).toEqual('test-onchange');
    });
  });
});
