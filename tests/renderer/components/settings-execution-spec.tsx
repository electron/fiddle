import * as React from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { ExecutionSettings } from '../../../src/renderer/components/settings-execution';
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
    const { container } = render(<ExecutionSettings appState={store} />);
    expect(container.querySelector('h1')).toHaveTextContent('Execution');
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
        const user = userEvent.setup();
        render(<ExecutionSettings appState={store} />);

        const flagInput = screen.getByLabelText('Set user-provided flags');
        const lang = '--lang=es';

        await user.type(flagInput, lang);

        expect(store.executionFlags).toEqual([lang]);
      });
    });

    describe('with environmentVariables', () => {
      it('updates when new env vars are added', async () => {
        const user = userEvent.setup();
        render(<ExecutionSettings appState={store} />);

        const envInput = screen.getByLabelText(
          'Set user-provided environment variables',
        );
        const debug = 'ELECTRON_DEBUG_DRAG_REGIONS=1';

        await user.type(envInput, debug);

        expect(store.environmentVariables).toEqual([debug]);
      });
    });
  });
});
