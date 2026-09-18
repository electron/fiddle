import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deriveMnemonics, MenuBar, type MenuBarMenu } from './MenuBar';

afterEach(() => {
  vi.useRealTimers();
});

const submenu = (
  id: string,
  label: string,
  children: MenuBarMenu['children'],
): MenuBarMenu => ({
  kind: 'submenu',
  id,
  label,
  enabled: true,
  children,
});
const item = (
  id: string,
  label: string,
  extra: {
    enabled?: boolean;
    checked?: boolean;
    radio?: boolean;
    accelerator?: string;
  } = {},
) => ({
  kind: 'item' as const,
  id,
  label,
  enabled: extra.enabled ?? true,
  ...(extra.checked === undefined ? {} : { checked: extra.checked }),
  ...(extra.radio ? { radio: true } : {}),
  ...(extra.accelerator === undefined ? {} : { accelerator: extra.accelerator }),
});

const MENUS: MenuBarMenu[] = [
  submenu('menu:file', 'File', [
    item('file.newFiddle', 'New fiddle', { accelerator: 'Ctrl+N' }),
    submenu('menu:openRecent', 'Open recent', [
      item('recent:0', '/tmp/one'),
      item('recent:1', '/tmp/two'),
    ]),
    item('file.save', 'Save', { enabled: false, accelerator: 'Ctrl+S' }),
    { kind: 'separator' },
    item('role:quit', 'Exit'),
  ]),
  submenu('menu:edit', 'Edit', [
    item('role:cut', 'Cut', { accelerator: 'Ctrl+X' }),
    item('role:copy', 'Copy', { accelerator: 'Ctrl+C' }),
  ]),
  submenu('menu:view', 'View', [
    item('editor.toggleSoftWrap', 'Soft wrap', { checked: true }),
    item('editor.toggleMinimap', 'Minimap', { checked: false }),
  ]),
  submenu('menu:help', 'Help', [item('help.about', 'About Electron Fiddle')]),
];

function setup(props: { menus?: MenuBarMenu[]; availableWidth?: () => number } = {}) {
  const onAction = vi.fn<(id: string) => void>();
  const result = render(
    <>
      <textarea aria-label="Editor" />
      <MenuBar
        menus={props.menus ?? MENUS}
        label="Application menu"
        moreLabel="More"
        menuLabel="Menu"
        availableWidth={props.availableWidth}
        onAction={onAction}
      />
    </>,
  );
  const editor = screen.getByRole('textbox', { name: 'Editor' });
  act(() => editor.focus());
  return { ...result, onAction, editor };
}

const title = (name: string) => screen.getByRole('menuitem', { name });
/** An open menu's name: the text (or label) of the title or item it hangs off. */
const menuName = (menu: HTMLElement) => {
  const anchor = document.getElementById(menu.getAttribute('aria-labelledby') ?? '');
  return anchor?.getAttribute('aria-label') ?? anchor?.textContent;
};
/** The open menus, outermost first. */
const openMenus = () => screen.queryAllByRole('menu').map(menuName);
const press = (key: string, init: KeyboardEventInit = {}) => {
  const target = document.activeElement ?? document.body;
  fireEvent.keyDown(target, { key, ...init });
  fireEvent.keyUp(target, { key, ...init });
};
/** Alt pressed and released with nothing in between. */
const tapAlt = () => {
  const target = document.activeElement ?? document.body;
  fireEvent.keyDown(target, { key: 'Alt', altKey: true });
  fireEvent.keyUp(target, { key: 'Alt' });
};
const focused = () => document.activeElement;
/** The bar's titles: their text, or the label of an icon button (More, Menu). */
const barTitles = () =>
  [...screen.getByRole('menubar').querySelectorAll('[role="menuitem"]')].map(
    (node) => node.getAttribute('aria-label') ?? node.textContent,
  );
