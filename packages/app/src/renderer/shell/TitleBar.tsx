import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import { useTranslation } from 'react-i18next';

import { windowApi } from '../../ipc/renderer';
import type { MenuBarModel, Platform } from '../../shared/stores';
import {
  MenuBar,
  ToolbarButton,
  ToolbarCapsule,
  Tooltip,
  type MenuBarMenu,
} from '../../ui';
import { OpenGistButton } from '../features/gists/OpenGistButton';
import { PublishButton } from '../features/gists/PublishButton';
import { RunButton } from '../features/run/RunButton';
import { VersionPicker } from '../features/versions/VersionPicker';
import styles from './Shell.module.css';
import { TITLE_BAR_PARTS, titleBarFit } from './title-bar-fit';

export interface TitleBarProps {
  name: string;
  dirty: boolean;
  platform: Platform;
  sidebar: boolean;
  settingsOpen: boolean;
  /** Windows and Linux: the application menu, drawn as a menu bar after the sidebar button. */
  menuBar?: MenuBarModel;
  onToggleSidebar: () => void;
  onToggleSettings: () => void;
}

/** Controls in the title bar; a double-click on them isn't a title bar double-click. */
const CONTROLS =
  'button, a, input, [role="button"], [role="toolbar"], [role="dialog"], [role="menubar"]';
const { gap: GAP, padding: PADDING, picker: PICKER } = TITLE_BAR_PARTS;
/** The name hides below this width rather than show a sliver, and comes back with room to spare (its divider's). */
const NAME_HIDE_BELOW = 48;
const NAME_SHOW_ABOVE = 64;
/** What the divider between the menus and the name takes: a gap each side and the hairline. */
const DIVIDER_ROOM = 2 * GAP + 1;

/**
 * Three parts in a row: the left group
 * (sidebar button, the menu bar off macOS, the name), the capsule, and the
 * right group (Open gist, Publish, Settings). The groups flex equally, so the
 * capsule sits centred while both have room and is pushed, never overlapped,
 * when one doesn't. Before that happens the name truncates, the menus fold and
 * the name hides; in the narrowest windows Publish drops its label, then Open
 * gist and Run's hint go and the version picker narrows (./title-bar-fit.ts).
 */
