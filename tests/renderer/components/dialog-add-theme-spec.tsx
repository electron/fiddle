import * as React from 'react';

import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderClassComponentWithInstanceRef } from '../../../rtl-spec/test-utils/renderClassComponentWithInstanceRef';
import { AddThemeDialog } from '../../../src/renderer/components/dialog-add-theme';
import { AppState } from '../../../src/renderer/state';
import { LoadedFiddleTheme, defaultLight } from '../../../src/themes-defaults';
import { overrideRendererPlatform } from '../../utils';

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
    // We render the buttons different depending on the
    // platform, so let' have a uniform platform for unit tests
    overrideRendererPlatform('darwin');

    ({ state: store } = window.app);
  });

  // TODO(dsanders11): Update this test to be accurate
  it('renders', () => {
    store.isThemeDialogShowing = true;
    render(<AddThemeDialog appState={store} />);

    expect(screen.getByText('Add theme')).toBeInTheDocument();
    expect(screen.getByText('Add')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  describe('createNewThemeFromMonaco()', () => {
    it('handles invalid input', async () => {
      store.isThemeDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(AddThemeDialog, {
        appState: store,
      });

      try {
        await (instance as any).createNewThemeFromMonaco(
          '',
          {} as LoadedFiddleTheme,
        );
      } catch (err: any) {
        expect(err.message).toEqual(`Filename  not found`);
        expect(window.ElectronFiddle.createThemeFile).toHaveBeenCalledTimes(0);
        expect(store.setTheme).toHaveBeenCalledTimes(0);
      }
    });

    it('handles valid input', async () => {
      store.isThemeDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(AddThemeDialog, {
        appState: store,
      });

      act(() => {
        (instance as any).setState({
          file: new FileMock(
            [JSON.stringify(defaultLight.editor)],
            'file.json',
            '/test/file.json',
            'application/json',
          ),
        });
      });

      const themePath = '~/.electron-fiddle/themes/testingLight';
      vi.mocked(window.ElectronFiddle.createThemeFile).mockResolvedValue({
        file: themePath,
      } as LoadedFiddleTheme);

      await (instance as any).createNewThemeFromMonaco(
        'testingLight',
        defaultLight,
      );

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
      store.isThemeDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(AddThemeDialog, {
        appState: store,
      });

      (instance as any).createNewThemeFromMonaco = vi.fn();
      (instance as any).onClose = vi.fn();

      await (instance as any).onSubmit();

      expect((instance as any).createNewThemeFromMonaco).toHaveBeenCalledTimes(
        0,
      );
      expect((instance as any).onClose).toHaveBeenCalledTimes(0);
    });

    it('loads a theme if a file is currently set', async () => {
      store.isThemeDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(AddThemeDialog, {
        appState: store,
      });

      const file = new FileMock(
        [JSON.stringify(defaultLight.editor)],
        'file.json',
        '/test/file.json',
        'application/json',
      );
      const spy = vi.spyOn(file, 'text');
      act(() => {
        (instance as any).setState({ file });
      });

      (instance as any).createNewThemeFromMonaco = vi.fn();
      (instance as any).onClose = vi.fn();

      await (instance as any).onSubmit();

      expect(spy).toHaveBeenCalledTimes(1);
      expect((instance as any).createNewThemeFromMonaco).toHaveBeenCalledTimes(
        1,
      );
      expect((instance as any).onClose).toHaveBeenCalledTimes(1);
    });

    it('shows an error dialog for a malformed theme', async () => {
      store.showErrorDialog = vi.fn().mockResolvedValueOnce(true);
      store.isThemeDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(AddThemeDialog, {
        appState: store,
      });

      const file = new FileMock(
        [JSON.stringify(defaultLight.editor)],
        'file.json',
        '/test/file.json',
        'application/json',
      );
      const spy = vi.spyOn(file, 'text').mockResolvedValue('{}');
      act(() => {
        (instance as any).setState({ file });
      });

      (instance as any).onClose = vi.fn();

      await (instance as any).onSubmit();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(store.showErrorDialog).toHaveBeenCalledWith(
        expect.stringMatching(/file does not match specifications/i),
      );
    });
  });

  describe('onChangeFile()', () => {
    it('handles valid input', async () => {
      store.isThemeDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(AddThemeDialog, {
        appState: store,
      });

      const files = ['one', 'two'];
      act(() => {
        (instance as any).onChangeFile({
          target: { files } as unknown as EventTarget,
        } as React.FormEvent<HTMLInputElement>);
      });
      expect((instance as any).state.file).toBe(files[0]);
    });

    it('handles no input', () => {
      store.isThemeDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(AddThemeDialog, {
        appState: store,
      });

      act(() => {
        (instance as any).onChangeFile({
          target: { files: null } as unknown as EventTarget,
        } as React.FormEvent<HTMLInputElement>);
      });
      expect((instance as any).state.file).toBeUndefined();
    });
  });
});
