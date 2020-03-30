import { shallow } from 'enzyme';
import * as React from 'react';

import { ConsoleSettings } from '../../../src/renderer/components/settings-general-console';

describe('ConsoleSettings component', () => {
  let store: any;

  beforeEach(() => {
    store = {};
  });

  it('renders', () => {
    const wrapper = shallow(
      <ConsoleSettings appState={store} />
    );
    expect(wrapper).toMatchSnapshot();
  });

  describe('handleClearOnRunChange()', () => {
    it('handles a new selection', async () => {
      const wrapper = shallow(
        <ConsoleSettings appState={store} />
      );
      const instance = wrapper.instance() as any;
      await instance.handleClearOnRunChange({
        currentTarget: { checked: false }
      });

      expect(store.isClearingConsoleOnRun).toBe(false);

      await instance.handleClearOnRunChange({
        currentTarget: { checked: true }
      });

      expect(store.isClearingConsoleOnRun).toBe(true);
    });
  });
});
