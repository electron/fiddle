import * as React from 'react';

import { shallow } from 'enzyme';

import { FontSettings } from '../../../src/renderer/components/settings-general-font';

describe('FontSettings component', () => {
  let store: any;

  beforeEach(() => {
    store = {
      fontSize: undefined,
      fontFamily: undefined,
    };
  });

  it('renders', () => {
    const wrapper = shallow(<FontSettings appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  describe('handleSetFontFamily()', () => {
    it('handles a new selection', async () => {
      const wrapper = shallow(<FontSettings appState={store} />);
      const instance = wrapper.instance() as any;

      const CALIBRI = 'Calibri';
      const VERDANA = 'Verdana';
      await instance.handleSetFontFamily({
        currentTarget: { value: CALIBRI },
      });

      expect(store.fontFamily).toBe(CALIBRI);
      expect(instance.state.fontFamily).toEqual(CALIBRI);

      await instance.handleSetFontFamily({
        currentTarget: { value: VERDANA },
      });

      expect(store.fontFamily).toBe(VERDANA);
      expect(instance.state.fontFamily).toEqual(VERDANA);
    });
  });

  describe('handleSetFontSize()', () => {
    it('handles a new selection', async () => {
      const wrapper = shallow(<FontSettings appState={store} />);
      const instance = wrapper.instance() as any;
      await instance.handleSetFontSize({
        currentTarget: { value: '12' },
      });

      expect(store.fontSize).toBe(12);
      expect(instance.state.fontSize).toEqual(12);

      await instance.handleSetFontSize({
        currentTarget: { value: '10' },
      });

      expect(store.fontSize).toBe(10);
      expect(instance.state.fontSize).toEqual(10);
    });
  });
});
