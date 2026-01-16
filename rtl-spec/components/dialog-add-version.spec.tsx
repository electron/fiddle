import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AddVersionDialog } from '../../src/renderer/components/dialog-add-version';
import { AppState } from '../../src/renderer/state';
import { overrideRendererPlatform } from '../../tests/utils';
import { renderClassComponentWithInstanceRef } from '../test-utils/renderClassComponentWithInstanceRef';

describe('AddVersionDialog component', () => {
  let store: AppState;

  const mockFile = '/test/file';

  beforeEach(() => {
    overrideRendererPlatform('darwin');
    ({ state: store } = window.app);
    store.isAddVersionDialogShowing = true;
  });

  function renderAddVersionDialog() {
    return renderClassComponentWithInstanceRef(AddVersionDialog, {
      appState: store,
    });
  }

  it('renders the dialog when open', () => {
    renderAddVersionDialog();

    expect(screen.getByText('Add local Electron build')).toBeInTheDocument();
    expect(
      screen.getByText(/Select the folder containing/),
    ).toBeInTheDocument();
  });

  it('renders with valid electron and version', () => {
    const { instance } = renderAddVersionDialog();

    instance.setState({
      isValidVersion: true,
      isValidElectron: true,
      folderPath: mockFile,
    });

    expect(screen.getByText(/We found an/)).toBeInTheDocument();
  });

  it('renders with invalid version', () => {
    const { instance } = renderAddVersionDialog();

    instance.setState({
      isValidVersion: false,
      isValidElectron: true,
      folderPath: mockFile,
    });

    expect(screen.getByText(/We found an/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('4.0.0')).toBeInTheDocument();
  });

  it('renders with existing local version', () => {
    const { instance } = renderAddVersionDialog();

    instance.setState({
      isValidVersion: true,
      isValidElectron: true,
      existingLocalVersion: {
        version: '2.2.2',
        localPath: mockFile,
      },
      folderPath: mockFile,
    });

    expect(
      screen.getByText(/This folder is already in use as version "2.2.2"/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /switch/i })).toBeInTheDocument();
  });

  it('overrides default input with Electron dialog', async () => {
    renderAddVersionDialog();

    const fileInput = screen.getByText(/Select the folder containing/);
    const input = fileInput.closest('label')?.querySelector('input');

    expect(input).toBeInTheDocument();

    if (input) {
      fireEvent.click(input);
      expect(window.ElectronFiddle.selectLocalVersion).toHaveBeenCalled();
    }
  });

  describe('selectLocalVersion()', () => {
    it('updates state', async () => {
      const { instance } = renderAddVersionDialog();

      vi.mocked(window.ElectronFiddle.selectLocalVersion).mockResolvedValue({
        folderPath: '/test/',
        isValidElectron: true,
        localName: 'Test',
      });

      await instance.selectLocalVersion();

      await waitFor(() => {
        expect(instance.state.isValidElectron).toBe(true);
        expect(instance.state.folderPath).toBe('/test/');
        expect(instance.state.localName).toBe('Test');
      });
    });
  });

  describe('onChangeVersion()', () => {
    it('handles valid input', async () => {
      const { instance } = renderAddVersionDialog();

      instance.setState({
        isValidElectron: true,
        folderPath: mockFile,
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('4.0.0')).toBeInTheDocument();
      });

      const versionInput = screen.getByPlaceholderText('4.0.0');
      await userEvent.type(versionInput, '3.3.3');

      await waitFor(() => {
        expect(instance.state.isValidVersion).toBe(true);
        expect(instance.state.version).toBe('3.3.3');
      });
    });

    it('handles invalid input', async () => {
      const { instance } = renderAddVersionDialog();

      instance.setState({
        isValidElectron: true,
        folderPath: mockFile,
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('4.0.0')).toBeInTheDocument();
      });

      const versionInput = screen.getByPlaceholderText('4.0.0');
      await userEvent.type(versionInput, 'foo');

      await waitFor(() => {
        expect(instance.state.isValidVersion).toBe(false);
        expect(instance.state.version).toBe('foo');
      });
    });
  });

  describe('onSubmit', () => {
    it('does not do anything without a file', async () => {
      const { instance } = renderAddVersionDialog();

      await instance.onSubmit();

      expect(store.addLocalVersion).toHaveBeenCalledTimes(0);
    });

    it('adds a local version using the given data', async () => {
      const { instance } = renderAddVersionDialog();

      instance.setState({
        version: '3.3.3',
        folderPath: '/test/path',
        isValidVersion: true,
        isValidElectron: true,
      });

      await instance.onSubmit();

      expect(store.addLocalVersion).toHaveBeenCalledTimes(1);
      expect(store.addLocalVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          localPath: '/test/path',
          version: '3.3.3',
        }),
      );
    });

    it('switches to existing local version when duplicate', async () => {
      const { instance } = renderAddVersionDialog();

      instance.setState({
        isValidElectron: true,
        folderPath: '/test/path',
        version: '3.3.3',
        existingLocalVersion: {
          version: '2.2.2',
          localPath: '/test/path',
        },
      });

      await instance.onSubmit();

      expect(store.setVersion).toHaveBeenCalledWith('2.2.2');
      expect(store.addLocalVersion).not.toHaveBeenCalled();
    });
  });

  describe('buttons', () => {
    it('disables Add button when no valid electron or version', () => {
      renderAddVersionDialog();

      const addButton = screen.getByRole('button', { name: /add/i });
      expect(addButton).toBeDisabled();
    });

    it('enables Add button when valid electron and version', async () => {
      const { instance } = renderAddVersionDialog();

      instance.setState({
        isValidElectron: true,
        isValidVersion: true,
        folderPath: mockFile,
      });

      await waitFor(() => {
        const addButton = screen.getByRole('button', { name: /add/i });
        expect(addButton).not.toBeDisabled();
      });
    });

    it('Cancel button closes dialog', () => {
      renderAddVersionDialog();

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(store.isAddVersionDialogShowing).toBe(false);
    });
  });

  describe('onClose()', () => {
    it('hides dialog and resets state', () => {
      const { instance } = renderAddVersionDialog();

      instance.setState({
        isValidVersion: true,
        isValidElectron: true,
        folderPath: mockFile,
        version: '3.3.3',
      });

      instance.onClose();

      expect(store.isAddVersionDialogShowing).toBe(false);
      expect(instance.state.isValidVersion).toBe(false);
      expect(instance.state.isValidElectron).toBe(false);
      expect(instance.state.folderPath).toBeUndefined();
    });
  });
});
