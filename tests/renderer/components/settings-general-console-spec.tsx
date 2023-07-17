import * as React from 'react';

import { shallow } from 'enzyme';

import { ConsoleSettings } from '../../../src/renderer/components/settings-general-console';
import { AppState } from '../../../src/renderer/state';

describe('ConsoleSettings component', () => {
  let store: AppState;

  beforeEach(() => {
    store = {} as AppState;
  });

  it('renders', () => {
    const wrapper = shallow(<ConsoleSettings appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  describe('handleClearOnRunChange()', () => {
    it('handles a new selection', async () => {
      const wrapper = shallow(<ConsoleSettings appState={store} />);
      const instance: any = wrapper.instance();
      instance.handleClearOnRunChange({
        currentTarget: { checked: false },
      } as React.FormEvent<HTMLInputElement>);

      expect(store.isClearingConsoleOnRun).toBe(false);

      instance.handleClearOnRunChange({
        currentTarget: { checked: true },
      } as React.FormEvent<HTMLInputElement>);

      expect(store.isClearingConsoleOnRun).toBe(true);
    });
  });
});
