import * as React from 'react';

import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { ConsoleSettings } from '../../../src/renderer/components/settings-general-console';
import { AppState } from '../../../src/renderer/state';

describe('ConsoleSettings component', () => {
  let store: AppState;

  beforeEach(() => {
    ({ state: store } = window.app);
  });

  it('renders', () => {
    const { container } = render(<ConsoleSettings appState={store} />);
    expect(container).toBeInTheDocument();
    expect(screen.getByText('Console')).toBeInTheDocument();
    expect(screen.getByLabelText('Clear on run.')).toBeInTheDocument();
  });

  describe('handleClearOnRunChange()', () => {
    it('handles a new selection', async () => {
      const user = userEvent.setup();
      store.isClearingConsoleOnRun = true;
      render(<ConsoleSettings appState={store} />);

      const checkbox = screen.getByLabelText('Clear on run.');

      // Uncheck: sets to false
      await user.click(checkbox);
      expect(store.isClearingConsoleOnRun).toBe(false);

      // Check again: sets to true
      await user.click(checkbox);
      expect(store.isClearingConsoleOnRun).toBe(true);
    });
  });
});
