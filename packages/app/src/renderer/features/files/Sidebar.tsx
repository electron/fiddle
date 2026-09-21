import { useRef, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { isMainEntry } from '../../../fiddle/files';
import { documentsApi } from '../../../ipc/renderer';
import {
  Button,
  confirmDialog,
  IconButton,
  Menu,
  MenuItem,
  MenuPopover,
  promptDialog,
  TextField,
  Tooltip,
  Tree,
  TreeRow,
} from '../../../ui';
import { badgeOf, useDiagnostics } from '../../editor/diagnostics';
import { renameFile as renameFileInEditor } from '../../editor/editor-state';
import { toastError } from '../../toast-error';
import { PackagesSection } from '../packages/PackagesSection';
import {
  groupByProcess,
  PROCESS_ORDER,
  suggestFileName,
  type FileProcess,
} from '../../shell/processes';
import { processLabelKey, useBadgeLabel } from '../../shell/Sheet';
import styles from './Sidebar.module.css';

/** Past this many files the sidebar offers a filter field. */
const FILTER_THRESHOLD = 8;

const addInGroupKey = {
  main: 'addMainFile',
  preload: 'addPreloadFile',
  renderer: 'addRendererFile',
  other: 'addOtherFile',
} as const satisfies Record<FileProcess, string>;

const groupHintKey = {
  main: 'groupHintMain',
  preload: 'groupHintPreload',
  renderer: 'groupHintRenderer',
  other: 'groupHintOther',
} as const satisfies Record<FileProcess, string>;

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

export function Sidebar({
  files,
  dirtyFiles,
  activeFile,
  onOpen,
  onSetVisible,
}: SidebarProps) {
  const { t } = useTranslation('shell');
  const diagnostics = useDiagnostics();
  const badgeLabel = useBadgeLabel();
  const [filter, setFilter] = useState('');
  const [menu, setMenu] = useState<MenuState | null>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const names = files.map((file) => file.name);
  // The filter field is there only past the threshold, so a leftover filter mustn't keep hiding files.
  const query = files.length > FILTER_THRESHOLD ? filter.trim().toLowerCase() : '';
  const shown = query
    ? files.filter((file) => file.name.toLowerCase().includes(query))
    : files;
  const groups = groupByProcess(shown);

  const fail = (error: unknown) => toastError(error, t('fileChangeFailed'));

  // From a group head the prompt starts with a free name for the group; the name typed still decides the group.
  const addFile = async (group?: FileProcess) => {
    const name = (
      await promptDialog({
        title: t('addFileTitle'),
        message: group ? t(groupHintKey[group]) : t('fileNameHint'),
        label: t('fileName'),
        defaultValue: group ? suggestFileName(group, names) : undefined,
        confirmLabel: t('create'),
        cancelLabel: t('cancel'),
      })
    )?.trim();
    if (!name) return;
    // Main checks the name against the file rules, and words a refusal in the user's language.
    try {
      await documentsApi.AddFile(name);
      onOpen(name);
    } catch (error) {
      fail(error);
    }
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
    if (!next || next === name) return;
    try {
      await renameFileInEditor(name, next);
    } catch (error) {
      fail(error);
    }
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

  // Right-click, or the context-menu key on a focused row.
  const onContextMenu = (event: MouseEvent<HTMLElement>) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>('[role="row"]');
    const name = row?.dataset.key;
    if (!row || !name) return;
    event.preventDefault();
    const rect = row.getBoundingClientRect();
    const fromKeyboard = event.clientX === 0 && event.clientY === 0;
    setMenu({
      name,
      x: fromKeyboard ? rect.left + 16 : event.clientX,
      y: fromKeyboard ? rect.bottom : event.clientY,
      open: true,
    });
  };

  const closeMenu = () => setMenu((current) => current && { ...current, open: false });
  const menuFileVisible =
    (menu ? files.find((file) => file.name === menu.name) : undefined)?.visible ?? true;

  return (
    <nav
      className={styles.sidebar}
      aria-label={t('files')}
      onContextMenu={onContextMenu}
      data-tour="sidebar"
    >
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
      {PROCESS_ORDER.map((process) => {
        const group = groups[process];
        // Main, Preload and Renderer always show, so a file can be added to an
        // empty one; Other only lists what it has, and a filter hides empty groups.
        if (group.length === 0 && (process === 'other' || query)) return null;
        const label = t(processLabelKey[process]);
        const addLabel = t(addInGroupKey[process]);
        return (
          <section key={process} className={styles.section}>
            <div className={styles.header}>
              <h2 className={styles.head}>{label}</h2>
              <Tooltip label={addLabel}>
                <IconButton
                  icon="plus"
                  size="sm"
                  label={addLabel}
                  className={styles.groupAdd}
                  onPress={() => void addFile(process)}
                />
              </Tooltip>
            </div>
            {group.length > 0 && (
              <Tree
                aria-label={label}
                variant="sidebar"
                value={group.some((file) => file.name === activeFile) ? activeFile : null}
                onChange={onOpen}
              >
                {group.map((file) => {
                  const badge = badgeOf(diagnostics.get(file.name));
                  return (
                    <TreeRow
                      key={file.name}
                      id={file.name}
                      label={file.name}
                      labelDir="ltr"
                      pill={badgeLabel(badge)}
                      pillTone={badge?.tone}
                      unsaved={dirtyFiles.includes(file.name) ? t('unsaved') : undefined}
                    />
                  );
                })}
              </Tree>
            )}
          </section>
        );
      })}
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
        triggerRef={anchor}
        isOpen={menu?.open ?? false}
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
