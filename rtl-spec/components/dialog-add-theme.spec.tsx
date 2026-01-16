import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AddThemeDialog } from '../../src/renderer/components/dialog-add-theme';
import { AppState } from '../../src/renderer/state';
import { LoadedFiddleTheme, defaultLight } from '../../src/themes-defaults';
import { overrideRendererPlatform } from '../../tests/utils';
import { renderClassComponentWithInstanceRef } from '../test-utils/renderClassComponentWithInstanceRef';

class FileMock extends Blob {
  public lastModified: number;
  public webkitRelativePath: string;

  constructor(
    private bits: string[],
    public name: string,
    public path: string,
    type: string,
  ) {
    super(bits, { type });
    this.lastModified = Date.now();
    this.webkitRelativePath = '';
  }

  async text() {
    return this.bits.join('');
  }
}

describe('AddThemeDialog component', () => {
  let store: AppState;

  beforeEach(() => {
    overrideRendererPlatform('darwin');
    ({ state: store } = window.app);
    store.isThemeDialogShowing = true;
  });

  function renderAddThemeDialog() {
    return renderClassComponentWithInstanceRef(AddThemeDialog, {
      appState: store,
    });
  }

  it('renders the dialog when open', () => {
    renderAddThemeDialog();

    expect(screen.getByText('Add theme')).toBeInTheDocument();
    expect(screen.getByText('Select the Monaco file...')).toBeInTheDocument();
  });

  it('displays Add button as disabled when no file selected', () => {
    renderAddThemeDialog();

    const addButton = screen.getByRole('button', { name: /add/i });
    expect(addButton).toBeDisabled();
  });

  it('displays Cancel button that closes dialog', () => {
    renderAddThemeDialog();

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    expect(cancelButton).toBeInTheDocument();

    fireEvent.click(cancelButton);
    expect(store.isThemeDialogShowing).toBe(false);
  });

  describe('createNewThemeFromMonaco()', () => {
    it('handles invalid input', async () => {
      const { instance } = renderAddThemeDialog();

      await expect(
        instance.createNewThemeFromMonaco('', {} as LoadedFiddleTheme),
      ).rejects.toThrow('Filename  not found');

      expect(window.ElectronFiddle.createThemeFile).toHaveBeenCalledTimes(0);
      expect(store.setTheme).toHaveBeenCalledTimes(0);
    });

    it('handles valid input', async () => {
      const { instance } = renderAddThemeDialog();

      const themePath = '~/.electron-fiddle/themes/testingLight';
      vi.mocked(window.ElectronFiddle.createThemeFile).mockResolvedValue({
        file: themePath,
      } as LoadedFiddleTheme);

      await instance.createNewThemeFromMonaco('testingLight', defaultLight);

      expect(window.ElectronFiddle.createThemeFile).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Fiddle (Light)',
          common: expect.anything(),
          file: 'defaultLight',
        }),
        'testingLight',
      );
      expect(store.setTheme).toHaveBeenCalledWith(themePath);
    });
  });

  describe('onSubmit()', () => {
    it('does nothing if there is no file currently set', async () => {
      const { instance } = renderAddThemeDialog();

      instance.createNewThemeFromMonaco = vi.fn();
      const onCloseSpy = vi.spyOn(instance, 'onClose');

      await instance.onSubmit();

      expect(instance.createNewThemeFromMonaco).toHaveBeenCalledTimes(0);
      expect(onCloseSpy).toHaveBeenCalledTimes(0);
    });

    it('loads a theme if a file is currently set', async () => {
      const { instance } = renderAddThemeDialog();

      const file = new FileMock(
        [JSON.stringify(defaultLight.editor)],
        'file.json',
        '/test/file.json',
        'application/json',
      );
      const spy = vi.spyOn(file, 'text');

      instance.setState({ file: file as unknown as File });

      instance.createNewThemeFromMonaco = vi.fn();
      const onCloseSpy = vi.spyOn(instance, 'onClose');

      await instance.onSubmit();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(instance.createNewThemeFromMonaco).toHaveBeenCalledTimes(1);
      expect(onCloseSpy).toHaveBeenCalledTimes(1);
    });

    it('shows an error dialog for a malformed theme', async () => {
      store.showErrorDialog = vi.fn().mockResolvedValueOnce(true);
      const { instance } = renderAddThemeDialog();

      const file = new FileMock(
        [JSON.stringify(defaultLight.editor)],
        'file.json',
        '/test/file.json',
        'application/json',
      );
      vi.spyOn(file, 'text').mockResolvedValue('{}');

      instance.setState({ file: file as unknown as File });

      const onCloseSpy = vi.spyOn(instance, 'onClose');

      await instance.onSubmit();

      expect(store.showErrorDialog).toHaveBeenCalledWith(
        expect.stringMatching(/file does not match specifications/i),
      );
      expect(onCloseSpy).not.toHaveBeenCalled();
    });
  });

  describe('onChangeFile()', () => {
    it('handles valid input', async () => {
      const { instance } = renderAddThemeDialog();

      const files = ['one', 'two'];
      await instance.onChangeFile({
        target: { files } as unknown as EventTarget,
      } as React.FormEvent<HTMLInputElement>);

      await waitFor(() => {
        expect(instance.state.file).toBe(files[0]);
      });
    });

    it('handles no input', async () => {
      const { instance } = renderAddThemeDialog();

      await instance.onChangeFile({
        target: { files: null } as unknown as EventTarget,
      } as React.FormEvent<HTMLInputElement>);

      expect(instance.state.file).toBeUndefined();
    });
  });

  describe('onClose()', () => {
    it('resets state and hides dialog', () => {
      const { instance } = renderAddThemeDialog();

      instance.setState({ file: {} as File });
      instance.onClose();

      expect(instance.state.file).toBeUndefined();
      expect(store.isThemeDialogShowing).toBe(false);
    });
  });
});
