import * as React from 'react';

import { IItemRendererProps } from '@blueprintjs/select';
import { shell } from 'electron';
import { shallow } from 'enzyme';

import {
  AppearanceSettings,
  filterItem,
  renderItem,
} from '../../../src/renderer/components/settings-general-appearance';
import { AppState } from '../../../src/renderer/state';
import {
  createThemeFile,
  getAvailableThemes,
} from '../../../src/renderer/themes';
import {
  FiddleTheme,
  LoadedFiddleTheme,
} from '../../../src/renderer/themes-defaults';

const mockThemes = [
  {
    name: 'defaultDark',
    file: 'defaultDark',
  },
];
const doNothingFunc = () => {
  // Do Nothing
};

jest.mock('../../../src/renderer/themes', () => ({
  THEMES_PATH: '~/.electron-fiddle/themes',
  createThemeFile: jest.fn(),
  getAvailableThemes: jest.fn(),
  getTheme: () =>
    Promise.resolve({
      common: {},
    }),
}));

describe('AppearanceSettings component', () => {
  let store: AppState;

  beforeEach(() => {
    ({ state: store } = window.ElectronFiddle.app);

    (getAvailableThemes as jest.Mock).mockResolvedValue(mockThemes);
  });

  it('renders', () => {
    const wrapper = shallow(
      <AppearanceSettings
        appState={store}
        toggleHasPopoverOpen={doNothingFunc}
      />,
    );

    expect(wrapper).toMatchSnapshot();
  });

  it('renders the correct selected theme', async () => {
    store.theme = 'defaultDark';
    const wrapper = shallow(
      <AppearanceSettings
        appState={store}
        toggleHasPopoverOpen={doNothingFunc}
      />,
    );

    await process.nextTick;
    expect((wrapper.state() as any).selectedTheme.name).toBe('defaultDark');
  });

  it('handles a theme change', () => {
    const wrapper = shallow(
      <AppearanceSettings
        appState={store}
        toggleHasPopoverOpen={doNothingFunc}
      />,
    );
    const instance: any = wrapper.instance() as any;
    instance.handleChange({ file: 'defaultLight' } as any);

    expect(store.setTheme).toHaveBeenCalledWith('defaultLight');
  });

  it('toggles popover toggle event', () => {
    const toggleFunc = jest.fn();
    const wrapper = shallow(
      <AppearanceSettings appState={store} toggleHasPopoverOpen={toggleFunc} />,
    );

    // Find the button
    const button = wrapper.find('#open-theme-selector');

    // Simulate opening the theme selector
    button.simulate('click');
    expect(toggleFunc).toHaveBeenCalledTimes(1);

    // Simulate closing the theme selector
    button.simulate('click');
    expect(toggleFunc).toHaveBeenCalledTimes(2);
  });

  describe('openThemeFolder()', () => {
    it('attempts to open the folder', async () => {
      const wrapper = shallow(
        <AppearanceSettings
          appState={store}
          toggleHasPopoverOpen={doNothingFunc}
        />,
      );
      const instance: any = wrapper.instance() as any;
      await instance.openThemeFolder();

      expect(shell.showItemInFolder).toHaveBeenCalled();
    });

    it('handles an error', async () => {
      const wrapper = shallow(
        <AppearanceSettings
          appState={store}
          toggleHasPopoverOpen={doNothingFunc}
        />,
      );
      const instance: any = wrapper.instance() as any;
      (shell.showItemInFolder as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Bwap');
      });

      expect(await instance.openThemeFolder()).toBe(false);
    });
  });

  describe('createNewThemeFromCurrent()', () => {
    it('creates a new file from the current theme', async () => {
      const wrapper = shallow(
        <AppearanceSettings
          appState={store}
          toggleHasPopoverOpen={doNothingFunc}
        />,
      );
      const instance: any = wrapper.instance() as any;
      await instance.createNewThemeFromCurrent();

      expect(createThemeFile).toHaveBeenCalledWith(
        expect.objectContaining({
          common: expect.anything(),
        }),
      );
    });

    it('adds the newly created theme to the Themes dropdown', async () => {
      const arr: Array<FiddleTheme> = [];
      (getAvailableThemes as jest.Mock).mockResolvedValue(arr);
      (createThemeFile as jest.Mock).mockImplementation(
        (theme: FiddleTheme) => {
          arr.push(theme);
        },
      );
      const wrapper = shallow(
        <AppearanceSettings
          appState={store}
          toggleHasPopoverOpen={doNothingFunc}
        />,
      );
      expect(wrapper.state('themes')).toHaveLength(0);
      const instance: any = wrapper.instance() as any;
      await instance.createNewThemeFromCurrent();
      expect(wrapper.state('themes')).toHaveLength(1);
    });

    it('handles an error', async () => {
      const wrapper = shallow(
        <AppearanceSettings
          appState={store}
          toggleHasPopoverOpen={doNothingFunc}
        />,
      );
      const instance: any = wrapper.instance() as any;
      (createThemeFile as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Bwap');
      });

      const result = await instance.createNewThemeFromCurrent();
      expect(result).toBe(false);
    });
  });

  describe('handleAddTheme()', () => {
    it('refreshes the Themes dropdown', async () => {
      const arr: Array<LoadedFiddleTheme> = [];
      (getAvailableThemes as jest.Mock).mockResolvedValue(arr);
      const wrapper = shallow(
        <AppearanceSettings
          appState={store}
          toggleHasPopoverOpen={doNothingFunc}
        />,
      );
      expect(getAvailableThemes).toHaveBeenCalledTimes(1);
      const instance: any = wrapper.instance() as any;
      const promise = instance.handleAddTheme();
      store.isTokenDialogShowing = false;
      await promise;
      expect(getAvailableThemes).toHaveBeenCalledTimes(2);
    });
  });

  describe('filterItem()', () => {
    it('filters', () => {
      const foo = filterItem('foo', { name: 'foo' } as any);
      expect(foo).toBe(true);

      const bar = filterItem('foo', { name: 'bar' } as any);
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
      const result = renderItem({ name: 'foo' } as any, {
        ...mockItemProps,
        modifiers: {
          ...mockItemProps.modifiers,
          matchesPredicate: false,
        },
      });

      expect(result).toBe(null);
    });

    it('returns a MenuItem for matching', () => {
      const result = renderItem({ name: 'foo' } as any, {
        ...mockItemProps,
      });

      expect(result).toMatchSnapshot();
    });
  });
});
