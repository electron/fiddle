import * as React from 'react';

import { InputGroup, Radio } from '@blueprintjs/core';
import { shallow } from 'enzyme';

import { MirrorSettings } from '../../../src/renderer/components/settings-general-mirror';
import { AppState } from '../../../src/renderer/state';

describe('MirrorSettings component', () => {
  let store: AppState;

  beforeEach(() => {
    ({ state: store } = window.app);
  });

  it('renders', () => {
    const wrapper = shallow(<MirrorSettings appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  describe('modifyMirror()', () => {
    it('modify mirror', async () => {
      const wrapper = shallow(<MirrorSettings appState={store} />);
      const instance: any = wrapper.instance();

      const [mirror, nightlyMirror] = ['mirror_test1', 'nightly_test2'];

      instance.modifyMirror(false, mirror);
      instance.modifyMirror(true, nightlyMirror);

      expect(store.electronMirror.sources.CUSTOM.electronMirror).toEqual(
        mirror,
      );

      expect(store.electronMirror.sources.CUSTOM.electronNightlyMirror).toEqual(
        nightlyMirror,
      );
    });
  });

  describe('changeSourceType()', () => {
    it('change source type', () => {
      const wrapper = shallow(<MirrorSettings appState={store} />);
      const instance: any = wrapper.instance();

      store.electronMirror.sourceType = 'DEFAULT';
      const event = { target: { value: 'CUSTOM' } };
      instance.changeSourceType(
        event as unknown as React.FormEvent<HTMLInputElement>,
      );

      expect(store.electronMirror.sourceType).toEqual('CUSTOM');
    });
  });

  describe('radio', () => {
    it('count should is 3', () => {
      const wrapper = shallow(<MirrorSettings appState={store} />);

      expect(wrapper.find(Radio)).toHaveLength(3);
    });

    it('order should is default -> china -> custom', () => {
      const wrapper = shallow(<MirrorSettings appState={store} />);

      expect(wrapper.find(Radio).at(0).props().label).toEqual('Default');
      expect(wrapper.find(Radio).at(0).props().value).toEqual('DEFAULT');

      expect(wrapper.find(Radio).at(1).props().label).toEqual('China');
      expect(wrapper.find(Radio).at(1).props().value).toEqual('CHINA');

      expect(wrapper.find(Radio).at(2).props().label).toEqual('Custom');
      expect(wrapper.find(Radio).at(2).props().value).toEqual('CUSTOM');
    });
  });

  describe('onClick()', () => {
    it('change electron mirror', () => {
      const wrapper = shallow(<MirrorSettings appState={store} />);

      store.electronMirror.sourceType = 'CUSTOM';

      const event = { target: { value: 'test_mirror' } };
      wrapper.find(InputGroup).at(0).simulate('change', event);

      expect(store.electronMirror.sources.CUSTOM.electronMirror).toEqual(
        'test_mirror',
      );
    });

    it('change electron nightly mirror', () => {
      const wrapper = shallow(<MirrorSettings appState={store} />);

      store.electronMirror.sourceType = 'CUSTOM';

      const event = { target: { value: 'test_nightly_mirror' } };
      wrapper.find(InputGroup).at(1).simulate('change', event);

      expect(store.electronMirror.sources.CUSTOM.electronNightlyMirror).toEqual(
        'test_nightly_mirror',
      );
    });
  });
});
