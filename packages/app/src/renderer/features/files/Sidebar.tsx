/**
 * The sidebar's file list, grouped by process (Main process, Preload,
 * Renderer), then the Packages slot. File operations (add, rename, delete,
 * show and hide) go through the Documents methods; main validates them too.
 * Each row's pill counts the file's errors, or its warnings when it has none.
 */
import { useRef, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';

import {
  assertCanAddFile,
  assertCanRenameFile,
  isMainEntry,
} from '../../../fiddle/files';
import { documentsApi } from '../../../ipc/renderer';
import {
  Button,
  confirmDialog,
  Menu,
  MenuItem,
  MenuPopover,
  promptDialog,
  showToast,
  TextField,
  Tree,
  TreeRow,
} from '../../../ui';
import { badgeOf, useDiagnostics } from '../../editor/diagnostics';
import { PackagesSection } from '../packages/PackagesSection';
import { groupByProcess, PROCESS_ORDER } from '../../shell/processes';
import { processLabelKey, useBadgeLabel } from '../../shell/Sheet';
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

interface MenuState {
  name: string;
  x: number;
  y: number;
}

export function Sidebar({ files, dirtyFiles, activeFile, onOpen, onSetVisible }: SidebarProps) {
  const { t } = useTranslation('shell');
  const diagnostics = useDiagnostics();
  const badgeLabel = useBadgeLabel();
  const [filter, setFilter] = useState('');
  const [menu, setMenu] = useState<MenuState | null>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const names = files.map((file) => file.name);
  const query = filter.trim().toLowerCase();
  const shown = query ? files.filter((file) => file.name.toLowerCase().includes(query)) : files;
  const groups = groupByProcess(shown);

  const fail = (error: unknown) =>
    showToast({
      tone: 'error',
      title: t('fileChangeFailed'),
      description: error instanceof Error ? error.message : String(error),
    });

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
    try {
      assertCanAddFile(names, name);
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
      assertCanRenameFile(names, name, next);
      await documentsApi.RenameFile(name, next);
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
    // Tree rows are labelled with their text value, the file name.
    const row = (event.target as HTMLElement).closest<HTMLElement>('[role="row"]');
    const name = row?.getAttribute('aria-label');
    if (!row || !name) return;
    event.preventDefault();
    const rect = row.getBoundingClientRect();
    const fromKeyboard = event.clientX === 0 && event.clientY === 0;
    setMenu({
      name,
      x: fromKeyboard ? rect.left + 16 : event.clientX,
      y: fromKeyboard ? rect.bottom : event.clientY,
    });
  };

  const menuFile = menu ? files.find((file) => file.name === menu.name) : undefined;

  return (
    <nav className={styles.sidebar} aria-label={t('files')} onContextMenu={onContextMenu} data-tour="sidebar">
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
        if (group.length === 0) return null;
        const label = t(processLabelKey[process]);
        return (
          <section key={process} className={styles.section}>
            <h4 className={styles.head}>{label}</h4>
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
                    icon={file.visible ? 'file' : 'eye-off'}
                    pill={badgeLabel(badge)}
                    pillTone={badge?.tone}
                    unsaved={dirtyFiles.includes(file.name)}
                    unsavedLabel={t('unsaved')}
                  />
                );
              })}
            </Tree>
          </section>
        );
      })}
      <Button className={styles.add} variant="ghost" size="sm" icon="plus" onPress={() => void addFile()}>
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
        isOpen={menu !== null}
        onOpenChange={(open) => {
          if (!open) setMenu(null);
        }}
      >
        <Menu
          aria-label={t('fileActions')}
          onAction={(key) => {
            const name = menu?.name;
            setMenu(null);
            if (!name) return;
            if (key === 'rename') void renameFile(name);
            else if (key === 'delete') void removeFile(name);
            else if (key === 'hide') onSetVisible(name, false);
            else if (key === 'show') onSetVisible(name, true);
            else if (key === 'add') void addFile();
          }}
          disabledKeys={menu && isMainEntry(menu.name) ? ['delete'] : []}
        >
          {menuFile?.visible ? (
            <MenuItem id="hide" icon="eye-off">
              {t('hideFile')}
            </MenuItem>
          ) : (
            <MenuItem id="show" icon="eye">
              {t('showFile')}
            </MenuItem>
          )}
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
