import * as React from 'react';

import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderClassComponentWithInstanceRef } from '../../../rtl-spec/test-utils/renderClassComponentWithInstanceRef';
import { AddVersionDialog } from '../../../src/renderer/components/dialog-add-version';
import { AppState } from '../../../src/renderer/state';
import { overrideRendererPlatform } from '../../utils';

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
      (instance as any).setState({
        isValidVersion: true,
        isValidElectron: true,
        folderPath: mockFile,
      });
    });

    expect(screen.getByText('Add local Electron build')).toBeInTheDocument();
    expect(screen.getByText('Add')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();

    act(() => {
      (instance as any).setState({
        isValidVersion: false,
        isValidElectron: true,
        folderPath: mockFile,
      });
    });

    // Still renders the dialog
    expect(screen.getByText('Add local Electron build')).toBeInTheDocument();

    act(() => {
      (instance as any).setState({
        isValidVersion: true,
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
    const fileInput = document.querySelector(
      '#custom-electron-version input[type="file"]',
    ) as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    const preventDefault = vi.fn();
    fileInput.dispatchEvent(
      Object.assign(new MouseEvent('click', { bubbles: true }), {
        preventDefault,
      }),
    );

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
      });
      await act(async () => {
        await (instance as any).selectLocalVersion();
      });

      expect((instance as any).state.isValidElectron).toBe(true);
      expect((instance as any).state.folderPath).toBe('/test/');
      expect((instance as any).state.localName).toBe('Test');
    });
  });

  describe('onChangeVersion()', () => {
    it('handles valid input', () => {
      store.isAddVersionDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(
        AddVersionDialog,
        { appState: store },
      );

      act(() => {
        (instance as any).onChangeVersion({
          target: { value: '3.3.3' },
        });
      });
      expect((instance as any).state.isValidVersion).toBe(true);
      expect((instance as any).state.version).toBe('3.3.3');
    });

    it('handles invalid input', () => {
      store.isAddVersionDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(
        AddVersionDialog,
        { appState: store },
      );

      act(() => {
        (instance as any).onChangeVersion({ target: { value: 'foo' } });
      });
      expect((instance as any).state.isValidVersion).toBe(false);
      expect((instance as any).state.version).toBe('foo');

      act(() => {
        (instance as any).onChangeVersion({ target: {} });
      });
      expect((instance as any).state.isValidVersion).toBe(false);
      expect((instance as any).state.version).toBe('');
    });
  });

  describe('onSubmit', () => {
    it('does not do anything without a file', async () => {
      store.isAddVersionDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(
        AddVersionDialog,
        { appState: store },
      );

      await act(async () => {
        await (instance as any).onSubmit();
      });

      expect(store.addLocalVersion).toHaveBeenCalledTimes(0);
    });

    it('adds a local version using the given data', async () => {
      store.isAddVersionDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(
        AddVersionDialog,
        { appState: store },
      );

      act(() => {
        (instance as any).setState({
          version: '3.3.3',
          folderPath: '/test/path',
        });
      });

      await act(async () => {
        await (instance as any).onSubmit();
      });

      expect(store.addLocalVersion).toHaveBeenCalledTimes(1);
      expect(store.addLocalVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          localPath: '/test/path',
          version: '3.3.3',
        }),
      );
    });

    it('shows dialog warning when adding duplicate local versions', async () => {
      store.isAddVersionDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(
        AddVersionDialog,
        { appState: store },
      );

      act(() => {
        (instance as any).setState({
          isValidElectron: true,
          folderPath: '/test/path',
          version: '3.3.3',
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
