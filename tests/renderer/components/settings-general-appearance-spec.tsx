import * as React from 'react';

import { IItemRendererProps } from '@blueprintjs/select';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AppearanceSettings,
  filterItem,
  renderItem,
} from '../../../src/renderer/components/settings-general-appearance';
import { AppState } from '../../../src/renderer/state';
import { FiddleTheme, LoadedFiddleTheme } from '../../../src/themes-defaults';

const mockThemes = [
  {
    name: 'defaultDark',
    file: 'defaultDark',
  } as LoadedFiddleTheme,
];
const doNothingFunc = () => {
  // Do Nothing
};

describe('AppearanceSettings component', () => {
  let store: AppState;

  beforeEach(() => {
    ({ state: store } = window.app);

    vi.mocked(window.ElectronFiddle.getAvailableThemes).mockResolvedValue(
      mockThemes,
    );
  });

  it('renders', () => {
    render(
      <AppearanceSettings
        appState={store}
        toggleHasPopoverOpen={doNothingFunc}
      />,
    );

    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Sync theme with system setting'),
    ).toBeInTheDocument();
  });

  it('renders the correct selected theme', async () => {
    store.theme = 'defaultDark';
    render(
      <AppearanceSettings
        appState={store}
        toggleHasPopoverOpen={doNothingFunc}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('defaultDark')).toBeInTheDocument();
    });
  });

  it('handles a theme change', () => {
    const ref = React.createRef<any>();
    render(
      <AppearanceSettings
        appState={store}
        toggleHasPopoverOpen={doNothingFunc}
        ref={ref}
      />,
    );
    const instance = ref.current;
    instance.handleChange({ file: 'defaultLight' } as LoadedFiddleTheme);

    expect(store.setTheme).toHaveBeenCalledWith('defaultLight');
  });

  it('toggles popover toggle event', async () => {
    const user = userEvent.setup();
    const toggleFunc = vi.fn();
    store.isUsingSystemTheme = false;
    render(
      <AppearanceSettings appState={store} toggleHasPopoverOpen={toggleFunc} />,
    );

    // Find the button by its id
    const button = document.getElementById('open-theme-selector')!;

    // Simulate opening the theme selector
    await user.click(button);
    expect(toggleFunc).toHaveBeenCalledTimes(1);

    // Simulate closing the theme selector
    await user.click(button);
    expect(toggleFunc).toHaveBeenCalledTimes(2);
  });

  describe('openThemeFolder()', () => {
    it('attempts to open the folder', async () => {
      const ref = React.createRef<any>();
      render(
        <AppearanceSettings
          appState={store}
          toggleHasPopoverOpen={doNothingFunc}
          ref={ref}
        />,
      );
      const instance = ref.current;
      await instance.openThemeFolder();

      expect(window.ElectronFiddle.openThemeFolder).toHaveBeenCalled();
    });

    it('handles an error', async () => {
      const ref = React.createRef<any>();
      render(
        <AppearanceSettings
          appState={store}
          toggleHasPopoverOpen={doNothingFunc}
          ref={ref}
        />,
      );
      const instance = ref.current;
      vi.mocked(window.ElectronFiddle.openThemeFolder).mockRejectedValue(
        new Error('Bwap'),
      );

      expect(await instance.openThemeFolder()).toBe(false);
    });
  });

  describe('createNewThemeFromCurrent()', () => {
    it('creates a new file from the current theme', async () => {
      const ref = React.createRef<any>();
      render(
        <AppearanceSettings
          appState={store}
          toggleHasPopoverOpen={doNothingFunc}
          ref={ref}
        />,
      );
      const instance = ref.current;
      await instance.createNewThemeFromCurrent();

      expect(window.ElectronFiddle.createThemeFile).toHaveBeenCalledWith(
        expect.objectContaining({
          common: expect.anything(),
        }),
      );
    });

    it('adds the newly created theme to the Themes dropdown', async () => {
      const arr: Array<LoadedFiddleTheme> = [];
      vi.mocked(window.ElectronFiddle.getAvailableThemes).mockResolvedValue(
        arr,
      );
      vi.mocked(window.ElectronFiddle.createThemeFile).mockImplementation(
        async (theme: FiddleTheme) => {
          const loadedTheme = {
            ...theme,
            name: '',
            file: '',
          };
          arr.push(loadedTheme);
          return loadedTheme;
        },
      );
      const ref = React.createRef<any>();
      render(
        <AppearanceSettings
          appState={store}
          toggleHasPopoverOpen={doNothingFunc}
          ref={ref}
        />,
      );
      const instance = ref.current;

      // Initially no themes
      expect(instance.state.themes).toHaveLength(0);

      await instance.createNewThemeFromCurrent();

      await waitFor(() => {
        expect(instance.state.themes).toHaveLength(1);
      });
    });

    it('handles an error', async () => {
      const ref = React.createRef<any>();
      render(
        <AppearanceSettings
          appState={store}
          toggleHasPopoverOpen={doNothingFunc}
          ref={ref}
        />,
      );
      const instance = ref.current;
      vi.mocked(window.ElectronFiddle.createThemeFile).mockRejectedValue(
        new Error('Bwap'),
      );

      const result = await instance.createNewThemeFromCurrent();
      expect(result).toBe(false);
    });
  });

  describe('handleAddTheme()', () => {
    it('refreshes the Themes dropdown', async () => {
      const arr: Array<LoadedFiddleTheme> = [];
      vi.mocked(window.ElectronFiddle.getAvailableThemes).mockResolvedValue(
        arr,
      );
      const ref = React.createRef<any>();
      render(
        <AppearanceSettings
          appState={store}
          toggleHasPopoverOpen={doNothingFunc}
          ref={ref}
        />,
      );
      expect(window.ElectronFiddle.getAvailableThemes).toHaveBeenCalledTimes(1);
      const instance = ref.current;
      const promise = instance.handleAddTheme();
      store.isTokenDialogShowing = false;
      await promise;
      expect(window.ElectronFiddle.getAvailableThemes).toHaveBeenCalledTimes(2);
    });
  });

  describe('filterItem()', () => {
    it('filters', () => {
      const foo = filterItem('foo', { name: 'foo' } as LoadedFiddleTheme);
      expect(foo).toBe(true);

      const bar = filterItem('foo', { name: 'bar' } as LoadedFiddleTheme);
      expect(bar).toBe(false);
    });
  });

  describe('renderItem()', () => {
    const mockItemProps: IItemRendererProps = {
      handleClick: () => ({}),
      index: 0,
      modifiers: {
        active: false,
        disabled: false,
        matchesPredicate: true,
      },
      query: '',
    };

    it('returns null for non-matching', () => {
      const result = renderItem({ name: 'foo' } as LoadedFiddleTheme, {
        ...mockItemProps,
        modifiers: {
          ...mockItemProps.modifiers,
          matchesPredicate: false,
        },
      });

      expect(result).toBe(null);
    });

    it('returns a MenuItem for matching', () => {
      const result = renderItem({ name: 'foo' } as LoadedFiddleTheme, {
        ...mockItemProps,
      });

      expect(result).not.toBe(null);
      expect(result).toBeTruthy();
    });
  });
});
