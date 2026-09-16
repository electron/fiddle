/**
 * The main window, built to Lucent's window anatomy: title bar, sidebar,
 * sheet and status bar. Main owns the state; this renders the Window store
 * (with optimistic changes) and requests changes through Documents.
 */
import { useEffect, useEffectEvent, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { windowApi } from '../../ipc/renderer';
import { DEFAULT_LAYOUT, type WindowState } from '../../shared/stores';
import { SplitHandle } from '../../ui';
import { formatFocusedEditor, toggleMinimap, toggleSoftWrap } from '../editor/editor-state';
import { applyRuntimeErrors, markModelsSynced, syncModels } from '../editor/models';
import { useRevealRequest, useRuntimeErrors } from '../editor/runtime-errors';
import { useDocumentDrop } from '../features/documents/useDocumentDrop';
import { useEditorTypes } from '../editor/types';
import { Sidebar } from '../features/files/Sidebar';
import { splitTarget } from './processes';
import { Sheet } from './Sheet';
import styles from './Shell.module.css';
import { StatusBar } from './StatusBar';
import { TitleBar } from './TitleBar';
import { ErrorBoundary } from './ErrorBoundary';
import { useDraft } from './use-draft';
import { useAppState, useWindowState } from '../state';
import { setActiveFile, setFileVisible, setLayout, setView } from './window-state';

const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 320;

export function Shell() {
  const state = useWindowState();
  const app = useAppState();
  if (!state || !app) return null;
  return <ShellView state={state} platform={app.platform} />;
}

function ShellView({ state, platform }: { state: WindowState; platform: 'darwin' | 'win32' | 'linux' }) {
  const { t } = useTranslation('shell');
  const { fiddle, layout } = state;
  const failTitle = t('fileChangeFailed');
  const names = fiddle.files.map((file) => file.name);
  const namesKey = names.join('\n');

  // Monaco models follow the file list and fiddleRev.
  useEffect(() => {
    syncModels(namesKey ? namesKey.split('\n') : [], fiddle.fiddleRev)
      .catch((error: unknown) => {
        console.error('[fiddle] syncing editor models failed', error);
      })
      .finally(markModelsSynced);
  }, [namesKey, fiddle.fiddleRev]);

  // When another fiddle loads, main clears its console and runtime errors (RunService).
  const errors = useRuntimeErrors();
  useEffect(() => applyRuntimeErrors(errors), [errors]);

  // Gist links, deep links and folders dropped on the window.
  const dropping = useDocumentDrop();

  const changeLayout = (patch: Partial<WindowState['layout']>) => void setLayout(layout, patch, failTitle);
  const openFile = (name: string) => void setActiveFile(name, failTitle);

  // revealLocation() for a file that isn't showing: make it the current file.
  const reveal = useRevealRequest();
  const revealed = useRef(0);
  useEffect(() => {
    if (!reveal || reveal.seq <= revealed.current) return;
    revealed.current = reveal.seq;
    if (!names.includes(reveal.file)) return;
    if (state.view !== 'editor') void setView('editor', failTitle);
    if (reveal.file !== fiddle.activeFile && reveal.file !== layout.split) openFile(reveal.file);
  });

  // The tab row shows the visible files; its current file is the main pane's.
  const visibleNames = fiddle.files.filter((file) => file.visible).map((file) => file.name);
  const current =
    fiddle.activeFile && visibleNames.includes(fiddle.activeFile) ? fiddle.activeFile : (visibleNames[0] ?? null);
  const split = layout.split && names.includes(layout.split) ? layout.split : null;

  const toggleSplit = () => {
    if (layout.split) changeLayout({ split: null });
    else {
      const target = splitTarget(current, names);
      if (!target) return;
      changeLayout({ split: target });
      if (!visibleNames.includes(target)) void setFileVisible(target, true, failTitle);
    }
  };

  // Selecting the split pane's file swaps the panes, so no file shows twice.
  const selectFile = (name: string) => {
    if (name === split && current) changeLayout({ split: current });
    openFile(name);
  };

  const openBeside = (name: string) => {
    if (name === split) return;
    if (name !== current) {
      changeLayout({ split: name });
      return;
    }
    const left = split ?? splitTarget(name, visibleNames);
    if (!left) return;
    changeLayout({ split: name });
    openFile(left);
  };

  // Closing a tab hides its file. The main pane moves to the split file, or the next tab.
  const closeFile = (name: string) => {
    if (name === split) changeLayout({ split: null });
    else if (name === current) {
      const index = visibleNames.indexOf(name);
      const next = split ?? visibleNames[index + 1] ?? visibleNames[index - 1];
      if (split) changeLayout({ split: null });
      if (next) openFile(next);
    }
    void setFileVisible(name, false, failTitle);
  };

  // Commands whose handlers act on view state and Monaco (Window.Command).
  const onCommand = useEffectEvent((id: string) => {
    if (id === 'view.toggleSplit') toggleSplit();
    else if (id === 'view.toggleSidebar') changeLayout({ sidebar: !layout.sidebar });
    else if (id === 'view.toggleConsole') changeLayout({ consoleVisible: !layout.consoleVisible });
    else if (id === 'editor.toggleSoftWrap') toggleSoftWrap();
    else if (id === 'editor.toggleMinimap') toggleMinimap();
    else if (id === 'editor.format') void formatFocusedEditor();
  });
  useEffect(() => windowApi.onCommand((id) => onCommand(id)), []);
  useEditorTypes();

  // The OS window title shows unsaved changes.
  useEffect(() => {
    document.title = fiddle.dirty ? t('windowTitleEdited', { name: fiddle.name }) : fiddle.name;
  }, [fiddle.dirty, fiddle.name, t]);

  const [sidebarWidth, setSidebarWidth] = useDraft(layout.sidebarWidth, (width) =>
    changeLayout({ sidebarWidth: width }),
  );
  const shownSidebarWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, sidebarWidth));

  const resetLayout = () => {
    changeLayout({ ...DEFAULT_LAYOUT });
    for (const file of fiddle.files) if (!file.visible) void setFileVisible(file.name, true, failTitle);
  };

  return (
    <div className={styles.shell} data-platform={platform} data-sidebar={layout.sidebar}>
      <TitleBar
        name={fiddle.name}
        dirty={fiddle.dirty}
        platform={platform}
        sidebar={layout.sidebar}
        settingsOpen={state.view === 'settings'}
        onToggleSidebar={() => changeLayout({ sidebar: !layout.sidebar })}
        onToggleSettings={() => void setView(state.view === 'settings' ? 'editor' : 'settings', failTitle)}
      />
      {layout.sidebar && (
        <div className={styles.side} style={{ width: shownSidebarWidth }}>
          <div className={styles.sideInner}>
            <ErrorBoundary region="sidebar">
              <Sidebar
                files={fiddle.files}
                dirtyFiles={fiddle.dirtyFiles}
                activeFile={fiddle.activeFile}
                onOpen={selectFile}
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
          platform={platform}
          onSelectFile={selectFile}
          onCloseFile={closeFile}
          onOpenHere={(name) => {
            if (name !== current) selectFile(name);
          }}
          onOpenBeside={openBeside}
          onToggleSplit={toggleSplit}
          onCloseLeft={() => {
            const right = layout.split;
            changeLayout({ split: null });
            if (right) openFile(right);
          }}
          onCloseRight={() => changeLayout({ split: null })}
          onMaximize={(name) => {
            changeLayout({ split: null });
            if (name !== fiddle.activeFile) openFile(name);
          }}
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
}
