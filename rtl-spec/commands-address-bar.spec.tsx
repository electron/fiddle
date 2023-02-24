import React from 'react';

import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { runInAction } from 'mobx';

import { GistActionState } from '../src/interfaces';
import { AddressBar } from '../src/renderer/components/commands-address-bar';
import { AppState } from '../src/renderer/state';

describe('AddressBar component', () => {
  let store: AppState;

  beforeEach(() => {
    store = window.ElectronFiddle.app.state;
  });

  it('loads a remote gist from a gist URL', async () => {
    const gistId = '159cb99a70a201bd5e08194674f4c571';
    const gistUrl = `https://gist.github.com/ghost/${gistId}`;

    const { getByRole, getByPlaceholderText } = render(
      <AddressBar appState={store} />,
    );

    await userEvent.type(
      getByPlaceholderText('https://gist.github.com/...'),
      gistUrl,
    );

    const btn = getByRole('button');
    expect(btn).not.toBeDisabled();

    await userEvent.click(btn);

    const { fetchGistAndLoad } = window.ElectronFiddle.app.remoteLoader;
    expect(fetchGistAndLoad).toBeCalledWith(gistId);
  });

  it('is disabled if address is empty', () => {
    const { getByRole } = render(<AddressBar appState={store} />);

    const btn = getByRole('button');
    expect(btn).toBeDisabled();
  });

  it('is disabled if the URL is invalid', async () => {
    const { getByRole, getByPlaceholderText } = render(
      <AddressBar appState={store} />,
    );
    const btn = getByRole('button');

    await userEvent.type(
      getByPlaceholderText('https://gist.github.com/...'),
      'bad url',
    );

    expect(btn).toBeDisabled();
  });

  it.each([
    GistActionState.deleting,
    GistActionState.publishing,
    GistActionState.updating,
  ])('disables during active gist action (%s)', async (action) => {
    const gistId = '159cb99a70a201bd5e08194674f4c571';
    const gistUrl = `https://gist.github.com/ghost/${gistId}`;
    const { getByPlaceholderText, getByRole } = render(
      <AddressBar appState={store} />,
    );
    await userEvent.type(
      getByPlaceholderText('https://gist.github.com/...'),
      gistUrl,
    );
    runInAction(() => {
      store.activeGistAction = action;
    });
    const btn = getByRole('button');
    expect(btn).toBeDisabled();
  });
});
