import * as React from 'react';

import { shallow } from 'enzyme';

import { FontSettings } from '../../../src/renderer/components/settings-general-font';
import { AppState } from '../../../src/renderer/state';

describe('FontSettings component', () => {
  let store: AppState;

  beforeEach(() => {
    store = {
      fontSize: undefined,
      fontFamily: undefined,
    } as AppState;
  });

  it('renders', () => {
    const wrapper = shallow(<FontSettings appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  describe('handleSetFontFamily()', () => {
    it('handles a new selection', async () => {
      const wrapper = shallow(<FontSettings appState={store} />);
      const instance: any = wrapper.instance();

      const CALIBRI = 'Calibri';
      const VERDANA = 'Verdana';
      instance.handleSetFontFamily({
        currentTarget: { value: CALIBRI },
      } as React.FormEvent<HTMLInputElement>);

      expect(store.fontFamily).toBe(CALIBRI);
      expect(instance.state.fontFamily).toEqual(CALIBRI);

      instance.handleSetFontFamily({
        currentTarget: { value: VERDANA },
      } as React.FormEvent<HTMLInputElement>);

      expect(store.fontFamily).toBe(VERDANA);
      expect(instance.state.fontFamily).toEqual(VERDANA);
    });
  });

  describe('handleSetFontSize()', () => {
    it('handles a new selection', async () => {
      const wrapper = shallow(<FontSettings appState={store} />);
      const instance: any = wrapper.instance();
      instance.handleSetFontSize({
        currentTarget: { value: '12' },
      } as React.FormEvent<HTMLInputElement>);

      expect(store.fontSize).toBe(12);
      expect(instance.state.fontSize).toEqual(12);

      instance.handleSetFontSize({
        currentTarget: { value: '10' },
      } as React.FormEvent<HTMLInputElement>);

      expect(store.fontSize).toBe(10);
      expect(instance.state.fontSize).toEqual(10);
    });

    it('handles being cleared', async () => {
      const wrapper = shallow(<FontSettings appState={store} />);
      const instance: any = wrapper.instance();
      instance.handleSetFontSize({
        currentTarget: { value: '' },
      } as React.FormEvent<HTMLInputElement>);

      expect(store.fontSize).toBeUndefined();
      expect(instance.state.fontSize).toBeUndefined();
    });
  });
});
