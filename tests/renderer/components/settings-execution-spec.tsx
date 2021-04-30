import { shallow } from 'enzyme';
import * as React from 'react';

import { ExecutionSettings } from '../../../src/renderer/components/settings-execution';

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

  describe('handleExecutionFlagChange()', () => {
    it('handles new flags', async () => {
      const wrapper = shallow(<ExecutionSettings appState={store} />);
      const instance = wrapper.instance() as any;
      await instance.handleExecutionFlagChange({
        currentTarget: { value: '--lang=es' },
      });

      expect(store.executionFlags).toEqual(['--lang=es']);

      await instance.handleExecutionFlagChange({
        currentTarget: { value: '--lang=es|--js-flags=--expose-gc' },
      });

      expect(store.executionFlags).toEqual([
        '--lang=es',
        '--js-flags=--expose-gc',
      ]);
    });
  });

  describe('handleEnvironmentVariableChange()', () => {
    it('handles new environment variables', async () => {
      const wrapper = shallow(<ExecutionSettings appState={store} />);
      const instance = wrapper.instance() as any;

      const dragRegions = 'ELECTRON_DEBUG_DRAG_REGIONS=1';
      const trash = 'ELECTRON_TRASH=trash-cli';
      await instance.handleEnvironmentVariableChange({
        currentTarget: { value: dragRegions },
      });

      expect(store.environmentVariables).toEqual([dragRegions]);

      await instance.handleEnvironmentVariableChange({
        currentTarget: {
          value: `${dragRegions}|${trash}`,
        },
      });

      expect(store.environmentVariables).toEqual([dragRegions, trash]);
    });
  });
});
