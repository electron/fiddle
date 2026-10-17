import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { isMainEntry } from '../../../fiddle/files';
import { documentsApi } from '../../../ipc/renderer';
import {
  Button,
  confirmDialog,
  Menu,
  MenuItem,
  MenuPopover,
  promptDialog,
  TextField,
  Tree,
  TreeRow,
} from '../../../ui';
import { useBadges } from '../../editor/diagnostics';
import { renameFile as renameFileInEditor } from '../../editor/editor-state';
import { revealLocation } from '../../editor/runtime-errors';
import { toastError } from '../../toast-error';
import { PackagesSection } from '../packages/PackagesSection';
import styles from './Sidebar.module.css';

/** Past this many files the sidebar offers a filter field. */
const FILTER_THRESHOLD = 8;

export interface SidebarProps {
  files: readonly { name: string; visible: boolean }[];
  /** Files with unsaved changes: their rows show the unsaved dot. */
  dirtyFiles: readonly string[];
  activeFile: string | null;
  onOpen: (name: string) => void;
  onSetVisible: (name: string, visible: boolean) => void;
}

/** Stays set after the menu closes (`open` goes false), so the items don't change while it animates out. */
interface MenuState {
  name: string;
  x: number;
  y: number;
  open: boolean;
}

/** The menu for a right-click at a point on a row, or for the context-menu key on a focused row. */
function menuFor(row: HTMLElement | null | undefined, x: number, y: number) {
  const name = row?.dataset.key;
  if (!row || !name) return null;
  const rect = row.getBoundingClientRect();
  const fromKeyboard = x === 0 && y === 0;
  return {
    name,
    x: fromKeyboard ? rect.left + 16 : x,
    y: fromKeyboard ? rect.bottom : y,
    open: true,
  };
}

