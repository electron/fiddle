import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { GenericDialogType } from '../../src/interfaces';
import { GenericDialog } from '../../src/renderer/components/dialog-generic';
import { AppState } from '../../src/renderer/state';
import { overrideRendererPlatform } from '../../tests/utils';
import { renderClassComponentWithInstanceRef } from '../test-utils/renderClassComponentWithInstanceRef';

describe('GenericDialog component', () => {
  let store: AppState;

  beforeEach(() => {
    overrideRendererPlatform('darwin');
    ({ state: store } = window.app);
    store.isGenericDialogShowing = true;
    store.genericDialogOptions = {
      type: GenericDialogType.confirm,
      ok: 'OK',
      cancel: 'Cancel',
      label: 'Test dialog label',
    };
  });

  function renderGenericDialog() {
    return renderClassComponentWithInstanceRef(GenericDialog, {
      appState: store,
    });
  }

  describe('renders', () => {
    it('warning dialog', () => {
      store.genericDialogOptions.type = GenericDialogType.warning;
      renderGenericDialog();

      expect(screen.getByText('Test dialog label')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Cancel' }),
      ).toBeInTheDocument();
    });

    it('confirmation dialog', () => {
      store.genericDialogOptions.type = GenericDialogType.confirm;
      renderGenericDialog();

      expect(screen.getByText('Test dialog label')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
    });

    it('success dialog', () => {
      store.genericDialogOptions.type = GenericDialogType.success;
      renderGenericDialog();

      expect(screen.getByText('Test dialog label')).toBeInTheDocument();
    });

    it('with an input prompt', () => {
      store.genericDialogOptions.type = GenericDialogType.confirm;
      store.genericDialogOptions.wantsInput = true;
      renderGenericDialog();

      expect(screen.getByText('Test dialog label')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('with an input prompt and placeholder', () => {
      store.genericDialogOptions.type = GenericDialogType.confirm;
      store.genericDialogOptions.wantsInput = true;
      store.genericDialogOptions.placeholder = 'Enter something';
      renderGenericDialog();

      expect(screen.getByText('Test dialog label')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('Enter something'),
      ).toBeInTheDocument();
    });
  });

  it('onClose() closes itself with true result', () => {
    const { instance } = renderGenericDialog();

    instance.onClose(true);

    expect(store.isGenericDialogShowing).toBe(false);
    expect(store.genericDialogLastResult).toBe(true);
  });

  it('onClose() closes itself with false result', () => {
    const { instance } = renderGenericDialog();

    instance.onClose(false);

    expect(store.isGenericDialogShowing).toBe(false);
    expect(store.genericDialogLastResult).toBe(false);
  });

  it('clicking OK button closes dialog with true result', () => {
    renderGenericDialog();

    const okButton = screen.getByRole('button', { name: 'OK' });
    fireEvent.click(okButton);

    expect(store.isGenericDialogShowing).toBe(false);
    expect(store.genericDialogLastResult).toBe(true);
  });

  it('clicking Cancel button closes dialog with false result', () => {
    renderGenericDialog();

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    expect(store.isGenericDialogShowing).toBe(false);
    expect(store.genericDialogLastResult).toBe(false);
  });

  it('enter key submits the dialog when input is focused', async () => {
    store.genericDialogOptions.wantsInput = true;
    renderGenericDialog();

    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(store.isGenericDialogShowing).toBe(false);
      expect(store.genericDialogLastResult).toBe(true);
    });
  });

  it('enterSubmit() closes dialog on Enter key', () => {
    const { instance } = renderGenericDialog();

    const event = { key: 'Enter' } as React.KeyboardEvent<HTMLInputElement>;
    instance.enterSubmit(event);

    expect(store.isGenericDialogShowing).toBe(false);
  });

  it('enterSubmit() does not close dialog on other keys', () => {
    const { instance } = renderGenericDialog();

    const event = { key: 'Escape' } as React.KeyboardEvent<HTMLInputElement>;
    instance.enterSubmit(event);

    expect(store.isGenericDialogShowing).toBe(true);
  });

  it('captures input value on close', async () => {
    store.genericDialogOptions.wantsInput = true;
    renderGenericDialog();

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test input value' } });

    const okButton = screen.getByRole('button', { name: 'OK' });
    fireEvent.click(okButton);

    await waitFor(() => {
      expect(store.genericDialogLastInput).toBe('test input value');
    });
  });

  it('sets genericDialogLastInput to null when input is empty', async () => {
    store.genericDialogOptions.wantsInput = true;
    renderGenericDialog();

    const okButton = screen.getByRole('button', { name: 'OK' });
    fireEvent.click(okButton);

    await waitFor(() => {
      expect(store.genericDialogLastInput).toBeNull();
    });
  });
});
