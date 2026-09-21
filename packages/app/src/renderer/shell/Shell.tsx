import { memo, useEffect, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { windowApi } from '../../ipc/renderer';
import {
  closePane,
  dropOnPane,
  MAX_PANES,
  neighbourOf,
  shownPanes,
  storedPanes,
  type PaneDropPosition,
} from '../../shared/panes';
import { DEFAULT_LAYOUT, type Platform, type WindowState } from '../../shared/stores';
import { SplitHandle } from '../../ui';
import {
  formatFocusedEditor,
  toggleMinimap,
  toggleSoftWrap,
} from '../editor/editor-state';
import { applyRuntimeErrors, markModelsSynced, syncModels } from '../editor/models';
import {
  claimReveal,
  setRuntimeErrors,
  toEditorErrors,
  useRevealRequest,
} from '../editor/runtime-errors';
import { useEditorTypes } from '../editor/types';
import { log } from '../features/about/log';
import { useDocumentDrop } from '../features/documents/useDocumentDrop';
import { Sidebar } from '../features/files/Sidebar';
import { splitTarget } from './processes';
import { Sheet } from './Sheet';
import styles from './Shell.module.css';
import { StatusBar } from './StatusBar';
import { TitleBar } from './TitleBar';
import { ErrorBoundary } from './ErrorBoundary';
import { useDraft } from './use-draft';
import { useAppState, useWindowState } from '../state';
import {
  moveFile,
  setActiveFile,
  setFileVisible,
  setLayout,
  setView,
} from './window-state';

const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 320;

export function Shell() {
  const state = useWindowState();
  const app = useAppState();
  if (!state || !app) return null;
  return <ShellView state={state} platform={app.platform} />;
}

// Memoized: a store push that changes nothing this shows (download progress in the App store) skips the whole tree.
const ShellView = memo(function ShellView({
  state,
  platform,
}: {
  state: WindowState;
  platform: Platform;
}) {
  const { t } = useTranslation('shell');
  const { fiddle, layout } = state;
  const failTitle = t('fileChangeFailed');
  const names = fiddle.files.map((file) => file.name);
  const namesKey = names.join('\n');

  useEffect(() => {
    syncModels(namesKey ? namesKey.split('\n') : [], fiddle.fiddleRev)
      .catch((error: unknown) => {
        log.error('syncing editor models failed', error);
      })
      .finally(markModelsSynced);
  }, [namesKey, fiddle.fiddleRev]);

  // Main owns the run's errors (and clears them when another fiddle loads). The editors and badges read the copy in
  // runtime-errors.ts, and the models draw them as markers.
  const runErrors = state.run?.errors;
  useEffect(() => {
    const errors = toEditorErrors(runErrors ?? []);
    setRuntimeErrors(errors);
    applyRuntimeErrors(errors);
  }, [runErrors]);

  const dropping = useDocumentDrop();

  const changeLayout = (patch: Partial<WindowState['layout']>) =>
    void setLayout(layout, patch, failTitle);
  const openFile = (name: string) => void setActiveFile(name, failTitle);
  // Picking a file in the sidebar leaves the Settings page.
  const openFromSidebar = (name: string) => {
    if (state.view !== 'editor') void setView('editor', failTitle);
    openFile(name);
  };

  // The tab row shows the visible files and selects the focused pane's file.
  // `panes` are the files in the editor panes; a single entry means no split.
  const visibleNames = fiddle.files
    .filter((file) => file.visible)
    .map((file) => file.name);
  const active =
    fiddle.activeFile && visibleNames.includes(fiddle.activeFile)
      ? fiddle.activeFile
      : (visibleNames[0] ?? null);
  const panes = shownPanes(layout.panes, visibleNames, active);
  const split = panes.length > 1;

  // revealLocation(): focus the file's pane, or show the file in the focused pane.
  const reveal = useRevealRequest();
  const revealed = useRef(0);
  useEffect(() => {
    if (!reveal || reveal.seq <= revealed.current) return;
    revealed.current = reveal.seq;
    if (!names.includes(reveal.file)) {
      claimReveal(reveal.seq);
      return;
    }
    if (state.view !== 'editor') void setView('editor', failTitle);
    if (reveal.file !== fiddle.activeFile) openFile(reveal.file);
  });

  /** Shows these panes (layout first, so main sees them before the focus change), focusing `focus`. */
  const showPanes = (next: readonly string[], focus?: string | null) => {
    const stored = storedPanes(next);
    if (
      stored.length !== layout.panes.length ||
      stored.some((name, i) => name !== layout.panes[i])
    ) {
      changeLayout({ panes: stored });
    }
    if (focus && focus !== fiddle.activeFile) openFile(focus);
  };

  // One pane: open a second one beside it. Several: keep only the focused one.
  const toggleSplit = () => {
    if (!active) return;
    if (split) {
      showPanes([active]);
      return;
    }
    const target = splitTarget(active, names);
    if (!target) return;
    if (!visibleNames.includes(target)) void setFileVisible(target, true, failTitle);
    showPanes([active, target]);
  };

  // Closing a tab hides its file. Its pane closes with it; the last pane shows the next tab instead.
  const closeFile = (name: string) => {
    if (split && panes.includes(name)) {
      showPanes(
        closePane(panes, name),
        name === active ? neighbourOf(panes, name) : undefined,
      );
    } else if (name === active) {
      const index = visibleNames.indexOf(name);
      const next = visibleNames[index + 1] ?? visibleNames[index - 1];
      if (next) openFile(next);
    }
    void setFileVisible(name, false, failTitle);
  };

  const dropTab = (name: string, index: number, position: PaneDropPosition) => {
    if (!visibleNames.includes(name)) return;
    const next = dropOnPane(panes, name, index, position);
    if (next.length > MAX_PANES) return;
    showPanes(next, name);
  };

  // Window.Command handlers that act on view state and Monaco. Kept in a ref, not `useEffectEvent`: React never
  // updates the effect events of a memo component, so it would keep the first render's state.
  const onCommand = (id: string) => {
    if (id === 'view.toggleSplit') toggleSplit();
    else if (id === 'editor.toggleSoftWrap') toggleSoftWrap();
    else if (id === 'editor.toggleMinimap') toggleMinimap();
    else if (id === 'editor.format') void formatFocusedEditor();
  };
  const latestOnCommand = useRef(onCommand);
  useLayoutEffect(() => {
    latestOnCommand.current = onCommand;
  });
  useEffect(() => windowApi.onCommand((id) => latestOnCommand.current(id)), []);
  useEditorTypes();

  useEffect(() => {
    document.title = state.title;
  }, [state.title]);

  const [sidebarWidth, setSidebarWidth] = useDraft(layout.sidebarWidth, (width) =>
    changeLayout({ sidebarWidth: width }),
  );
  const shownSidebarWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, sidebarWidth));

  const resetLayout = () => {
    changeLayout({ ...DEFAULT_LAYOUT });
    for (const file of fiddle.files)
      if (!file.visible) void setFileVisible(file.name, true, failTitle);
  };

  return (
    <div className={styles.shell} data-platform={platform} data-sidebar={layout.sidebar}>
      <TitleBar
        name={fiddle.name}
        dirty={fiddle.dirty}
        platform={platform}
        sidebar={layout.sidebar}
        settingsOpen={state.view === 'settings'}
        menuBar={state.menuBar}
        onToggleSidebar={() => changeLayout({ sidebar: !layout.sidebar })}
        onToggleSettings={() =>
          void setView(state.view === 'settings' ? 'editor' : 'settings', failTitle)
        }
      />
      {layout.sidebar && (
        <div className={styles.side} style={{ width: shownSidebarWidth }}>
          <div className={styles.sideInner}>
            <ErrorBoundary region="sidebar">
              <Sidebar
                files={fiddle.files}
                dirtyFiles={fiddle.dirtyFiles}
                // No row is current while the Settings page covers the editor, so picking the current file opens it too.
                activeFile={state.view === 'editor' ? fiddle.activeFile : null}
                onOpen={openFromSidebar}
                onSetVisible={(name, visible) =>
                  visible ? void setFileVisible(name, true, failTitle) : closeFile(name)
                }
              />
            </ErrorBoundary>
          </div>
          <SplitHandle
            value={shownSidebarWidth}
            min={SIDEBAR_MIN}
            max={SIDEBAR_MAX}
            onChange={setSidebarWidth}
            onReset={() => setSidebarWidth(DEFAULT_LAYOUT.sidebarWidth)}
            label={t('resizeSidebar')}
          />
        </div>
      )}
      <div className={styles.sheetArea}>
        <ErrorBoundary region="sheet">
          <Sheet
            state={state}
            active={active}
            panes={panes}
            // A tab (or sidebar row) picks the focused pane's file: a file in another pane moves focus there instead.
            onSelectFile={openFile}
            onCloseFile={closeFile}
            onMoveFile={(name, before) => void moveFile(name, before, failTitle)}
            onDropOnPane={dropTab}
            onFocusPane={(name) => {
              if (name !== fiddle.activeFile) openFile(name);
            }}
            onToggleSplit={toggleSplit}
            onClosePane={(name) =>
              showPanes(
                closePane(panes, name),
                name === active ? neighbourOf(panes, name) : undefined,
              )
            }
            onMaximize={(name) => showPanes([name], name)}
            onConsoleHeight={(height) => changeLayout({ consoleHeight: height })}
            onHideConsole={() => changeLayout({ consoleVisible: false })}
            onResetLayout={resetLayout}
            dropping={dropping}
          />
        </ErrorBoundary>
      </div>
      <StatusBar files={names} />
    </div>
  );
});