export function Sidebar({
  files,
  dirtyFiles,
  activeFile,
  onOpen,
  onSetVisible,
}: SidebarProps) {
  const { t } = useTranslation('shell');
  const badge = useBadges();
  const [filter, setFilter] = useState('');
  const [menu, setMenu] = useState<MenuState | null>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  // The filter field is there only past the threshold, so a leftover filter mustn't keep hiding files.
  const query = files.length > FILTER_THRESHOLD ? filter.trim().toLowerCase() : '';
  const shown = query
    ? files.filter((file) => file.name.toLowerCase().includes(query))
    : files;

  const fail = (error: unknown) => toastError(error, t('fileChangeFailed'));

  const addFile = async () => {
    const name = (
      await promptDialog({
        title: t('addFileTitle'),
        message: t('fileNameHint'),
        label: t('fileName'),
        confirmLabel: t('create'),
        cancelLabel: t('cancel'),
      })
    )?.trim();
    if (!name) return;
    // Main checks the name against the file rules, and words a refusal in the user's language.
    await documentsApi
      .AddFile(name)
      .then(() => onOpen(name))
      .catch(fail);
  };

  const renameFile = async (name: string) => {
    const next = (
      await promptDialog({
        title: t('renameTitle', { name }),
        message: t('fileNameHint'),
        label: t('fileName'),
        defaultValue: name,
        confirmLabel: t('renameConfirm'),
        cancelLabel: t('cancel'),
      })
    )?.trim();
    if (next && next !== name) await renameFileInEditor(name, next).catch(fail);
  };

  const removeFile = async (name: string) => {
    const ok = await confirmDialog({
      title: t('deleteTitle', { name }),
      message: t('deleteMessage'),
      confirmLabel: t('deleteConfirm'),
      cancelLabel: t('cancel'),
      tone: 'danger',
    });
    if (!ok) return;
    await documentsApi.RemoveFile(name).catch(fail);
  };

  const onContextMenu = (event: MouseEvent<HTMLElement>) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>('[role="row"]');
    const next = menuFor(row, event.clientX, event.clientY);
    if (!next) return;
    event.preventDefault();
    setMenu(next);
  };

  const closeMenu = () => setMenu((current) => current && { ...current, open: false });

  // The open menu makes the rest of the window inert, so a right-click on another row never reaches
  // that row. Find the row by its place, and move the menu there instead of showing the native one.
  const menuOpen = menu?.open ?? false;
  useEffect(() => {
    if (!menuOpen) return;
    const onContextMenuOutside = (event: globalThis.MouseEvent) => {
      // The right-click that opened the menu gets here too.
      if (event.defaultPrevented) return;
      event.preventDefault();
      if (event.target instanceof Element && event.target.closest('[role="menu"]'))
        return;
      const { clientX: x, clientY: y } = event;
      const under = (element: Element) => {
        const rect = element.getBoundingClientRect();
        return x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom;
      };
      // A row scrolled out of the sidebar isn't under the pointer, wherever its box is.
      const rows =
        sidebar.current && under(sidebar.current)
          ? sidebar.current.querySelectorAll<HTMLElement>('[role="row"]')
          : [];
      const next = menuFor([...rows].find(under), x, y);
      setMenu((current) => next ?? (current && { ...current, open: false }));
    };
    document.addEventListener('contextmenu', onContextMenuOutside);
    return () => document.removeEventListener('contextmenu', onContextMenuOutside);
  }, [menuOpen]);

  const menuFileVisible =
    (menu ? files.find((file) => file.name === menu.name) : undefined)?.visible ?? true;

  return (
    <nav
      ref={sidebar}
      className={styles.sidebar}
      aria-label={t('files')}
      onContextMenu={onContextMenu}
      data-tour="sidebar"
    >
      <h2 className={styles.head}>{t('files')}</h2>
      {files.length > FILTER_THRESHOLD && (
        <TextField
          className={styles.search}
          size="sm"
          onGlass
          icon="search"
          aria-label={t('filterFiles')}
          placeholder={t('filterFiles')}
          value={filter}
          onChange={setFilter}
        />
      )}
      {shown.length > 0 && (
        <Tree
          aria-label={t('files')}
          value={shown.some((file) => file.name === activeFile) ? activeFile : null}
          onChange={onOpen}
        >
          {shown.map((file) => (
            <TreeRow
              key={file.name}
              id={file.name}
              label={file.name}
              labelDir="ltr"
              pill={badge(file.name)?.label}
              pillTone={badge(file.name)?.tone}
              unsaved={dirtyFiles.includes(file.name) ? t('unsaved') : undefined}
              // A click means to work in that file; arrow keys along the list keep the focus here.
              onPointerPress={() => revealLocation(file.name)}
            />
          ))}
        </Tree>
      )}
      <Button
        className={styles.add}
        variant="ghost"
        size="sm"
        icon="plus"
        onPress={() => void addFile()}
      >
        {t('addFile')}
      </Button>
      <PackagesSection />

      <span
        ref={anchor}
        className={styles.anchor}
        style={menu ? { left: menu.x, top: menu.y } : undefined}
      />
      <MenuPopover
        // A menu that moves is a new popover: an open one doesn't follow its anchor.
        key={menu && `${menu.x},${menu.y}`}
        triggerRef={anchor}
        isOpen={menuOpen}
        onOpenChange={(open) => {
          if (!open) closeMenu();
        }}
      >
        <Menu
          aria-label={t('fileActions')}
          onAction={(key) => {
            const name = menu?.name;
            closeMenu();
            if (!name) return;
            if (key === 'rename') void renameFile(name);
            else if (key === 'delete') void removeFile(name);
            else if (key === 'visibility') onSetVisible(name, !menuFileVisible);
            else if (key === 'add') void addFile();
          }}
          disabledKeys={menu && isMainEntry(menu.name) ? ['delete'] : []}
        >
          {/* One ID for close and open: React Aria throws if an item's ID changes while it's mounted. */}
          <MenuItem id="visibility" icon={menuFileVisible ? 'close' : 'file'}>
            {menuFileVisible ? t('closeTab') : t('openTab')}
          </MenuItem>
          <MenuItem id="rename">{t('rename')}</MenuItem>
          <MenuItem id="add" icon="plus">
            {t('addFile')}
          </MenuItem>
          <MenuItem id="delete" icon="trash" isDanger>
            {t('delete')}
          </MenuItem>
        </Menu>
      </MenuPopover>
    </nav>
  );
}
