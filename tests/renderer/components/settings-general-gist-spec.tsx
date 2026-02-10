import * as React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { GistSettings } from '../../../src/renderer/components/settings-general-gist';
import { AppState } from '../../../src/renderer/state';

describe('GistSettings component', () => {
  let store: AppState;

  beforeEach(() => {
    ({ state: store } = window.app);
  });

  it('renders', () => {
    const { container } = render(<GistSettings appState={store} />);
    expect(container).toBeInTheDocument();
    expect(screen.getByText('Gists')).toBeInTheDocument();
  });

  describe('handleGistHistoryChange()', () => {
    it('handles gist history', async () => {
      const user = userEvent.setup();
      render(<GistSettings appState={store} />);

      const checkbox = screen.getByLabelText('Show Gist History');

      await user.click(checkbox);
      expect(store.isShowingGistHistory).toEqual(true);

      await user.click(checkbox);
      expect(store.isShowingGistHistory).toEqual(false);
    });
  });

  describe('handlePackageAuthorChange()', () => {
    it('handles package author', () => {
      const { container } = render(<GistSettings appState={store} />);

      const input = container.querySelector('input[type="text"]')!;

      const author = 'electron<electron@electron.org>';
      fireEvent.change(input, { target: { value: author } });
      expect(store.packageAuthor).toEqual(author);

      fireEvent.change(input, { target: { value: 'test' } });
      expect(store.packageAuthor).toEqual('test');

      fireEvent.change(input, { target: { value: 'test-onchange' } });
      expect(store.packageAuthor).toEqual('test-onchange');
    });
  });
});