/** The submenus an open menu lists. */
const submenusIn = (menu: string) =>
  [
    ...screen
      .getByRole('menu', { name: menu })
      .querySelectorAll(':scope > [aria-haspopup="menu"]'),
  ].map((node) => node.textContent);
/**
 * Widths for the unseen specimens the bar measures: every title 60px, the More button 28px
 * (jsdom lays nothing out). Returns the spy to restore.
 */
function mockTitleWidths() {
  return vi
    .spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
    .mockImplementation(function (this: HTMLElement) {
      if (
        !this.parentElement ||
        this.parentElement.getAttribute('aria-hidden') !== 'true'
      )
        return 0;
      return this.querySelector('svg') ? 28 : 60;
    });
}

describe('MenuBar', () => {
  it('is a named menu bar of titles, with no menu open', () => {
    setup();
    const bar = screen.getByRole('menubar', { name: 'Application menu' });
    expect(
      [...bar.querySelectorAll('[role="menuitem"]')].map((node) => node.textContent),
    ).toEqual(['File', 'Edit', 'View', 'Help']);
    expect(title('File').getAttribute('aria-haspopup')).toBe('menu');
    expect(title('File').getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens a menu on press without taking focus first, and closes it on a second press', () => {
    const { editor } = setup();
    // The press itself is cancelled, so the editor keeps focus until the menu takes it.
    expect(fireEvent.mouseDown(title('File'), { button: 0 })).toBe(false);
    expect(openMenus()).toEqual(['File']);
    expect(title('File').getAttribute('aria-expanded')).toBe('true');
    expect(focused()).toBe(screen.getByRole('menu', { name: 'File' }));
    // Items are named by their label and described by their key.
    expect(
      screen.getByRole('menuitem', { name: 'New fiddle', description: 'Ctrl+N' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('menuitem', { name: 'Save' }).getAttribute('aria-disabled'),
    ).toBe('true');
    expect(
      screen.getByRole('menuitem', { name: 'Open recent' }).getAttribute('aria-haspopup'),
    ).toBe('menu');
    expect(screen.getAllByRole('separator')).toHaveLength(1);
    fireEvent.mouseDown(title('File'), { button: 0 });
    expect(openMenus()).toEqual([]);
    expect(focused()).toBe(editor);
  });

  it('switches menus on hover while one is open, and not otherwise', () => {
    setup();
    fireEvent.mouseEnter(title('Edit'));
    expect(openMenus()).toEqual([]);
    fireEvent.mouseDown(title('File'), { button: 0 });
    fireEvent.mouseEnter(title('Edit'));
    expect(openMenus()).toEqual(['Edit']);
    expect(title('File').getAttribute('aria-expanded')).toBe('false');
    expect(title('Edit').getAttribute('aria-expanded')).toBe('true');
  });

  it('restores focus before it runs the chosen item, and ignores disabled ones', () => {
    const { onAction, editor } = setup();
    let focusedAtAction: Element | null = null;
    onAction.mockImplementation(() => void (focusedAtAction = focused()));
    fireEvent.mouseDown(title('File'), { button: 0 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Save' }));
    expect(onAction).not.toHaveBeenCalled();
    expect(openMenus()).toEqual(['File']);
    fireEvent.click(screen.getByRole('menuitem', { name: 'New fiddle' }));
    expect(onAction).toHaveBeenCalledWith('file.newFiddle');
    expect(focusedAtAction).toBe(editor);
    expect(openMenus()).toEqual([]);
  });

  it('shows checked items as menuitemcheckbox', () => {
    setup();
    fireEvent.mouseDown(title('View'), { button: 0 });
    expect(
      screen
        .getByRole('menuitemcheckbox', { name: 'Soft wrap' })
        .getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      screen
        .getByRole('menuitemcheckbox', { name: 'Minimap' })
        .getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('shows a radio group as menuitemradio, one checked', () => {
    setup({
      menus: [
        submenu('menu:showMe', 'Show me', [
          item('example:Menu', 'Menu', { checked: true, radio: true }),
          item('example:Tabs', 'Tabs', { checked: false, radio: true }),
        ]),
      ],
    });
    fireEvent.mouseDown(title('Show me'), { button: 0 });
    expect(
      screen.getByRole('menuitemradio', { name: 'Menu' }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      screen.getByRole('menuitemradio', { name: 'Tabs' }).getAttribute('aria-checked'),
    ).toBe('false');
    expect(screen.queryByRole('menuitemcheckbox')).toBeNull();
  });

  it('turns the window no-drag while the bar has the keyboard or a menu is open, so a title bar click reaches the page', () => {
    setup();
    const noDrag = () =>
      screen.getByRole('menubar').querySelector(':scope > [aria-hidden="true"]:empty');
    expect(noDrag()).toBeNull();
    fireEvent.mouseDown(title('File'), { button: 0 });
    expect(noDrag()).not.toBeNull();
    fireEvent.mouseDown(title('File'), { button: 0 });
    expect(noDrag()).toBeNull();
    tapAlt();
    expect(noDrag()).not.toBeNull();
    press('Escape');
    expect(noDrag()).toBeNull();
  });

  it('takes the keyboard on a lone Alt, underlines the mnemonics, and gives focus back on Escape', () => {
    const { editor } = setup();
    const bar = screen.getByRole('menubar');
    expect(bar.hasAttribute('data-mnemonics')).toBe(false);
    tapAlt();
    expect(focused()).toBe(title('File'));
    expect(bar.hasAttribute('data-mnemonics')).toBe(true);
    // Left and right move along the bar and wrap.
    press('ArrowRight');
    expect(focused()).toBe(title('Edit'));
    press('ArrowLeft');
    press('ArrowLeft');
    expect(focused()).toBe(title('Help'));
    press('Home');
    expect(focused()).toBe(title('File'));
    // Down opens with the first item focused; Up and Down move, skipping disabled items; End goes last.
    press('ArrowDown');
    expect(openMenus()).toEqual(['File']);
    expect(focused()).toBe(screen.getByRole('menuitem', { name: 'New fiddle' }));
    press('ArrowDown');
    expect(focused()).toBe(screen.getByRole('menuitem', { name: 'Open recent' }));
    press('ArrowDown');
    expect(focused()).toBe(screen.getByRole('menuitem', { name: 'Exit' }));
    press('ArrowDown');
    expect(focused()).toBe(screen.getByRole('menuitem', { name: 'New fiddle' }));
    press('End');
    expect(focused()).toBe(screen.getByRole('menuitem', { name: 'Exit' }));
    // Escape closes the menu but stays on the bar; a second Escape leaves.
    press('Escape');
    expect(openMenus()).toEqual([]);
    expect(focused()).toBe(title('File'));
    press('Escape');
    expect(focused()).toBe(editor);
    expect(bar.hasAttribute('data-mnemonics')).toBe(false);
    // A second Alt tap also leaves.
    tapAlt();
    expect(focused()).toBe(title('File'));
    tapAlt();
    expect(focused()).toBe(editor);
  });

  it('opens a menu with Alt and its mnemonic, and with the letter alone once the bar has the keyboard', () => {
    const { editor } = setup();
    press('f', { altKey: true });
    expect(openMenus()).toEqual(['File']);
    expect(focused()).toBe(screen.getByRole('menuitem', { name: 'New fiddle' }));
    // Alt+letter switches from inside a menu too; Enter runs.
    press('e', { altKey: true });
    expect(openMenus()).toEqual(['Edit']);
    expect(focused()).toBe(screen.getByRole('menuitem', { name: 'Cut' }));
    press('Escape');
    press('h');
    expect(openMenus()).toEqual(['Help']);
    press('Escape');
    press('Escape');
    expect(focused()).toBe(editor);
    // Shift+Alt+F is Format document's, AltGr (Ctrl+Alt on Windows) types characters, and Shift+F10 is the context menu's.
    press('F', { altKey: true, shiftKey: true });
    press('e', { altKey: true, ctrlKey: true });
    press('F10', { shiftKey: true });
    expect(openMenus()).toEqual([]);
    expect(focused()).toBe(editor);
    // F10 alone takes the keyboard like Alt.
    press('F10');
    expect(focused()).toBe(title('File'));
  });

  it('treats Alt with a click, or with another key, as no tap', () => {
    const { editor } = setup();
    fireEvent.keyDown(editor, { key: 'Alt', altKey: true });
    fireEvent.mouseDown(editor, { altKey: true });
    fireEvent.keyUp(editor, { key: 'Alt' });
    expect(focused()).toBe(editor);
    fireEvent.keyDown(editor, { key: 'Alt', altKey: true });
    fireEvent.keyDown(editor, { key: 'x', altKey: true });
    fireEvent.keyUp(editor, { key: 'x', altKey: true });
    fireEvent.keyUp(editor, { key: 'Alt' });
    expect(focused()).toBe(editor);
    fireEvent.keyDown(editor, { key: 'AltGraph' });
    fireEvent.keyUp(editor, { key: 'AltGraph' });
    expect(focused()).toBe(editor);
  });

  it('leaves Alt and the mnemonics to a dialog, or to a field recording a shortcut', () => {
    const { onAction } = setup();
    render(
      <div role="dialog">
        <input aria-label="In a dialog" />
        <input aria-label="Recorder" data-keybinding-recorder="" />
      </div>,
    );
    for (const name of ['In a dialog', 'Recorder']) {
      const field = screen.getByRole('textbox', { name });
      act(() => field.focus());
      tapAlt();
      press('f', { altKey: true });
      press('F10');
      expect(focused()).toBe(field);
      expect(openMenus()).toEqual([]);
    }
    expect(onAction).not.toHaveBeenCalled();
  });

  it('moves an open menu along the bar with Left and Right, and runs items with Enter', () => {
    const { onAction, editor } = setup();
    press('f', { altKey: true });
    press('ArrowRight');
    expect(openMenus()).toEqual(['Edit']);
    expect(focused()).toBe(screen.getByRole('menuitem', { name: 'Cut' }));
    press('ArrowLeft');
    expect(openMenus()).toEqual(['File']);
    press('ArrowLeft');
    expect(openMenus()).toEqual(['Help']);
    press('Enter');
    expect(onAction).toHaveBeenCalledWith('help.about');
    expect(focused()).toBe(editor);
  });

  it('opens a submenu on Right, Enter or a lingering pointer, and closes it on Left', () => {
    vi.useFakeTimers();
    const { onAction } = setup();
    press('f', { altKey: true });
    press('ArrowDown');
    expect(focused()).toBe(screen.getByRole('menuitem', { name: 'Open recent' }));
    press('ArrowRight');
    expect(openMenus()).toEqual(['File', 'Open recent']);
    expect(
      screen.getByRole('menuitem', { name: 'Open recent' }).getAttribute('aria-expanded'),
    ).toBe('true');
    expect(focused()).toBe(screen.getByRole('menuitem', { name: '/tmp/one' }));
    press('ArrowLeft');
    expect(openMenus()).toEqual(['File']);
    expect(focused()).toBe(screen.getByRole('menuitem', { name: 'Open recent' }));
    // Hovering opens it after a beat without moving focus into it; hovering a sibling closes it.
    fireEvent.mouseEnter(screen.getByRole('menuitem', { name: 'Exit' }));
    fireEvent.mouseEnter(screen.getByRole('menuitem', { name: 'Open recent' }));
    expect(openMenus()).toEqual(['File']);
    act(() => vi.advanceTimersByTime(250));
    expect(openMenus()).toEqual(['File', 'Open recent']);
    expect(focused()).toBe(screen.getByRole('menuitem', { name: 'Open recent' }));
    fireEvent.mouseEnter(screen.getByRole('menuitem', { name: 'New fiddle' }));
    act(() => vi.advanceTimersByTime(250));
    expect(openMenus()).toEqual(['File']);
    // Enter on the trigger opens it too, and an item in it runs like any other.
    press('ArrowDown');
    press('Enter');
    expect(openMenus()).toEqual(['File', 'Open recent']);
    press('ArrowDown');
    press('Enter');
    expect(onAction).toHaveBeenCalledWith('recent:1');
  });

  it('jumps to the next item that starts with a typed letter', () => {
    setup();
    press('f', { altKey: true });
    press('e');
    expect(focused()).toBe(screen.getByRole('menuitem', { name: 'Exit' }));
    press('o');
    expect(focused()).toBe(screen.getByRole('menuitem', { name: 'Open recent' }));
    // Save is disabled: nothing to jump to.
    press('s');
    expect(focused()).toBe(screen.getByRole('menuitem', { name: 'Open recent' }));
  });

  it('closes without pulling focus back when the user clicks elsewhere', () => {
    const { editor } = setup();
    fireEvent.mouseDown(title('File'), { button: 0 });
    fireEvent.mouseDown(editor);
    expect(openMenus()).toEqual([]);
    expect(title('File').getAttribute('aria-expanded')).toBe('false');
  });

  it('shows every title while they all fit', () => {
    const widths = mockTitleWidths();
    try {
      setup({ availableWidth: () => 240 });
      expect(barTitles()).toEqual(['File', 'Edit', 'View', 'Help']);
    } finally {
      widths.mockRestore();
    }
  });

  it('folds the titles that do not fit into a trailing More button, in order', () => {
    let room = 180;
    const widths = mockTitleWidths();
    try {
      const { onAction, editor } = setup({ availableWidth: () => room });
      // 60 + 60 + 28 fit in 180; View would not.
      expect(barTitles()).toEqual(['File', 'Edit', 'More']);
      fireEvent.mouseDown(title('More'), { button: 0 });
      expect(openMenus()).toEqual(['More']);
      expect(submenusIn('More')).toEqual(['View', 'Help']);
      // Hovering back to a title switches, as between titles.
      fireEvent.mouseEnter(title('Edit'));
      expect(openMenus()).toEqual(['Edit']);
      fireEvent.mouseEnter(title('More'));
      expect(openMenus()).toEqual(['More']);
      fireEvent.mouseDown(title('More'), { button: 0 });
      expect(openMenus()).toEqual([]);
      // Left and Right count the More button as a title; from inside its menu, Right moves on and wraps.
      tapAlt();
      press('ArrowLeft');
      expect(focused()).toBe(title('More'));
      press('ArrowDown');
      expect(openMenus()).toEqual(['More']);
      expect(focused()).toBe(screen.getByRole('menuitem', { name: 'View' }));
      press('ArrowRight');
      expect(openMenus()).toEqual(['More', 'View']);
      press('ArrowLeft');
      press('ArrowDown');
      expect(focused()).toBe(screen.getByRole('menuitem', { name: 'Help' }));
      press('Escape');
      press('ArrowRight');
      expect(focused()).toBe(title('File'));
      press('Escape');
      expect(focused()).toBe(editor);
      // A folded menu's mnemonic opens it inside More, on its first item.
      press('h', { altKey: true });
      expect(openMenus()).toEqual(['More', 'Help']);
      expect(title('More').getAttribute('aria-expanded')).toBe('true');
      expect(focused()).toBe(
        screen.getByRole('menuitem', { name: 'About Electron Fiddle' }),
      );
      press('Enter');
      expect(onAction).toHaveBeenCalledWith('help.about');
      expect(focused()).toBe(editor);
      // A shown menu's mnemonic still opens it in place.
      press('e', { altKey: true });
      expect(openMenus()).toEqual(['Edit']);
      press('Escape');
      press('Escape');
      // The window grew: everything is a title again. It shrank a little: one more folds.
      room = 400;
      act(() => void window.dispatchEvent(new Event('resize')));
      expect(barTitles()).toEqual(['File', 'Edit', 'View', 'Help']);
      room = 239;
      act(() => void window.dispatchEvent(new Event('resize')));
      expect(barTitles()).toEqual(['File', 'Edit', 'View', 'More']);
      fireEvent.mouseDown(title('More'), { button: 0 });
      expect(submenusIn('More')).toEqual(['Help']);
    } finally {
      widths.mockRestore();
    }
  });

  it('folds into one Menu button when not even two titles fit beside More, and unfolds when they do again', () => {
    let room = 100;
    const widths = mockTitleWidths();
    try {
      const { onAction } = setup({ availableWidth: () => room });
      // 60 + 28 fits in 100, but one title beside More isn't a menu bar: everything goes in the Menu button.
      expect(barTitles()).toEqual(['Menu']);
      fireEvent.mouseDown(title('Menu'), { button: 0 });
      expect(openMenus()).toEqual(['Menu']);
      expect(submenusIn('Menu')).toEqual(['File', 'Edit', 'View', 'Help']);
      fireEvent.mouseDown(title('Menu'), { button: 0 });
      // Alt+letter still reaches a folded menu.
      press('e', { altKey: true });
      expect(openMenus()).toEqual(['Menu', 'Edit']);
      expect(focused()).toBe(screen.getByRole('menuitem', { name: 'Cut' }));
      press('Enter');
      expect(onAction).toHaveBeenCalledWith('role:cut');
      // Two titles and More fit again.
      room = 150;
      act(() => void window.dispatchEvent(new Event('resize')));
      expect(barTitles()).toEqual(['File', 'Edit', 'More']);
    } finally {
      widths.mockRestore();
    }
  });

  it('closes its menus when the fold changes under them', () => {
    let room = 400;
    const widths = mockTitleWidths();
    try {
      setup({ availableWidth: () => room });
      fireEvent.mouseDown(title('Help'), { button: 0 });
      expect(openMenus()).toEqual(['Help']);
      room = 180;
      act(() => void window.dispatchEvent(new Event('resize')));
      expect(openMenus()).toEqual([]);
      expect(barTitles()).toEqual(['File', 'Edit', 'More']);
    } finally {
      widths.mockRestore();
    }
  });

  it('renders nothing without menus', () => {
    setup({ menus: [] });
    expect(screen.queryByRole('menubar')).toBeNull();
  });
});

describe('deriveMnemonics', () => {
  it('takes the first letter, then the next unused one on a collision', () => {
    expect(
      deriveMnemonics(['File', 'Edit', 'View', 'Run', 'Window', 'Help']).map(
        (m) => m?.key,
      ),
    ).toEqual(['f', 'e', 'v', 'r', 'w', 'h']);
    // German: Ansicht takes A, so Ausführen takes U.
    const german = deriveMnemonics([
      'Datei',
      'Bearbeiten',
      'Ansicht',
      'Ausführen',
      'Fenster',
      'Hilfe',
    ]);
    expect(german.map((m) => m?.key)).toEqual(['d', 'b', 'a', 'u', 'f', 'h']);
    expect(german[3]).toEqual({ index: 1, key: 'u' });
  });

  it('skips punctuation, works on any script, and gives up when every letter is taken', () => {
    expect(deriveMnemonics(['…More', 'ファイル', 'AB', 'BA', 'ab'])).toEqual([
      { index: 1, key: 'm' },
      { index: 0, key: 'フ' },
      { index: 0, key: 'a' },
      { index: 0, key: 'b' },
      undefined,
    ]);
  });
});
