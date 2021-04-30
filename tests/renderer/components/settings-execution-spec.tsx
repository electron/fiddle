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

        await instance.handleSettingsItemChange(
          {
            currentTarget: { name: 'flag-0', value: '--lang=es' },
          },
          SettingItemType.Flag,
        );

        expect(instance.state.executionFlags).toEqual({
          'flag-0': '--lang=es',
        });

        await instance.handleSettingsItemChange(
          {
            currentTarget: { name: 'flag-1', value: '--js-flags=--expose-gc' },
          },
          SettingItemType.Flag,
        );

        expect(instance.state.executionFlags).toEqual({
          'flag-0': '--lang=es',
          'flag-1': '--js-flags=--expose-gc',
        });
      });

      it('saves properly', async () => {
        const wrapper = shallow(<ExecutionSettings appState={store} />);
        const instance = wrapper.instance() as any;

        instance.setState({
          executionFlags: {
            'flag-0': '--lang=es',
            'flag-1': '--js-flags=--expose-gc',
          },
        });

        await instance.handleSettingsItemSave(SettingItemType.Flag);
        expect(store.executionFlags).toEqual([
          '--lang=es',
          '--js-flags=--expose-gc',
        ]);
      });
    });

    describe('with environmentVariables', () => {
      it('updates when new flags are added', async () => {
        const wrapper = shallow(<ExecutionSettings appState={store} />);
        const instance = wrapper.instance() as any;

        await instance.handleSettingsItemChange(
          {
            currentTarget: {
              name: 'var-0',
              value: 'ELECTRON_DEBUG_DRAG_REGIONS=1',
            },
          },
          SettingItemType.EnvVar,
        );

        expect(instance.state.environmentVariables).toEqual({
          'var-0': 'ELECTRON_DEBUG_DRAG_REGIONS=1',
        });

        await instance.handleSettingsItemChange(
          {
            currentTarget: { name: 'var-1', value: 'ELECTRON_TRASH=trash-cli' },
          },
          SettingItemType.EnvVar,
        );

        expect(instance.state.environmentVariables).toEqual({
          'var-0': 'ELECTRON_DEBUG_DRAG_REGIONS=1',
          'var-1': 'ELECTRON_TRASH=trash-cli',
        });
      });

      it('saves properly', async () => {
        const wrapper = shallow(<ExecutionSettings appState={store} />);
        const instance = wrapper.instance() as any;

        instance.setState({
          environmentVariables: {
            'var-0': 'ELECTRON_DEBUG_DRAG_REGIONS=1',
            'var-1': 'ELECTRON_TRASH=trash-cli',
          },
        });

        await instance.handleSettingsItemSave(SettingItemType.EnvVar);
        expect(store.environmentVariables).toEqual([
          'ELECTRON_DEBUG_DRAG_REGIONS=1',
          'ELECTRON_TRASH=trash-cli',
        ]);
      });
    });
  });
});
