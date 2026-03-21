import * as React from 'react';

import { act, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { renderClassComponentWithInstanceRef } from '../../../rtl-spec/test-utils/renderClassComponentWithInstanceRef';
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
    render(<ExecutionSettings appState={store} />);
    expect(screen.getByText('Execution')).toBeInTheDocument();
  });

  describe('handleDeleteDataChange()', () => {
    it('handles a new selection', async () => {
      const user = userEvent.setup();
      render(<ExecutionSettings appState={store} />);

      const checkbox = screen.getByLabelText(
        'Do not delete user data directories.',
      );

      // Click to check
      await user.click(checkbox);
      expect(store.isKeepingUserDataDirs).toBe(true);

      // Click to uncheck
      await user.click(checkbox);
      expect(store.isKeepingUserDataDirs).toBe(false);
    });
  });

  describe('handleElectronLoggingChange()', () => {
    it('handles a new selection', async () => {
      const user = userEvent.setup();
      render(<ExecutionSettings appState={store} />);

      const checkbox = screen.getByLabelText(
        'Enable advanced Electron logging.',
      );

      // Click to check
      await user.click(checkbox);
      expect(store.isEnablingElectronLogging).toBe(true);

      // Click to uncheck
      await user.click(checkbox);
      expect(store.isEnablingElectronLogging).toBe(false);
    });
  });

  describe('handleItemSettingsChange()', () => {
    describe('with executionFlags', () => {
      it('updates when new flags are added', async () => {
        const { instance } = renderClassComponentWithInstanceRef(
          ExecutionSettings,
          { appState: store },
        );

        const lang = '--lang=es';
        const flags = '--js-flags=--expose-gc';

        act(() => {
          instance.handleSettingsItemChange(
            {
              currentTarget: { name: '0', value: lang },
            } as React.ChangeEvent<HTMLInputElement>,
            SettingItemType.Flags,
          );
        });

        expect(instance.state.executionFlags).toEqual({ '0': lang });
        expect(store.executionFlags).toEqual([lang]);

        act(() => {
          instance.handleSettingsItemChange(
            {
              currentTarget: { name: '1', value: flags },
            } as React.ChangeEvent<HTMLInputElement>,
            SettingItemType.Flags,
          );
        });

        expect(instance.state.executionFlags).toEqual({
          '0': lang,
          '1': flags,
        });
        expect(store.executionFlags).toEqual([lang, flags]);
      });
    });

    describe('with environmentVariables', () => {
      it('updates when new env vars are added', async () => {
        const { instance } = renderClassComponentWithInstanceRef(
          ExecutionSettings,
          { appState: store },
        );

        const debug = 'ELECTRON_DEBUG_DRAG_REGIONS=1';
        const trash = 'ELECTRON_TRASH=trash-cli';

        act(() => {
          instance.handleSettingsItemChange(
            {
              currentTarget: { name: '0', value: debug },
            } as React.ChangeEvent<HTMLInputElement>,
            SettingItemType.EnvVars,
          );
        });

        expect(instance.state.environmentVariables).toEqual({ '0': debug });
        expect(store.environmentVariables).toEqual([debug]);

        act(() => {
          instance.handleSettingsItemChange(
            {
              currentTarget: { name: '1', value: trash },
            } as React.ChangeEvent<HTMLInputElement>,
            SettingItemType.EnvVars,
          );
        });

        expect(instance.state.environmentVariables).toEqual({
          '0': debug,
          '1': trash,
        });
        expect(store.environmentVariables).toEqual([debug, trash]);
      });
    });
  });
});