export function TitleBar({
  name,
  dirty,
  platform,
  sidebar,
  settingsOpen,
  menuBar,
  onToggleSidebar,
  onToggleSettings,
}: TitleBarProps) {
  const { t } = useTranslation('shell');
  const sidebarLabel = sidebar ? t('hideSidebar') : t('showSidebar');
  const headerRef = useRef<HTMLElement>(null);
  const menusRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const capsuleRef = useRef<HTMLDivElement>(null);
  /** The capsule grows with its version label; the menus measure again when it does. */
  const [capsuleWidth, setCapsuleWidth] = useState(0);
  const [nameHidden, setNameHidden] = useState(false);
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  // The top level is all submenus (File, Edit, …); main never sends anything else there.
  const menus = useMemo(
    () => menuBar?.filter((node): node is MenuBarMenu => node.kind === 'submenu'),
    [menuBar],
  );
  const hasMenuBar = menus !== undefined;
  const fit = titleBarFit(platform, windowWidth, hasMenuBar);

  // macOS: empty title bar space minimizes or zooms, as the system preference says.
  const onDoubleClick = (event: MouseEvent<HTMLElement>) => {
    if (platform !== 'darwin' || (event.target as Element).closest(CONTROLS)) return;
    windowApi.DoubleClickTitleBar().catch((error: unknown) => {
      console.error('[fiddle] title bar double-click failed', error);
    });
  };

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // The name takes what the left group has left. Down to a sliver it hides (and
  // its divider with it), and it comes back only once there's room to spare.
  useLayoutEffect(() => {
    const title = titleRef.current;
    const capsule = capsuleRef.current;
    if (!title || !capsule) return;
    const update = () => {
      const width = title.clientWidth;
      setNameHidden((hidden) =>
        hidden ? width < NAME_SHOW_ABOVE : width < NAME_HIDE_BELOW,
      );
      setCapsuleWidth(Math.round(capsule.getBoundingClientRect().width));
    };
    update();
    window.addEventListener('resize', update);
    const observer =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update);
    observer?.observe(title);
    observer?.observe(capsule);
    return () => {
      window.removeEventListener('resize', update);
      observer?.disconnect();
    };
  }, [hasMenuBar]);

  // The menus may run up to the divider, its gaps and the group's padding before
  // the capsule where it sits centred at full width, so titles fold before
  // anything is pushed or narrowed.
  const menusRoom = useCallback(() => {
    const header = headerRef.current;
    const menuBox = menusRef.current;
    const capsule = capsuleRef.current;
    if (!header || !menuBox || !capsule) return Number.MAX_SAFE_INTEGER;
    const bar = header.getBoundingClientRect();
    const box = menuBox.getBoundingClientRect();
    // The picker element itself: the capsule's first child is react-aria's
    // collection <template>.
    const picker = capsule.querySelector<HTMLElement>('[data-tour="version-picker"]');
    const pickerWidth = picker?.getBoundingClientRect().width ?? PICKER;
    const fullCapsule =
      capsule.getBoundingClientRect().width + Math.max(0, PICKER - pickerWidth);
    const free = (bar.width - 2 * PADDING - fullCapsule) / 2;
    const rtl = getComputedStyle(menuBox).direction === 'rtl';
    const room = rtl
      ? box.right - (bar.right - PADDING - free)
      : bar.left + PADDING + free - box.left;
    return room - DIVIDER_ROOM - GAP;
  }, []);

  const activateMenuItem = (id: string) => {
    windowApi.ActivateMenuItem(id).catch((error: unknown) => {
      console.error(`[fiddle] menu item ${id} failed`, error);
    });
  };

  return (
    <header ref={headerRef} className={styles.titlebar} onDoubleClick={onDoubleClick}>
      <div className={styles.barStart}>
        <span className={styles.start}>
          <Tooltip label={sidebarLabel}>
            <ToolbarButton
              icon="sidebar"
              label={sidebarLabel}
              onPress={onToggleSidebar}
            />
          </Tooltip>
        </span>
        {menus && (
          <>
            <div ref={menusRef} className={styles.menus}>
              <MenuBar
                menus={menus}
                label={t('menuBar')}
                moreLabel={t('menuBarMore')}
                menuLabel={t('menuBarMenu')}
                availableWidth={menusRoom}
                measureKey={capsuleWidth}
                onAction={activateMenuItem}
              />
            </div>
            {/* The name reads like one more title otherwise: a hairline sets it apart, and it goes muted. */}
            {!nameHidden && <span className={styles.menusDivider} aria-hidden="true" />}
          </>
        )}
        <div
          ref={titleRef}
          className={styles.title}
          data-after-menus={hasMenuBar || undefined}
          data-hidden={nameHidden || undefined}
        >
          <span className={styles.name}>{name}</span>
          {dirty && <span className={styles.edited}>{t('edited')}</span>}
        </div>
      </div>
      <ToolbarCapsule ref={capsuleRef} label={t('toolbar')} className={styles.capsule}>
        <VersionPicker className={styles.picker} />
        <RunButton compact={!fit.runHint} />
      </ToolbarCapsule>
      <div className={styles.barEnd}>
        {fit.openGistButton && <OpenGistButton />}
        <PublishButton compact={!fit.publishLabel} />
        <Tooltip label={t('settings')}>
          <ToolbarButton
            icon="settings"
            label={t('settings')}
            isPressed={settingsOpen}
            onPress={onToggleSettings}
          />
        </Tooltip>
      </div>
    </header>
  );
}
