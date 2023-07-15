import * as React from 'react';

import { shallow } from 'enzyme';

import {
  ExecutionSettings,
  SettingItemType,
} from '../../../src/renderer/components/settings-execution';
import { AppState } from '../../../src/renderer/state';

describe('ExecutionSettings component', () => {
  let store: AppState;

  beforeEach(() => {
    store = {
      executionFlags: [] as string[],
      environmentVariables: [] as string[],
    } as AppState;
  });

  it('renders', () => {
    const wrapper = shallow(<ExecutionSettings appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  describe('handleDeleteDataChange()', () => {
    it('handles a new selection', async () => {
      const wrapper = shallow(<ExecutionSettings appState={store} />);
      const instance: any = wrapper.instance();
      instance.handleDeleteDataChange({
        currentTarget: { checked: false },
      } as React.FormEvent<HTMLInputElement>);

      expect(store.isKeepingUserDataDirs).toBe(false);

      instance.handleDeleteDataChange({
        currentTarget: { checked: true },
      } as React.FormEvent<HTMLInputElement>);

      expect(store.isKeepingUserDataDirs).toBe(true);
    });
  });

  describe('handleElectronLoggingChange()', () => {
    it('handles a new selection', async () => {
      const wrapper = shallow(<ExecutionSettings appState={store} />);
      const instance: any = wrapper.instance();
      instance.handleElectronLoggingChange({
        currentTarget: { checked: false },
      } as React.FormEvent<HTMLInputElement>);

      expect(store.isEnablingElectronLogging).toBe(false);

      instance.handleElectronLoggingChange({
        currentTarget: { checked: true },
      } as React.FormEvent<HTMLInputElement>);

      expect(store.isEnablingElectronLogging).toBe(true);
    });
  });

  describe('handleItemSettingsChange()', () => {
    describe('with executionFlags', () => {
      it('updates when new flags are added', async () => {
        const wrapper = shallow(<ExecutionSettings appState={store} />);
        const instance: any = wrapper.instance();

        const lang = '--lang=es';
        const flags = '--js-flags=--expose-gc';

        instance.handleSettingsItemChange(
          {
            currentTarget: { name: '0', value: lang },
          } as React.ChangeEvent<HTMLInputElement>,
          SettingItemType.Flags,
        );

        expect(instance.state.executionFlags).toEqual({ '0': lang });
        expect(store.executionFlags).toEqual([lang]);

        instance.handleSettingsItemChange(
          {
            currentTarget: { name: '1', value: flags },
          } as React.ChangeEvent<HTMLInputElement>,
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
        const instance: any = wrapper.instance();

        const debug = 'ELECTRON_DEBUG_DRAG_REGIONS=1';
        const trash = 'ELECTRON_TRASH=trash-cli';

        instance.handleSettingsItemChange(
          {
            currentTarget: {
              name: '0',
              value: debug,
            },
          } as React.ChangeEvent<HTMLInputElement>,
          SettingItemType.EnvVars,
        );

        expect(instance.state.environmentVariables).toEqual({ '0': debug });
        expect(store.environmentVariables).toEqual([debug]);

        instance.handleSettingsItemChange(
          {
            currentTarget: { name: '1', value: trash },
          } as React.ChangeEvent<HTMLInputElement>,
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
