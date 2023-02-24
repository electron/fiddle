import * as React from 'react';

import { InstallState } from '@electron/fiddle-core';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { BisectHandler } from '../src/renderer/components/commands-bisect';
import { AppState } from '../src/renderer/state';

describe('Bisect commands component', () => {
  let store: AppState;

  beforeEach(() => {
    store = window.ElectronFiddle.app.state;
  });

  it('is disabled if an electron version is currently downloading', () => {
    store.currentElectronVersion.state = InstallState.downloading;
    const { getByRole } = render(<BisectHandler appState={store} />);

    const goodCommitButton = getByRole('button', {
      name: 'Mark commit as good',
    });
    const badCommitButton = getByRole('button', {
      name: 'Mark commit as bad',
    });
    expect(goodCommitButton).toBeDisabled();
    expect(badCommitButton).toBeDisabled();
  });

  it('can cancel the active bisect', async () => {
    const user = userEvent.setup();
    const { getByRole } = render(<BisectHandler appState={store} />);
    const cancelButton = getByRole('button', {
      name: 'Cancel bisect',
    });

    await user.click(cancelButton);
    expect(store.Bisector).toBeUndefined();
  });

  it('renders bisect dialog button if no bisect instance', () => {
    store.Bisector = undefined;
    const { getByRole } = render(<BisectHandler appState={store} />);
    const btn = getByRole('button');
    expect(btn).toHaveTextContent('Bisect');
  });

  it.each([
    ['good', true],
    ['bad', false],
  ])(
    'can tell the Bisect instance that the current version is %s',
    async (label, bisectorValue) => {
      const user = userEvent.setup();
      const { getByRole } = render(<BisectHandler appState={store} />);
      const goodButton = getByRole('button', {
        name: `Mark commit as ${label}`,
      });
      // the bisector returns the next version to inspect
      // when continuing the bisect process
      (store.Bisector!.continue as jest.Mock).mockReturnValueOnce({
        version: 'v10.0.0',
      });
      await user.click(goodButton);
      expect(store.Bisector).toBeTruthy();
      expect(store.Bisector!.continue as jest.Mock).toBeCalledWith(
        bisectorValue,
      );
    },
  );

  it('resets the bisector once the bisect is terminated', async () => {
    const user = userEvent.setup();
    const { getByRole } = render(<BisectHandler appState={store} />);
    const goodButton = getByRole('button', {
      name: `Mark commit as good`,
    });
    // the bisector returns a tuple of two values when
    // the bisect is terminated
    (store.Bisector!.continue as jest.Mock).mockReturnValueOnce([
      {
        version: 'v10.0.0',
      },
      { version: 'v10.0.2' },
    ]);
    await user.click(goodButton);
    expect(store.Bisector).toBeUndefined();
  });
});
