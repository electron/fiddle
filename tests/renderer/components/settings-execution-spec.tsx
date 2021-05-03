import { shallow } from 'enzyme';
import * as React from 'react';

import {
  ExecutionSettings,
  SettingItemType,
} from '../../../src/renderer/components/settings-execution';

describe('ExecutionSettings component', () => {
  let store: any;

  beforeEach(() => {
    store = {
      executionFlags: [],
      environmentVariables: [],
    };
  });

  it('renders', () => {
    const wrapper = shallow(<ExecutionSettings appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  describe('handleDeleteDataChange()', () => {
    it('handles a new selection', async () => {
      const wrapper = shallow(<ExecutionSettings appState={store} />);
      const instance = wrapper.instance() as any;
      await instance.handleDeleteDataChange({
        currentTarget: { checked: false },
      });

      expect(store.isKeepingUserDataDirs).toBe(false);

      await instance.handleDeleteDataChange({
        currentTarget: { checked: true },
      });

      expect(store.isKeepingUserDataDirs).toBe(true);
    });
  });

  describe('handleElectronLoggingChange()', () => {
    it('handles a new selection', async () => {
      const wrapper = shallow(<ExecutionSettings appState={store} />);
      const instance = wrapper.instance() as any;
      await instance.handleElectronLoggingChange({
        currentTarget: { checked: false },
      });

      expect(store.isEnablingElectronLogging).toBe(false);

      await instance.handleElectronLoggingChange({
        currentTarget: { checked: true },
      });

      expect(store.isEnablingElectronLogging).toBe(true);
    });
  });

  describe('handleItemSettingsChange()', () => {
    describe('with executionFlags', () => {
      it('updates when new flags are added', async () => {
        const wrapper = shallow(<ExecutionSettings appState={store} />);
        const instance = wrapper.instance() as any;

        const lang = '--lang=es';
        const flags = '--js-flags=--expose-gc';

        await instance.handleSettingsItemChange(
          {
            currentTarget: { name: '0', value: lang },
          },
          SettingItemType.Flags,
        );

        expect(instance.state.executionFlags).toEqual({ '0': lang });
        expect(store.executionFlags).toEqual([lang]);

        await instance.handleSettingsItemChange(
          {
            currentTarget: { name: '1', value: flags },
          },
          SettingItemType.Flags,
        );

        expect(instance.state.executionFlags).toEqual({
          '0': lang,
          '1': flags,
        });
        expect(store.executionFlags).toEqual([lang, flags]);
      });
    });

    describe('with environmentVariables', () => {
      it('updates when new flags are added', async () => {
        const wrapper = shallow(<ExecutionSettings appState={store} />);
        const instance = wrapper.instance() as any;

        const debug = 'ELECTRON_DEBUG_DRAG_REGIONS=1';
        const trash = 'ELECTRON_TRASH=trash-cli';

        await instance.handleSettingsItemChange(
          {
            currentTarget: {
              name: '0',
              value: debug,
            },
          },
          SettingItemType.EnvVars,
        );

        expect(instance.state.environmentVariables).toEqual({ '0': debug });
        expect(store.environmentVariables).toEqual([debug]);

        await instance.handleSettingsItemChange(
          {
            currentTarget: { name: '1', value: trash },
          },
          SettingItemType.EnvVars,
        );

        expect(instance.state.environmentVariables).toEqual({
          '0': debug,
          '1': trash,
        });
        expect(store.environmentVariables).toEqual([debug, trash]);
      });
    });
  });
});
