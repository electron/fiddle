import { StateMock } from '../tests/mocks/state';

import React from 'react';
import { render, fireEvent } from '@testing-library/react';

import { AddressBar } from '../src/renderer/components/commands-address-bar';
import { AppState } from '../src/renderer/state';
import { GistActionState } from '../src/interfaces';
import { runInAction } from 'mobx';

describe('AddressBar component', () => {
  let store: StateMock;

  beforeEach(() => {
    store = (window.ElectronFiddle.app.state as unknown) as StateMock;
  });

  it('loads a remote gist from a gist URL', async () => {
    const gistId = '159cb99a70a201bd5e08194674f4c571';
    const gistUrl = `https://gist.github.com/ghost/${gistId}`;

    const { getByRole, getByPlaceholderText } = render(
      <AddressBar appState={(store as unknown) as AppState} />,
    );

    fireEvent.change(getByPlaceholderText('https://gist.github.com/...'), {
      target: { value: gistUrl },
    });

    const btn = getByRole('button');
    expect(btn).not.toBeDisabled();

    fireEvent.click(btn);

    const { fetchGistAndLoad } = window.ElectronFiddle.app.remoteLoader;
    expect(fetchGistAndLoad).toBeCalledWith(gistId);
  });

  it('is disabled if address is empty', () => {
    const { getByRole } = render(
      <AddressBar appState={(store as unknown) as AppState} />,
    );

    const btn = getByRole('button');
    expect(btn).toBeDisabled();
  });

  it('is disabled if the URL is invalid', () => {
    const { getByRole, getByPlaceholderText } = render(
      <AddressBar appState={(store as unknown) as AppState} />,
    );
    const btn = getByRole('button');

    fireEvent.change(getByPlaceholderText('https://gist.github.com/...'), {
      target: { value: 'bad url' },
    });

    expect(btn).toBeDisabled();
  });

  it.each([
    GistActionState.deleting,
    GistActionState.publishing,
    GistActionState.updating,
  ])('disables during active gist action (%s)', (action) => {
    const gistId = '159cb99a70a201bd5e08194674f4c571';
    const gistUrl = `https://gist.github.com/ghost/${gistId}`;
    const { getByPlaceholderText, getByRole } = render(
      <AddressBar appState={(store as unknown) as AppState} />,
    );
    fireEvent.change(getByPlaceholderText('https://gist.github.com/...'), {
      target: { value: gistUrl },
    });
    runInAction(() => {
      store.activeGistAction = action;
    });
    const btn = getByRole('button');
    expect(btn).toBeDisabled();
  });
});
