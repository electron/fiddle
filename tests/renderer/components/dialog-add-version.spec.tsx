import * as React from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AddVersionDialog } from '../../../src/renderer/components/dialog-add-version';
import { AppState } from '../../../src/renderer/state';
import { overrideRendererPlatform } from '../../utils';
import { renderClassComponentWithInstanceRef } from '../utils/renderClassComponentWithInstanceRef';

describe('AddVersionDialog component', () => {
  let store: AppState;

  const mockFile = '/test/file';

  beforeEach(() => {
    // We render the buttons different depending on the
    // platform, so let' have a uniform platform for unit tests
    overrideRendererPlatform('darwin');

    ({ state: store } = window.app);
  });

  it('renders', () => {
    store.isAddVersionDialogShowing = true;
    const { instance } = renderClassComponentWithInstanceRef(AddVersionDialog, {
      appState: store,
    });

    act(() => {
      instance.setState({
        isValidName: true,
        isValidElectron: true,
        folderPath: mockFile,
      });
    });

    expect(screen.getByText('Add local Electron build')).toBeInTheDocument();
    expect(screen.getByText('Add')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();

    act(() => {
      instance.setState({
        isValidName: false,
        isValidElectron: true,
        folderPath: mockFile,
      });
    });

    // Still renders the dialog, but Add button should be disabled
    expect(screen.getByText('Add local Electron build')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();

    act(() => {
      instance.setState({
        isValidName: true,
        isValidElectron: true,
        existingLocalVersion: {
          version: '2.2.2',
          localPath: mockFile,
        },
        folderPath: mockFile,
      });
    });

    // With existing version, button text changes to "Switch"
    expect(screen.getByText('Switch')).toBeInTheDocument();
  });

  it('overrides default input with Electron dialog', () => {
    store.isAddVersionDialogShowing = true;
    render(<AddVersionDialog appState={store} />);

    // The FileInput has id="custom-electron-version" with an onClick that
    // calls selectLocalVersion and preventDefault
    const fileInput = screen.getByLabelText(
      'Select the folder containing Electron.app...',
      { selector: 'input' },
    );
    expect(fileInput).toBeInTheDocument();

    const preventDefault = vi.fn();
    fireEvent(
      fileInput,
      Object.assign(new MouseEvent('click', { bubbles: true }), {
        preventDefault,
      }),
    );

    expect(preventDefault).toHaveBeenCalled();
    expect(window.ElectronFiddle.selectLocalVersion).toHaveBeenCalled();
  });

  describe('selectLocalVersion()', () => {
    it('updates state', async () => {
      store.isAddVersionDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(
        AddVersionDialog,
        { appState: store },
      );
      vi.mocked(window.ElectronFiddle.selectLocalVersion).mockResolvedValue({
        folderPath: '/test/',
        isValidElectron: true,
        localName: 'Test',
        token: 'abc-123',
      });
      await instance.selectLocalVersion();

      expect(instance.state.isValidElectron).toBe(true);
      expect(instance.state.folderPath).toBe('/test/');
      expect(instance.state.localName).toBe('Test');
      expect(instance.state.token).toBe('abc-123');
    });
  });

  describe('onChangeName()', () => {
    it('handles valid input', () => {
      store.isAddVersionDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(
        AddVersionDialog,
        { appState: store },
      );

      act(() => {
        instance.onChangeName({
          target: { value: '3.3.3' },
        } as any);
      });
      expect(instance.state.isValidName).toBe(true);
      expect(instance.state.name).toBe('3.3.3');
    });

    it('handles invalid input', () => {
      store.isAddVersionDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(
        AddVersionDialog,
        { appState: store },
      );

      act(() => {
        instance.onChangeName({ target: { value: '   ' } } as any);
      });
      expect(instance.state.isValidName).toBe(false);
      expect(instance.state.name).toBe('   ');

      act(() => {
        instance.onChangeName({ target: {} } as any);
      });
      expect(instance.state.isValidName).toBe(false);
      expect(instance.state.name).toBe('');
    });
  });

  describe('onSubmit', () => {
    it('does not do anything without a token', async () => {
      store.isAddVersionDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(
        AddVersionDialog,
        { appState: store },
      );

      await instance.onSubmit();

      expect(store.addLocalVersion).toHaveBeenCalledTimes(0);
    });

    it('adds a local version using the given data', async () => {
      store.isAddVersionDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(
        AddVersionDialog,
        { appState: store },
      );

      act(() => {
        instance.setState({
          name: '3.3.3',
          folderPath: '/test/path',
          token: 'submit-token',
        });
      });

      await instance.onSubmit();

      expect(store.addLocalVersion).toHaveBeenCalledTimes(1);
      expect(store.addLocalVersion).toHaveBeenCalledWith(
        'submit-token',
        '3.3.3',
      );
    });

    it('shows dialog warning when adding duplicate local versions', async () => {
      store.isAddVersionDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(
        AddVersionDialog,
        { appState: store },
      );

      act(() => {
        instance.setState({
          isValidElectron: true,
          folderPath: '/test/path',
          name: '3.3.3',
          token: 'dup-token',
          existingLocalVersion: {
            version: '2.2.2',
            localPath: '/test/path',
          },
        });
      });

      // When there is an existing local version, the dialog shows
      // the "Switch" button and a message about the existing version
      expect(screen.getByText('Switch')).toBeInTheDocument();
      expect(
        screen.getByText(/This folder is already in use/),
      ).toBeInTheDocument();
    });
  });
});
