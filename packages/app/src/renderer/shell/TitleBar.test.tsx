/** Tests the title bar: what it shows per platform and width, the macOS double-click, and the menu bar on Windows and Linux. */
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  windowApi: {
    DoubleClickTitleBar: vi.fn(() => Promise.resolve()),
    ActivateMenuItem: vi.fn((_id: string) => Promise.resolve()),
  },
  log: { error: vi.fn() },
}));

vi.mock('../../ipc/renderer', () => ({ windowApi: mocks.windowApi }));
vi.mock('../features/about/log', () => ({ log: mocks.log }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
// The capsule's and the right group's controls are their own features: stand-ins that show what the bar asked for.
vi.mock('../features/run/RunButton', () => ({
  RunButton: ({ compact }: { compact?: boolean }) => (
    <button type="button" data-compact={compact}>
      run
    </button>
  ),
}));
vi.mock('../features/gists/PublishButton', () => ({
  PublishButton: ({ compact }: { compact?: boolean }) => (
    <button type="button" data-compact={compact}>
      publish
    </button>
  ),
}));
vi.mock('../features/gists/OpenGistButton', () => ({
  OpenGistButton: () => <button type="button">open gist</button>,
}));
vi.mock('../features/versions/VersionPicker', () => ({
  VersionPicker: ({ className }: { className?: string }) => (
    <button type="button" className={className}>
      version
    </button>
  ),
}));

import type { MenuBarModel } from '../../shared/stores';
import { TitleBar } from './TitleBar';

type Props = ComponentProps<typeof TitleBar>;

const MENU_BAR: MenuBarModel = [
  {
    kind: 'submenu',
    id: 'menu:file',
    label: 'File',
    enabled: true,
    children: [
      { kind: 'item', id: 'file.newFiddle', label: 'New fiddle', enabled: true },
      { kind: 'separator' },
      { kind: 'item', id: 'role:quit', label: 'Exit', enabled: true },
    ],
  },
  {
    kind: 'submenu',
    id: 'menu:help',
    label: 'Help',
    enabled: true,
    children: [{ kind: 'item', id: 'help.about', label: 'About', enabled: true }],
  },
];

function setup(overrides: Partial<Props> = {}) {
  const props: Props = {
    name: 'My fiddle',
    dirty: false,
    platform: 'linux',
    sidebar: true,
    settingsOpen: false,
    onToggleSidebar: vi.fn(),
    onToggleSettings: vi.fn(),
    ...overrides,
  };
  return { ...render(<TitleBar {...props} />), props };
}

const resizeTo = (width: number) =>
  act(() => {
    window.innerWidth = width;
    window.dispatchEvent(new Event('resize'));
  });
const compact = (name: string) => screen.getByRole('button', { name }).dataset.compact;

beforeEach(() => {
  window.innerWidth = 1280;
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('TitleBar', () => {
  it('names the fiddle, marking it edited while it has unsaved changes', () => {
    const { rerender, props } = setup();
    screen.getByText('My fiddle');
    expect(screen.queryByText('edited')).toBeNull();
    rerender(<TitleBar {...props} dirty />);
    screen.getByText('edited');
  });

  it('toggles the sidebar and the Settings page from its two buttons, which say what they will do', () => {
    const { props, rerender } = setup({ settingsOpen: true });
    fireEvent.click(screen.getByRole('button', { name: 'hideSidebar' }));
    expect(props.onToggleSidebar).toHaveBeenCalledOnce();
    const settings = screen.getByRole('button', { name: 'settings' });
    expect(settings.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(settings);
    expect(props.onToggleSettings).toHaveBeenCalledOnce();

    rerender(<TitleBar {...props} sidebar={false} settingsOpen={false} />);
    screen.getByRole('button', { name: 'showSidebar' });
    expect(
      screen.getByRole('button', { name: 'settings' }).getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('shows everything in a wide window and gives up the Publish label, then Open gist and the Run hint, as it narrows', () => {
    setup({ platform: 'win32', menuBar: MENU_BAR });
    screen.getByRole('button', { name: 'open gist' });
    expect(compact('publish')).toBe('false');
    expect(compact('run')).toBe('false');

    resizeTo(700);
    expect(compact('publish')).toBe('true');
    screen.getByRole('button', { name: 'open gist' });
    expect(compact('run')).toBe('false');

    resizeTo(600);
    expect(screen.queryByRole('button', { name: 'open gist' })).toBeNull();
    expect(compact('run')).toBe('true');
  });

  describe('on macOS', () => {
    it('asks main to zoom or minimize on a double-click on empty title bar space, not on a control', () => {
      setup({ platform: 'darwin' });
      fireEvent.doubleClick(screen.getByRole('button', { name: 'run' }));
      fireEvent.doubleClick(screen.getByRole('button', { name: 'settings' }));
      expect(mocks.windowApi.DoubleClickTitleBar).not.toHaveBeenCalled();
      fireEvent.doubleClick(screen.getByText('My fiddle'));
      expect(mocks.windowApi.DoubleClickTitleBar).toHaveBeenCalledOnce();
    });

    it('logs a double-click main could not handle', async () => {
      mocks.windowApi.DoubleClickTitleBar.mockRejectedValueOnce(new Error('gone'));
      setup({ platform: 'darwin' });
      fireEvent.doubleClick(screen.getByText('My fiddle'));
      await vi.waitFor(() =>
        expect(mocks.log.error).toHaveBeenCalledWith(
          'title bar double-click failed',
          expect.any(Error),
        ),
      );
    });
  });

  describe('on Windows and Linux', () => {
    it('leaves a double-click alone', () => {
      setup({ platform: 'win32' });
      fireEvent.doubleClick(screen.getByText('My fiddle'));
      expect(mocks.windowApi.DoubleClickTitleBar).not.toHaveBeenCalled();
    });

    it('draws the application menu as a menu bar of its submenus and activates the chosen item in main', () => {
      // A stray top-level item never comes from main; the bar shows only the submenus either way.
      setup({
        menuBar: [
          ...MENU_BAR,
          { kind: 'item', id: 'stray', label: 'Stray', enabled: true },
        ],
      });
      screen.getByRole('menubar', { name: 'menuBar' });
      expect(screen.queryByRole('menuitem', { name: 'Stray' })).toBeNull();
      fireEvent.mouseDown(screen.getByRole('menuitem', { name: 'File' }), { button: 0 });
      fireEvent.click(screen.getByRole('menuitem', { name: 'New fiddle' }));
      expect(mocks.windowApi.ActivateMenuItem).toHaveBeenCalledWith('file.newFiddle');
    });

    it('logs a menu item main could not run', async () => {
      mocks.windowApi.ActivateMenuItem.mockRejectedValueOnce(new Error('no window'));
      setup({ menuBar: MENU_BAR });
      fireEvent.mouseDown(screen.getByRole('menuitem', { name: 'Help' }), { button: 0 });
      fireEvent.click(screen.getByRole('menuitem', { name: 'About' }));
      await vi.waitFor(() =>
        expect(mocks.log.error).toHaveBeenCalledWith(
          'menu item help.about failed',
          expect.any(Error),
        ),
      );
    });
  });

  describe('fiddle name beside the menus', () => {
    /** jsdom has no layout: the name's box reports `width`, read again on every window resize. */
    function nameWidth(initial: number) {
      let width = initial;
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
        this: HTMLElement,
      ) {
        return this.textContent?.startsWith('My fiddle') ? width : 0;
      });
      return (next: number) => {
        width = next;
        act(() => void window.dispatchEvent(new Event('resize')));
      };
    }
    const nameBox = () => screen.getByText('My fiddle').parentElement!;

    it('hides rather than show a sliver, and comes back only with room to spare', () => {
      const setWidth = nameWidth(120);
      setup({ menuBar: MENU_BAR });
      expect(nameBox().hasAttribute('data-hidden')).toBe(false);
      setWidth(47);
      expect(nameBox().getAttribute('data-hidden')).toBe('true');
      // Between the two thresholds it stays as it is, either way.
      setWidth(60);
      expect(nameBox().getAttribute('data-hidden')).toBe('true');
      setWidth(64);
      expect(nameBox().hasAttribute('data-hidden')).toBe(false);
      setWidth(50);
      expect(nameBox().hasAttribute('data-hidden')).toBe(false);
    });

    it('is set apart from the menus only while there is a menu bar', () => {
      nameWidth(120);
      const { rerender, props } = setup({ menuBar: MENU_BAR });
      expect(nameBox().getAttribute('data-after-menus')).toBe('true');
      rerender(<TitleBar {...props} menuBar={undefined} />);
      expect(nameBox().hasAttribute('data-after-menus')).toBe(false);
    });
  });

  describe('room for the menus', () => {
    /**
     * Lays the bar out by hand: the header `bar` px wide from 0, the menus starting at `menusLeft`, the capsule
     * `capsule` px wide with a full-width picker, every menu title 60px and the More button 28px. It leans on the
     * DOM as the components draw it: the title bar is the HEADER, the capsule the role="group", the menus' box the
     * element around the role="menubar", and MenuBar measures unseen copies of its titles in its
     * aria-hidden="true" element, where only the More button holds an svg.
     */
    function layOut({
      bar,
      menusLeft,
      capsule,
    }: {
      bar: number;
      menusLeft: number;
      capsule: number;
    }) {
      const rect = (left: number, width: number) =>
        ({ left, width, right: left + width, top: 0, bottom: 28, height: 28 }) as DOMRect;
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
        function (this: HTMLElement) {
          if (this.tagName === 'HEADER') return rect(0, bar);
          if (this.getAttribute('role') === 'group')
            return rect((bar - capsule) / 2, capsule);
          if (this.textContent === 'version') return rect((bar - capsule) / 2, 180);
          if (this.querySelector('[role="menubar"]')) return rect(menusLeft, 0);
          return rect(0, 0);
        },
      );
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
        this: HTMLElement,
      ) {
        if (this.parentElement?.getAttribute('aria-hidden') !== 'true') return 0;
        return this.querySelector('svg') ? 28 : 60;
      });
    }
    const titles = () =>
      [...screen.getByRole('menubar').querySelectorAll('[role="menuitem"]')].map(
        (node) => node.getAttribute('aria-label') ?? node.textContent,
      );
    const menus = (count: number): MenuBarModel =>
      Array.from({ length: count }, (_, i) => ({
        kind: 'submenu',
        id: `menu:${i}`,
        label: `Menu ${i}`,
        enabled: true,
        children: [{ kind: 'item', id: `item:${i}`, label: `Item ${i}`, enabled: true }],
      }));

    // The titles get what is free beside the centred capsule past the bar's 12px padding, from where the menus
    // start, less the divider's 25px (a 12px gap each side of the hairline) and the 12px gap before the capsule.
    // A 976px bar with a 300px capsule: (976 − 24 − 300) / 2 = 326 free, so 12 + 326 − 60 − 25 − 12 = 241 for
    // titles, and four (240) just fit. Both cases leave a pixel: one 12px term off and the fold flips.
    it('lets the titles run up to where the capsule sits centred, and folds the rest before pushing it', () => {
      layOut({ bar: 976, menusLeft: 60, capsule: 300 });
      const { rerender, props } = setup({ menuBar: menus(4) });
      expect(titles()).toEqual(['Menu 0', 'Menu 1', 'Menu 2', 'Menu 3']);
      // A 1028px bar leaves 12 + 352 − 60 − 37 = 267. Five titles take 300: three stay beside More
      // (28 + 180 ≤ 267) and a fourth (268) just doesn't.
      layOut({ bar: 1028, menusLeft: 60, capsule: 300 });
      rerender(<TitleBar {...props} menuBar={menus(5)} />);
      expect(titles()).toEqual(['Menu 0', 'Menu 1', 'Menu 2', 'menuBarMore']);
    });
  });
});
