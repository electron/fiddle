/**
 * A Windows and Linux style menu bar for the title bar, its menus drawn like
 * Menu.tsx's. react-aria has menus but no menu bar, and its menus are modal
 * (an underlay swallows the hover that switches menus), so the bar runs its
 * own, with the keyboard behaviour of a native one: arrows, first-letter
 * jumps, Alt or F10 to focus the bar, and Alt+letter mnemonics.
 *
 * Choosing an item closes everything and restores focus first, then calls
 * `onAction`, so Cut or Format document act on what had focus. Pressing a
 * title never takes focus itself.
 */
import {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../cx';
import { Icon } from '../icons/Icon';
import menuStyles from './Menu.module.css';
import styles from './MenuBar.module.css';

export type MenuBarNode =
  | {
      kind: 'submenu';
      id: string;
      label: string;
      enabled: boolean;
      children: MenuBarNode[];
    }
  | {
      kind: 'item';
      id: string;
      label: string;
      enabled: boolean;
      checked?: boolean;
      radio?: boolean;
      accelerator?: string;
    }
  | { kind: 'separator' };
export type MenuBarMenu = Extract<MenuBarNode, { kind: 'submenu' }>;
type MenuBarEntry = Exclude<MenuBarNode, { kind: 'separator' }>;

export interface MenuBarProps {
  /** The top-level menus: File, Edit, … */
  menus: MenuBarMenu[];
  /** Names the bar for screen readers. */
  label: string;
  /** Names the trailing button that holds the titles that don't fit ("More"). */
  moreLabel: string;
  /** Names the one button the whole bar folds into when not even two titles fit ("Menu"). */
  menuLabel: string;
  /** The width the titles may take, in px; asked again on resize. Without it nothing ever folds. */
  availableWidth?: () => number;
  /** Anything whose change should measure again, such as the width of what the bar must not run into. */
  measureKey?: unknown;
  /** Called with an item's `id` after the menus have closed and focus is back where it was. */
  onAction: (id: string) => void;
  className?: string;
}

/** A title's mnemonic: the letter Alt opens it with, and where it is in the label. */
export interface Mnemonic {
  index: number;
  key: string;
}

/** The first letter or digit of each label that no earlier label took, so translated labels get mnemonics too. */
export function deriveMnemonics(labels: readonly string[]): (Mnemonic | undefined)[] {
  const used = new Set<string>();
  return labels.map((label) => {
    let index = 0;
    for (const char of label) {
      const key = char.toLowerCase();
      if (/[\p{L}\p{N}]/u.test(char) && !used.has(key)) {
        used.add(key);
        return { index, key };
      }
      index += char.length;
    }
    return undefined;
  });
}

/** The ids of the trailing More button's menu, and of the one Menu button a bar too narrow for two titles folds into. */
const MORE_ID = 'menubar:more';
const MENU_ID = 'menubar:menu';
/** Fewer titles than this beside the More button, and the bar folds into the Menu button instead. */
const MIN_TITLES = 2;
/** Submenus open and close this long after the pointer arrives, so crossing an item doesn't flicker. */
const HOVER_DELAY = 200;
/** Menus keep this far from the window's edges. */
const MARGIN = 8;
/** Where Alt, F10 and mnemonics leave the keyboard alone: dialogs, and a field recording a shortcut. */
const INERT_TARGETS =
  '[role="dialog"], [role="alertdialog"], [aria-modal="true"], [data-keybinding-recorder]';

type FocusTarget =
  | { kind: 'title'; index: number }
  | { kind: 'item'; id: string }
  | { kind: 'panel'; id: string; which: 'first' | 'last' | 'panel' };

const isEntry = (node: MenuBarNode): node is MenuBarEntry => node.kind !== 'separator';
const isSubmenu = (node: MenuBarNode | undefined): node is MenuBarMenu =>
  node?.kind === 'submenu';

export function MenuBar({
  menus,
  label,
  moreLabel,
  menuLabel,
  availableWidth,
  measureKey,
  onAction,
  className,
}: MenuBarProps) {
  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  /** Where focus was before the bar took it; it goes back there on close. */
  const returnFocus = useRef<HTMLElement | null>(null);
  const pendingFocus = useRef<FocusTarget | null>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const alt = useRef({ down: false, alone: false });

  /** How many titles the bar shows, first to last; the rest are folded. */
  const [shown, setShown] = useState(Number.MAX_SAFE_INTEGER);
  /** The bar has the keyboard: a title is focused or a menu is open. */
  const [engaged, setEngaged] = useState(false);
  /** Engaged from the keyboard, which shows the mnemonics (Windows underlines them only then). */
  const [keyboard, setKeyboard] = useState(false);
  const [altHeld, setAltHeld] = useState(false);
  /** The title that has, or last had, the roving focus. */
  const [current, setCurrent] = useState(0);
  /** The open menus, outermost first: a title's menu, then its open submenus. */
  const [open, setOpen] = useState<string[]>([]);
  /** The first menu after opening animates in; switching along the bar doesn't. */
  const [entering, setEntering] = useState(false);

  // All the titles; or the ones that fit and a More button holding the rest; or one Menu button holding everything.
  const shownCount = Math.min(shown, menus.length);
  const folded = shownCount < menus.length;
  const compact = folded && shownCount < MIN_TITLES;
  const tops = useMemo<MenuBarMenu[]>(() => {
    if (!folded) return menus;
    if (compact)
      return [
        {
          kind: 'submenu',
          id: MENU_ID,
          label: menuLabel,
          enabled: true,
          children: menus,
        },
      ];
    const more: MenuBarMenu = {
      kind: 'submenu',
      id: MORE_ID,
      label: moreLabel,
      enabled: true,
      children: menus.slice(shownCount),
    };
    return [...menus.slice(0, shownCount), more];
  }, [folded, compact, shownCount, menus, moreLabel, menuLabel]);
  /** The title a menu opens from: its own, or the More or Menu button it's folded into. */
  const topIndexOf = (menuIndex: number) =>
    compact ? 0 : Math.min(menuIndex, shownCount);
  const mnemonics = useMemo(
    () => deriveMnemonics(menus.map((menu) => menu.label)),
    [menus],
  );
  const openTop = open.length > 0 ? tops.findIndex((menu) => menu.id === open[0]) : -1;
  /** The roving focus, kept on a title that exists. */
  const currentIndex = Math.min(current, Math.max(0, tops.length - 1));

  // The open path as menus, outermost first. A path entry whose menu is gone ends it.
  const panels: MenuBarMenu[] = [];
  for (
    let node: MenuBarMenu | undefined = tops[openTop];
    node && panels.length < open.length;
  ) {
    if (node.id !== open[panels.length]) break;
    panels.push(node);
    const next = open[panels.length];
    node = node.children.find(
      (child): child is MenuBarMenu => isSubmenu(child) && child.id === next,
    );
  }

  const domId = (kind: string, key: string | number) =>
    `${uid}-${kind}-${String(key).replace(/\s+/g, '_')}`;
  const titleDomId = (index: number) => domId('title', index);
  const panelDomId = (id: string) => domId('menu', id);
  const itemDomId = (id: string) => domId('item', id);

  const withinBar = (node: EventTarget | null) =>
    node instanceof Node &&
    ((rootRef.current?.contains(node) ?? false) ||
      (layerRef.current?.contains(node) ?? false));

  const enabledItems = (panel: HTMLElement) => [
    ...panel.querySelectorAll<HTMLElement>(
      ':scope > [data-menu-item]:not([aria-disabled="true"])',
    ),
  ];

  const focusTarget = (target: FocusTarget) => {
    let element: HTMLElement | null | undefined;
    if (target.kind === 'title')
      element = document.getElementById(titleDomId(target.index));
    else if (target.kind === 'item')
      element = document.getElementById(itemDomId(target.id));
    else {
      const panel = document.getElementById(panelDomId(target.id));
      const items = panel ? enabledItems(panel) : [];
      element =
        target.which === 'first'
          ? items[0]
          : target.which === 'last'
            ? items.at(-1)
            : undefined;
      element ??= panel;
    }
    element?.focus({ preventScroll: target.kind !== 'item' });
  };

  // Focus follows the state: whatever a handler asked for, once it has rendered.
  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (target) {
      pendingFocus.current = null;
      focusTarget(target);
    } else if (open.length > 0 && document.activeElement === document.body) {
      // A menu is open but its focused item went away (main pushed a new model): keep the keys working.
      document
        .getElementById(panelDomId(open[open.length - 1]!))
        ?.focus({ preventScroll: true });
    }
  });

  const rememberFocus = () => {
    if (returnFocus.current) return;
    const element = document.activeElement;
    if (
      element instanceof HTMLElement &&
      element !== document.body &&
      !withinBar(element)
    )
      returnFocus.current = element;
  };

  /** Closes every menu and lets go of the keyboard. `restore` puts focus back where it came from. */
  const closeAll = (restore: boolean) => {
    window.clearTimeout(hoverTimer.current);
    setOpen([]);
    setEngaged(false);
    setKeyboard(false);
    const previous = returnFocus.current;
    returnFocus.current = null;
    if (!restore) return;
    if (previous?.isConnected) previous.focus({ preventScroll: true });
    else if (withinBar(document.activeElement))
      (document.activeElement as HTMLElement).blur();
  };

  /** Opens the menu of title `index`, and `inner` (a menu folded into it) on top when given. */
  const openTopMenu = (
    index: number,
    which: 'first' | 'last' | 'panel',
    fromKeyboard: boolean,
    inner?: string,
  ) => {
    const menu = tops[index];
    if (!menu?.enabled) return;
    rememberFocus();
    window.clearTimeout(hoverTimer.current);
    setEntering(open.length === 0);
    setEngaged(true);
    if (fromKeyboard) setKeyboard(true);
    setCurrent(index);
    setOpen(inner ? [menu.id, inner] : [menu.id]);
    pendingFocus.current = { kind: 'panel', id: inner ?? menu.id, which };
  };

  const openSubmenu = (depth: number, id: string, which: 'first' | 'panel' | 'keep') => {
    window.clearTimeout(hoverTimer.current);
    setOpen((path) => [...path.slice(0, depth + 1), id]);
    if (which !== 'keep') pendingFocus.current = { kind: 'panel', id, which };
  };

  /** Closes the submenu showing at `depth` (> 0) and focuses the item that opens it. */
  const closeSubmenu = (depth: number) => {
    const trigger = open[depth];
    setOpen(open.slice(0, depth));
    if (trigger) pendingFocus.current = { kind: 'item', id: trigger };
  };

  const activate = (node: MenuBarNode) => {
    if (node.kind !== 'item' || !node.enabled) return;
    // Focus goes back before the action runs, so editing commands reach what had it.
    closeAll(true);
    onAction(node.id);
  };

  /** Alt alone or F10: take the keyboard, or give it back. */
  const toggleBar = () => {
    if (engaged || open.length > 0) {
      closeAll(true);
      return;
    }
    if (tops.length === 0) return;
    rememberFocus();
    setEngaged(true);
    setKeyboard(true);
    setCurrent(0);
    pendingFocus.current = { kind: 'title', index: 0 };
  };

  /** Opens the menu whose mnemonic is `key`; a folded one opens inside the More or Menu button's menu. */
  const openByMnemonic = (key: string): boolean => {
    const index = mnemonics.findIndex((mnemonic) => mnemonic?.key === key.toLowerCase());
    const menu = menus[index];
    if (!menu?.enabled) return false;
    const top = topIndexOf(index);
    openTopMenu(top, 'first', true, tops[top] === menu ? undefined : menu.id);
    return true;
  };

  const rtl = () =>
    rootRef.current !== null && getComputedStyle(rootRef.current).direction === 'rtl';

  /** Moves the roving focus along the bar, wrapping; an open menu moves with it. */
  const moveTitle = (delta: number) => {
    const count = tops.length;
    if (count === 0) return;
    const next = (currentIndex + delta + count) % count;
    setCurrent(next);
    setEngaged(true);
    setKeyboard(true);
    if (open.length > 0) openTopMenu(next, 'first', true);
    else pendingFocus.current = { kind: 'title', index: next };
  };

  const focusSibling = (panel: HTMLElement, from: HTMLElement | null, delta: number) => {
    const items = enabledItems(panel);
    if (items.length === 0) return;
    const index = from ? items.indexOf(from) : -1;
    const next =
      index < 0
        ? delta > 0
          ? 0
          : items.length - 1
        : (index + delta + items.length) % items.length;
    items[next]?.focus();
  };

  /** First-letter navigation: the next enabled item whose label starts with `char`. */
  const typeahead = (
    panel: HTMLElement,
    menu: MenuBarMenu,
    from: HTMLElement | null,
    char: string,
  ) => {
    const items = enabledItems(panel);
    const start = from ? items.indexOf(from) : -1;
    const lower = char.toLowerCase();
    for (let step = 1; step <= items.length; step++) {
      const element = items[(start + step + items.length) % items.length]!;
      const node = menu.children.find(
        (child) => isEntry(child) && child.id === element.dataset.menuItem,
      );
      if (node && isEntry(node) && node.label.trim().toLowerCase().startsWith(lower)) {
        element.focus();
        return;
      }
    }
  };

  /** Keys on a title. True when handled. */
  const barKey = (event: ReactKeyboardEvent): boolean => {
    const forward = rtl() ? -1 : 1;
    switch (event.key) {
      case 'ArrowRight':
        moveTitle(forward);
        return true;
      case 'ArrowLeft':
        moveTitle(-forward);
        return true;
      case 'Home':
      case 'End': {
        const index = event.key === 'Home' ? 0 : tops.length - 1;
        setCurrent(index);
        setEngaged(true);
        pendingFocus.current = { kind: 'title', index };
        return true;
      }
      case 'ArrowDown':
      case 'Enter':
      case ' ':
        openTopMenu(currentIndex, 'first', true);
        return true;
      case 'ArrowUp':
        openTopMenu(currentIndex, 'last', true);
        return true;
      case 'Escape':
        closeAll(true);
        return true;
      case 'Tab':
        closeAll(false);
        return false;
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey)
          return openByMnemonic(event.key);
        return false;
    }
  };

  /** Keys in a menu. True when handled. */
  const panelKey = (event: ReactKeyboardEvent, target: HTMLElement): boolean => {
    const panel = target.closest<HTMLElement>('[data-menu-panel]');
    const depth = Number(panel?.dataset.depth);
    const menu = panels[depth];
    if (!panel || !menu) return false;
    const itemElement = target.closest<HTMLElement>('[data-menu-item]');
    const item = itemElement
      ? menu.children.find(
          (child) => isEntry(child) && child.id === itemElement.dataset.menuItem,
        )
      : undefined;
    const forward = rtl() ? 'ArrowLeft' : 'ArrowRight';
    switch (event.key) {
      case 'ArrowDown':
        focusSibling(panel, itemElement, 1);
        return true;
      case 'ArrowUp':
        focusSibling(panel, itemElement, -1);
        return true;
      case 'Home':
        focusSibling(panel, null, 1);
        return true;
      case 'End':
        focusSibling(panel, null, -1);
        return true;
      case 'Enter':
      case ' ':
        if (isSubmenu(item) && item.enabled) openSubmenu(depth, item.id, 'first');
        else if (item) activate(item);
        return true;
      case 'ArrowRight':
      case 'ArrowLeft':
        if (event.key === forward) {
          if (isSubmenu(item) && item.enabled) openSubmenu(depth, item.id, 'first');
          else if (tops.length > 1) moveTitle(1);
        } else if (depth > 0) closeSubmenu(depth);
        else if (tops.length > 1) moveTitle(-1);
        return true;
      case 'Escape':
        if (depth > 0) closeSubmenu(depth);
        else {
          // The menu closes; the bar keeps the keyboard, on its title.
          setOpen([]);
          setKeyboard(true);
          pendingFocus.current = { kind: 'title', index: currentIndex };
        }
        return true;
      case 'Tab':
        closeAll(true);
        return true;
      default:
        if (event.key.length !== 1 || event.ctrlKey || event.metaKey) return false;
        if (event.altKey) return openByMnemonic(event.key);
        typeahead(panel, menu, itemElement, event.key);
        return true;
    }
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing || event.defaultPrevented) return;
    const target = event.target as HTMLElement;
    const handled = layerRef.current?.contains(target)
      ? panelKey(event, target)
      : barKey(event);
    if (!handled) return;
    event.preventDefault();
    event.stopPropagation();
  };

  // Focus left for somewhere else in the page: let go without pulling it back.
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (!next || withinBar(next)) return;
    returnFocus.current = null;
    closeAll(false);
  };

  const onTitleMouseDown = (event: ReactMouseEvent, index: number) => {
    // The title never takes focus: the editor keeps it until the menu opens, and gets it back after.
    event.preventDefault();
    if (event.button !== 0) return;
    if (openTop === index) closeAll(true);
    else openTopMenu(index, 'panel', false);
  };

  const onTitleMouseEnter = (index: number) => {
    if (panels.length > 0 && openTop !== index) openTopMenu(index, 'panel', false);
  };

  /** The pointer reached an item: it takes the focus, and after a beat its submenu opens (or a sibling's closes). */
  const onItemMouseEnter = (
    event: ReactMouseEvent<HTMLElement>,
    menu: MenuBarMenu,
    depth: number,
    node: MenuBarNode,
  ) => {
    window.clearTimeout(hoverTimer.current);
    const panel = event.currentTarget.parentElement;
    if (isEntry(node) && node.enabled) event.currentTarget.focus({ preventScroll: true });
    else panel?.focus({ preventScroll: true });
    const wanted = isSubmenu(node) && node.enabled ? node.id : undefined;
    if (wanted === open[depth + 1]) return;
    hoverTimer.current = window.setTimeout(() => {
      setOpen((path) => {
        if (path[depth] !== menu.id) return path;
        return wanted ? [...path.slice(0, depth + 1), wanted] : path.slice(0, depth + 1);
      });
    }, HOVER_DELAY);
  };

  const onItemClick = (depth: number, node: MenuBarNode) => {
    if (isSubmenu(node)) {
      if (node.enabled) openSubmenu(depth, node.id, 'keep');
    } else activate(node);
  };

  // Alt, F10 and Alt+letter, wherever focus is. In the capture phase, after the
  // keybinding dispatcher (installed first), whose keys arrive `defaultPrevented`.
  // A dialog keeps the keyboard to itself, and so does a field recording a shortcut.
  const onGlobalKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(INERT_TARGETS)) return;
    if (event.key === 'Alt') {
      if (!event.repeat) {
        alt.current = {
          down: true,
          alone: !event.ctrlKey && !event.shiftKey && !event.metaKey,
        };
        setAltHeld(true);
      }
      // On Linux this also keeps the auto-hidden native menu bar from appearing.
      event.preventDefault();
      return;
    }
    // Any other key while Alt is down makes it a chord, not a tap. AltGr arrives as `AltGraph`.
    if (alt.current.down) alt.current.alone = false;
    if (event.defaultPrevented || event.isComposing) return;
    const plain = !event.ctrlKey && !event.metaKey && !event.shiftKey;
    if (event.key === 'F10' && plain && !event.altKey) {
      event.preventDefault();
      event.stopPropagation();
      toggleBar();
    } else if (
      event.altKey &&
      plain &&
      event.key.length === 1 &&
      !withinBar(event.target)
    ) {
      if (!openByMnemonic(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
    }
  });
  const onGlobalKeyUp = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== 'Alt') return;
    const tap = alt.current.down && alt.current.alone;
    alt.current = { down: false, alone: false };
    setAltHeld(false);
    if (!tap) return;
    event.preventDefault();
    toggleBar();
  });
  // Alt+click and Alt+wheel aren't taps either.
  const onGlobalPointer = useEffectEvent((event: Event) => {
    alt.current.alone = false;
    if (
      event.type === 'mousedown' &&
      (engaged || open.length > 0) &&
      !withinBar(event.target)
    ) {
      returnFocus.current = null;
      closeAll(false);
    }
  });
  const onWindowBlur = useEffectEvent(() => {
    alt.current = { down: false, alone: false };
    setAltHeld(false);
    if (!engaged && open.length === 0) return;
    returnFocus.current = null;
    closeAll(false);
  });
  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => onGlobalKeyDown(event);
    const keyUp = (event: KeyboardEvent) => onGlobalKeyUp(event);
    const pointer = (event: Event) => onGlobalPointer(event);
    const blur = () => onWindowBlur();
    window.addEventListener('keydown', keyDown, true);
    window.addEventListener('keyup', keyUp, true);
    window.addEventListener('mousedown', pointer, true);
    window.addEventListener('wheel', pointer, { capture: true, passive: true });
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', keyDown, true);
      window.removeEventListener('keyup', keyUp, true);
      window.removeEventListener('mousedown', pointer, true);
      window.removeEventListener('wheel', pointer, true);
      window.removeEventListener('blur', blur);
    };
  }, []);
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  // How many titles fit: measured on unseen copies (so the answer doesn't depend
  // on what's shown), again on resize, once the fonts are in and when the menus change.
  const labelsKey = menus.map((menu) => menu.label).join('\n');
  const measure = useEffectEvent(() => {
    let next = menus.length;
    const specimens = [...(measureRef.current?.children ?? [])] as HTMLElement[];
    if (availableWidth && specimens.length === menus.length + 1) {
      const room = availableWidth();
      const widths = specimens.map((element) => element.offsetWidth);
      const moreWidth = widths.pop() ?? 0;
      if (widths.reduce((sum, width) => sum + width, 0) > room) {
        // The More button goes on the end; titles stay while they fit before it.
        let used = moreWidth;
        next = 0;
        while (next < widths.length && used + widths[next]! <= room)
          used += widths[next++]!;
        if (next < MIN_TITLES) next = 0;
      }
    }
    if (next === shownCount) return;
    // Menus open from a title that's about to move or fold away close.
    closeAll(false);
    setShown(next);
  });
  useLayoutEffect(() => {
    measure();
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    void document.fonts?.ready.then(onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [labelsKey, availableWidth, measureKey]);

  if (menus.length === 0) return null;
  const showMnemonics = altHeld || (keyboard && (engaged || open.length > 0));

  return (
    <div
      ref={rootRef}
      role="menubar"
      aria-label={label}
      className={cx(styles.bar, className)}
      data-engaged={engaged || undefined}
      data-mnemonics={showMnemonics || undefined}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
    >
      {tops.map((menu, index) => {
        // The More and Menu buttons are icons named by their label; real titles show their text and mnemonic.
        const icon =
          menu.id === MORE_ID ? 'more' : menu.id === MENU_ID ? 'menu' : undefined;
        return (
          <div
            key={menu.id}
            id={titleDomId(index)}
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={openTop === index}
            aria-disabled={!menu.enabled || undefined}
            aria-label={icon ? menu.label : undefined}
            tabIndex={index === currentIndex ? 0 : -1}
            className={cx(styles.title, icon && styles.more)}
            data-open={openTop === index || undefined}
            onMouseDown={(event) => onTitleMouseDown(event, index)}
            onMouseEnter={() => onTitleMouseEnter(index)}
          >
            {icon ? (
              <Icon name={icon} />
            ) : (
              <TitleLabel label={menu.label} mnemonic={mnemonics[index]} />
            )}
          </div>
        );
      })}
      {/* Every title and the More button at their natural width, unseen, to know how many fit. */}
      <div ref={measureRef} className={styles.measure} aria-hidden="true">
        {menus.map((menu) => (
          <span key={menu.id} className={styles.title}>
            {menu.label}
          </span>
        ))}
        <span className={cx(styles.title, styles.more)}>
          <Icon name="more" />
        </span>
      </div>
      {/* The title bar is a drag region, which no click on reaches the page: while the bar is engaged the window is no-drag, so one closes it like any outside click. On <body> because a later drag region overrides an earlier no-drag one, and the title bar's own come after this bar. */}
      {(engaged || open.length > 0) &&
        createPortal(<div className={styles.noDrag} aria-hidden="true" />, document.body)}
      {panels.length > 0 &&
        createPortal(
          <div ref={layerRef} className={styles.layer}>
            {panels.map((menu, depth) => (
              <MenuPanel
                key={`${depth}:${menu.id}`}
                menu={menu}
                depth={depth}
                domId={panelDomId(menu.id)}
                itemDomId={itemDomId}
                anchorId={depth === 0 ? titleDomId(openTop) : itemDomId(menu.id)}
                entering={depth > 0 || entering}
                openChild={open[depth + 1]}
                onItemMouseEnter={onItemMouseEnter}
                onItemClick={onItemClick}
              />
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

/** A title with its mnemonic letter marked; the underline shows only while the bar says so. */
function TitleLabel({
  label,
  mnemonic,
}: {
  label: string;
  mnemonic: Mnemonic | undefined;
}) {
  if (!mnemonic) return <span>{label}</span>;
  const end = mnemonic.index + (label.codePointAt(mnemonic.index)! > 0xffff ? 2 : 1);
  return (
    <span>
      {label.slice(0, mnemonic.index)}
      <span className={styles.mnemonic}>{label.slice(mnemonic.index, end)}</span>
      {label.slice(end)}
    </span>
  );
}

interface MenuPanelProps {
  menu: MenuBarMenu;
  depth: number;
  domId: string;
  itemDomId: (id: string) => string;
  /** The title (depth 0) or the item this menu hangs off. */
  anchorId: string;
  entering: boolean;
  /** The child submenu that is open, if any. */
  openChild: string | undefined;
  onItemMouseEnter: (
    event: ReactMouseEvent<HTMLElement>,
    menu: MenuBarMenu,
    depth: number,
    node: MenuBarNode,
  ) => void;
  onItemClick: (depth: number, node: MenuBarNode) => void;
}

/** One open menu: below its title, or beside the item that opens it, kept inside the window. */
function MenuPanel({
  menu,
  depth,
  domId,
  itemDomId,
  anchorId,
  entering,
  openChild,
  onItemMouseEnter,
  onItemClick,
}: MenuPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties>({ left: 0, top: 0 });
  const contentKey = menu.children
    .map((child) => (isEntry(child) ? `${child.id}\t${child.label}` : '-'))
    .join('\n');

  useLayoutEffect(() => {
    const panel = ref.current;
    const anchor = document.getElementById(anchorId);
    if (!panel || !anchor) return;
    const a = anchor.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rtl = getComputedStyle(panel).direction === 'rtl';
    let left: number;
    let top: number;
    let maxHeight: number;
    if (depth === 0) {
      top = a.bottom + 4;
      left = rtl ? a.right - p.width : a.left;
      maxHeight = vh - top - MARGIN;
    } else {
      // Beside the item, overlapping the parent's padding so the rows line up; flipped when there's no room.
      top = a.top - 5;
      left = rtl ? a.left - p.width + 4 : a.right - 4;
      if (!rtl && left + p.width > vw - MARGIN) left = a.left - p.width + 4;
      if (rtl && left < MARGIN) left = a.right - 4;
      if (top + p.height > vh - MARGIN) top = vh - MARGIN - p.height;
      maxHeight = vh - 2 * MARGIN;
    }
    left = Math.round(
      Math.min(Math.max(MARGIN, left), Math.max(MARGIN, vw - MARGIN - p.width)),
    );
    top = Math.round(Math.max(MARGIN, top));
    maxHeight = Math.max(80, Math.round(maxHeight));
    setPosition((previous) =>
      previous.left === left && previous.top === top && previous.maxHeight === maxHeight
        ? previous
        : { left, top, maxHeight },
    );
  }, [anchorId, depth, contentKey]);

  return (
    <div
      ref={ref}
      id={domId}
      role="menu"
      aria-labelledby={anchorId}
      tabIndex={-1}
      className={cx(menuStyles.surface, styles.panel)}
      style={position}
      data-menu-panel={menu.id}
      data-depth={depth}
      data-entering={entering || undefined}
      onMouseDown={(event) => event.preventDefault()}
    >
      {menu.children.map((node, index) => {
        if (node.kind === 'separator')
          return (
            <div
              key={`separator:${index}`}
              role="separator"
              className={menuStyles.separator}
            />
          );
        const id = itemDomId(node.id);
        const submenu = isSubmenu(node);
        const checkable = node.kind === 'item' && node.checked !== undefined;
        return (
          <div
            key={node.id}
            id={id}
            role={
              checkable
                ? node.kind === 'item' && node.radio
                  ? 'menuitemradio'
                  : 'menuitemcheckbox'
                : 'menuitem'
            }
            aria-labelledby={`${id}-label`}
            aria-describedby={
              node.kind === 'item' && node.accelerator ? `${id}-kbd` : undefined
            }
            aria-checked={checkable ? node.checked : undefined}
            aria-disabled={!node.enabled || undefined}
            aria-haspopup={submenu ? 'menu' : undefined}
            aria-expanded={submenu ? openChild === node.id : undefined}
            tabIndex={-1}
            className={menuStyles.item}
            data-menu-item={node.id}
            data-disabled={!node.enabled || undefined}
            data-selected={(checkable && node.checked) || undefined}
            data-open={(submenu && openChild === node.id) || undefined}
            onMouseEnter={(event) => onItemMouseEnter(event, menu, depth, node)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onItemClick(depth, node)}
          >
            <span className={menuStyles.lead}>
              {checkable && node.checked ? <Icon name="check" /> : null}
            </span>
            <span id={`${id}-label`} className={menuStyles.label}>
              {node.label}
            </span>
            {node.kind === 'item' && node.accelerator && (
              <span id={`${id}-kbd`} className={menuStyles.kbd}>
                {node.accelerator}
              </span>
            )}
            {submenu && <Icon name="chevron-right" className={menuStyles.chevron} />}
          </div>
        );
      })}
    </div>
  );
}
