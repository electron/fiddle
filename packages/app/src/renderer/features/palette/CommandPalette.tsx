/**
 * The command palette: CmdOrCtrl+Shift+P, and F1 in the editor (both arrive
 * as the `app.commandPalette` Window.Command). It searches commands with
 * their current shortcuts, the fiddle's files, Electron versions and Show Me
 * examples, with recently used items first.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, Modal, ModalOverlay } from 'react-aria-components';

import { documentsApi, versionsApi, windowApi } from '../../../ipc/renderer';
import {
  commandIds,
  commands,
  isCommandEnabled,
  isCommandListed,
} from '../../../shared/commands';
import { FiddleError } from '../../../shared/errors';
import { SHOW_ME_EXAMPLES } from '../../../shared/examples';
import { effectiveAccelerator } from '../../../shared/settings';
import { acceleratorKeys } from '../../../shared/accelerators';
import type { AppState, ReleaseRow, WindowState } from '../../../shared/stores';
import { cx, Icon, Kbd, showToast, type IconName } from '../../../ui';
import menu from '../../../ui/components/Menu.module.css';
import { useAppState, useWindowState } from '../../state';
import { OnboardingTour } from '../onboarding/OnboardingTour';
import { useReleases } from '../run/use-run';
import styles from './CommandPalette.module.css';
import { getEditorActions } from './editor-actions';
import { pushRecent, rankItems, type PaletteItem, type PaletteKind } from './rank';

const RECENT_KEY = 'fiddle.palette.recent';

interface Entry extends PaletteItem {
  run(): unknown;
}

const KIND_ICONS: Record<PaletteKind, IconName> = {
  command: 'command',
  editor: 'code',
  file: 'file',
  version: 'download',
  example: 'book',
};

function readRecent(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(value)
      ? value.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

function writeRecent(ids: string[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(ids));
  } catch {
    // Storage disabled or full: the list just isn't remembered.
  }
}

function useEntries(
  app: AppState | undefined,
  win: WindowState | undefined,
  releases: readonly ReleaseRow[],
  open: boolean,
): Entry[] {
  const { t } = useTranslation('palette');
  const { t: tMain } = useTranslation('main');
  // Separate from the rest so a store push while the palette is open doesn't translate every release again.
  const releaseEntries = useMemo<Entry[]>(
    () =>
      !open
        ? []
        : releases
            .filter((release) => release.supported)
            .map((release): Entry => ({
              id: `version:${release.version}`,
              kind: 'version',
              label: t('electronVersion', { version: release.version }),
              keywords: [release.version],
              run: () =>
                versionsApi.SetVersion({ kind: 'release', version: release.version }),
            })),
    [open, releases, t],
  );
  return useMemo(() => {
    if (!open || !app) return [];
    const entries: Entry[] = [];

    for (const id of commandIds) {
      // Not the palette itself, nor a dev-only command in the packaged app.
      if (id === 'app.commandPalette' || !isCommandListed(id, app)) continue;
      entries.push({
        id: `command:${id}`,
        kind: 'command',
        label: tMain(commands[id].label),
        keywords: [id],
        keys: acceleratorKeys(
          effectiveAccelerator(id, app.platform, app.settings.keybindings),
          app.platform,
        ),
        isDisabled: !isCommandEnabled(id, app, win),
        run: () => windowApi.RunCommand(id),
      });
    }
    for (const action of getEditorActions()) {
      entries.push({
        id: `editor:${action.id}`,
        kind: 'editor',
        label: action.label,
        run: () => action.run(),
      });
    }
    for (const file of win?.fiddle.files ?? []) {
      entries.push({
        id: `file:${file.name}`,
        kind: 'file',
        label: file.name,
        run: () => documentsApi.SetActiveFile(file.name),
      });
    }
    for (const build of app.versions?.localBuilds ?? []) {
      entries.push({
        id: `local:${build.id}`,
        kind: 'version',
        label: build.name,
        isDisabled: !build.available,
        run: () => versionsApi.SetVersion({ kind: 'local', id: build.id }),
      });
    }
    entries.push(...releaseEntries);
    for (const name of SHOW_ME_EXAMPLES) {
      entries.push({
        id: `example:${name}`,
        kind: 'example',
        label: name,
        run: () => documentsApi.LoadExample(name),
      });
    }
    return entries;
  }, [open, app, win, releaseEntries, tMain]);
}

export function CommandPalette() {
  const { t } = useTranslation('palette');
  const app = useAppState();
  const win = useWindowState() ?? undefined;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState(readRecent);
  const listId = useId();
  const list = useRef<HTMLUListElement>(null);

  useEffect(
    () =>
      windowApi.onCommand((id) => {
        if (id !== 'app.commandPalette') return;
        setQuery('');
        setActive(0);
        setOpen((current) => !current);
      }),
    [],
  );

  const releases = useReleases();
  const entries = useEntries(app, win, releases, open);
  const shown = useMemo(
    () => rankItems(entries, query, recent),
    [entries, query, recent],
  );
  const current = Math.min(active, Math.max(0, shown.length - 1));

  useEffect(() => {
    list.current?.querySelector('[data-focused]')?.scrollIntoView({ block: 'nearest' });
  }, [current, shown]);

  const kindLabel: Record<PaletteKind, string> = {
    command: t('kindCommand'),
    editor: t('kindEditor'),
    file: t('kindFile'),
    version: t('kindVersion'),
    example: t('kindExample'),
  };

  const choose = (entry: Entry | undefined) => {
    if (!entry || entry.isDisabled) return;
    setOpen(false);
    const next = pushRecent(recent, entry.id);
    setRecent(next);
    writeRecent(next);
    // The overlay gives focus back in a frame of its own, queued after this one. Wait for it, so
    // the entry runs with focus where it was (the editor, for its actions).
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        Promise.resolve()
          .then(() => entry.run())
          .catch((error: unknown) => {
            showToast({
              title: t('runFailed', { label: entry.label }),
              description: FiddleError.from(error).message,
              tone: 'error',
            });
          });
      });
    });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    // Enter and the arrows belong to the input method while it composes.
    if (event.nativeEvent.isComposing) return;
    const moveTo = (index: number) => {
      event.preventDefault();
      if (shown.length > 0) setActive((index + shown.length) % shown.length);
    };
    if (event.key === 'ArrowDown') moveTo(current + 1);
    else if (event.key === 'ArrowUp') moveTo(current - 1);
    else if (event.key === 'PageDown') moveTo(Math.min(current + 8, shown.length - 1));
    else if (event.key === 'PageUp') moveTo(Math.max(current - 8, 0));
    else if (event.key === 'Enter') {
      event.preventDefault();
      choose(shown[current]);
    }
  };

  return (
    <>
      <ModalOverlay
        isOpen={open}
        onOpenChange={setOpen}
        isDismissable
        className={styles.overlay}
      >
        <Modal className={styles.modal}>
          <Dialog aria-label={t('label')} className={cx(menu.surface, styles.surface)}>
            <div className={styles.search}>
              <Icon name="search" className={styles.searchIcon} />
              <input
                className={styles.input}
                role="combobox"
                aria-label={t('label')}
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={
                  shown[current] ? `${listId}-${current}` : undefined
                }
                placeholder={t('placeholder')}
                value={query}
                autoFocus
                spellCheck={false}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
              />
            </div>
            <ul
              ref={list}
              id={listId}
              role="listbox"
              aria-label={t('label')}
              className={styles.list}
            >
              {shown.length === 0 && <li className={styles.empty}>{t('empty')}</li>}
              {shown.map((entry, index) => (
                <li
                  key={entry.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === current}
                  aria-disabled={entry.isDisabled || undefined}
                  className={menu.item}
                  data-focused={index === current || undefined}
                  data-disabled={entry.isDisabled || undefined}
                  onPointerMove={() => index !== current && setActive(index)}
                  onClick={() => choose(entry)}
                >
                  <span className={menu.lead}>
                    <Icon name={KIND_ICONS[entry.kind]} />
                  </span>
                  <span className={menu.label}>{entry.label}</span>
                  {entry.keys && entry.keys.length > 0 ? (
                    <Kbd keys={entry.keys} className={styles.keys} />
                  ) : (
                    entry.kind !== 'command' && (
                      <span className={menu.hint}>{kindLabel[entry.kind]}</span>
                    )
                  )}
                </li>
              ))}
            </ul>
          </Dialog>
        </Modal>
      </ModalOverlay>
      <OnboardingTour />
    </>
  );
}
