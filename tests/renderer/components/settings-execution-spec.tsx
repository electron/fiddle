import { shallow } from 'enzyme';
import * as React from 'react';

import { ExecutionSettings } from '../../../src/renderer/components/settings-execution';

describe('ExecutionSettings component', () => {
  let store: any;

  beforeEach(() => {
    store = {};
  });

  it('renders', () => {
    const wrapper = shallow(
      <ExecutionSettings appState={store} />
    );
    expect(wrapper).toMatchSnapshot();
  });

  describe('handleDeleteDataChange()', () => {
    it('handles a new selection', async () => {
      const wrapper = shallow(
        <ExecutionSettings appState={store} />
      );
      const instance = wrapper.instance() as any;
      await instance.handleDeleteDataChange({
        currentTarget: { checked: false }
      });

      expect(store.isKeepingUserDataDirs).toBe(false);

      await instance.handleDeleteDataChange({
        currentTarget: { checked: true }
      });

      expect(store.isKeepingUserDataDirs).toBe(true);
    });
  });

  describe('handleElectronLoggingChange()', () => {
    it('handles a new selection', async () => {
      const wrapper = shallow(
        <ExecutionSettings appState={store} />
      );
      const instance = wrapper.instance() as any;
      await instance.handleElectronLoggingChange({
        currentTarget: { checked: false }
      });

      expect(store.isEnablingElectronLogging).toBe(false);

      await instance.handleElectronLoggingChange({
        currentTarget: { checked: true }
      });

      expect(store.isEnablingElectronLogging).toBe(true);
    });
  });
});
