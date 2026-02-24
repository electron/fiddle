import * as React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { MirrorSettings } from '../../../src/renderer/components/settings-general-mirror';
import { AppState } from '../../../src/renderer/state';

describe('MirrorSettings component', () => {
  let store: AppState;

  beforeEach(() => {
    ({ state: store } = window.app);
  });

  it('renders', () => {
    const { container } = render(<MirrorSettings appState={store} />);
    expect(container).toBeInTheDocument();
    expect(screen.getByText('Electron Mirrors')).toBeInTheDocument();
  });

  describe('modifyMirror()', () => {
    it('modify mirror', async () => {
      store.electronMirror.sourceType = 'CUSTOM';
      render(<MirrorSettings appState={store} />);

      const [mirror, nightlyMirror] = ['mirror_test1', 'nightly_test2'];

      const inputs = screen.getAllByRole('textbox');
      // First input is electron mirror, second is electron nightly mirror
      fireEvent.change(inputs[0], { target: { value: mirror } });
      fireEvent.change(inputs[1], { target: { value: nightlyMirror } });

      expect(store.electronMirror.sources.CUSTOM.electronMirror).toEqual(
        mirror,
      );

      expect(store.electronMirror.sources.CUSTOM.electronNightlyMirror).toEqual(
        nightlyMirror,
      );
    });
  });

  describe('changeSourceType()', () => {
    it('change source type', async () => {
      const user = userEvent.setup();
      store.electronMirror.sourceType = 'DEFAULT';
      render(<MirrorSettings appState={store} />);

      const customRadio = screen.getByLabelText('Custom');
      await user.click(customRadio);

      expect(store.electronMirror.sourceType).toEqual('CUSTOM');
    });
  });

  describe('radio', () => {
    it('count should is 3', () => {
      render(<MirrorSettings appState={store} />);

      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(3);
    });

    it('order should is default -> china -> custom', () => {
      render(<MirrorSettings appState={store} />);

      const radios = screen.getAllByRole('radio');

      // Verify order by checking positional values
      expect((radios[0] as HTMLInputElement).value).toEqual('DEFAULT');
      expect((radios[1] as HTMLInputElement).value).toEqual('CHINA');
      expect((radios[2] as HTMLInputElement).value).toEqual('CUSTOM');

      // Verify label-value associations
      expect(
        (screen.getByLabelText('Default') as HTMLInputElement).value,
      ).toEqual('DEFAULT');
      expect(
        (screen.getByLabelText('China') as HTMLInputElement).value,
      ).toEqual('CHINA');
      expect(
        (screen.getByLabelText('Custom') as HTMLInputElement).value,
      ).toEqual('CUSTOM');
    });
  });

  describe('onClick()', () => {
    it('change electron mirror', () => {
      store.electronMirror.sourceType = 'CUSTOM';
      render(<MirrorSettings appState={store} />);

      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[0], { target: { value: 'test_mirror' } });

      expect(store.electronMirror.sources.CUSTOM.electronMirror).toEqual(
        'test_mirror',
      );
    });

    it('change electron nightly mirror', () => {
      store.electronMirror.sourceType = 'CUSTOM';
      render(<MirrorSettings appState={store} />);

      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[1], { target: { value: 'test_nightly_mirror' } });

      expect(store.electronMirror.sources.CUSTOM.electronNightlyMirror).toEqual(
        'test_nightly_mirror',
      );
    });
  });
});
