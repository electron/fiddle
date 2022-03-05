import { shallow } from 'enzyme';
import * as React from 'react';

import { MirrorSettings } from '../../../src/renderer/components/settings-general-mirror';

import { StateMock } from '../../mocks/mocks';
import { InputGroup, MenuItem } from '@blueprintjs/core';
import { ELECTRON_MIRRORS } from '../../../src/renderer/mirror-constants';

describe('MirrorSettings component', () => {
  let store: StateMock;

  beforeEach(() => {
    ({ state: store } = (window as any).ElectronFiddle.app);
  });

  it('renders', () => {
    const wrapper = shallow(<MirrorSettings appState={store as any} />);
    expect(wrapper).toMatchSnapshot();
  });

  describe('setMirror()', () => {
    it('set mirror', async () => {
      const wrapper = shallow(<MirrorSettings appState={store as any} />);
      const instance = wrapper.instance() as any;

      const [mirror, nightlyMirror] = ['mirror_test1', 'nightly_test2'];

      instance.setMirror(false, mirror);
      instance.setMirror(true, nightlyMirror);

      expect(store.electronMirrors.electronMirror).toEqual(mirror);
      expect(instance.state.electronMirror).toEqual(mirror);

      expect(store.electronMirrors.electronNightlyMirror).toEqual(
        nightlyMirror,
      );
      expect(instance.state.electronNightlyMirror).toEqual(nightlyMirror);
    });
  });

  describe('onChange()', () => {
    it('change input', async () => {
      const wrapper = shallow(<MirrorSettings appState={store as any} />);
      const instance = wrapper.instance() as any;

      const [mirror, nightlyMirror] = ['mirror_test3', 'nightly_test4'];

      {
        const event = { currentTarget: { value: mirror } };
        wrapper.find(InputGroup).at(0).simulate('change', event);

        expect(store.electronMirrors.electronMirror).toEqual(mirror);
        expect(instance.state.electronMirror).toEqual(mirror);
      }

      {
        const event = { currentTarget: { value: nightlyMirror } };
        wrapper.find(InputGroup).at(1).simulate('change', event);

        expect(store.electronMirrors.electronNightlyMirror).toEqual(
          nightlyMirror,
        );
        expect(instance.state.electronNightlyMirror).toEqual(nightlyMirror);
      }
    });
  });

  describe('onClick()', () => {
    it('click preset values', async () => {
      const wrapper = shallow(<MirrorSettings appState={store as any} />);
      const instance = wrapper.instance() as any;

      {
        const MenuWrapper = shallow(
          instance.selectMirrorMenu(false).props.content,
        ).find(MenuItem);

        MenuWrapper.at(1).simulate('click');

        expect(store.electronMirrors.electronMirror).toEqual(
          ELECTRON_MIRRORS.CHINA.electronMirror,
        );
        expect(instance.state.electronMirror).toEqual(
          ELECTRON_MIRRORS.CHINA.electronMirror,
        );

        MenuWrapper.at(0).simulate('click');

        expect(store.electronMirrors.electronMirror).toEqual(
          ELECTRON_MIRRORS.DEFAULT.electronMirror,
        );
        expect(instance.state.electronMirror).toEqual(
          ELECTRON_MIRRORS.DEFAULT.electronMirror,
        );
      }

      {
        const MenuWrapper = shallow(
          instance.selectMirrorMenu(true).props.content,
        ).find(MenuItem);

        MenuWrapper.at(1).simulate('click');

        expect(store.electronMirrors.electronNightlyMirror).toEqual(
          ELECTRON_MIRRORS.CHINA.electronNightlyMirror,
        );
        expect(instance.state.electronNightlyMirror).toEqual(
          ELECTRON_MIRRORS.CHINA.electronNightlyMirror,
        );

        MenuWrapper.at(0).simulate('click');

        expect(store.electronMirrors.electronNightlyMirror).toEqual(
          ELECTRON_MIRRORS.DEFAULT.electronNightlyMirror,
        );
        expect(instance.state.electronNightlyMirror).toEqual(
          ELECTRON_MIRRORS.DEFAULT.electronNightlyMirror,
        );
      }
    });
  });
});
