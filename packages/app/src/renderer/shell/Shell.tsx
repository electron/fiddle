import { memo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { DEFAULT_LAYOUT, type Platform, type WindowState } from '../../shared/stores';
import { SplitHandle } from '../../ui';
import {
  formatFocusedEditor,
  toggleMinimap,
  toggleSoftWrap,
} from '../editor/editor-state';
import { applyRuntimeErrors, markModelsSynced, syncModels } from '../editor/models';
import { claimReveal, setRuntimeErrors, useRevealRequest } from '../editor/runtime-errors';
import { useEditorTypes } from '../editor/types';
import { log } from '../features/about/log';
import { useDocumentDrop } from '../features/documents/useDocumentDrop';
import { Sidebar } from '../features/files/Sidebar';
import { paneActions } from './pane-actions';
import { Sheet } from './Sheet';
import styles from './Shell.module.css';
import { StatusBar } from './StatusBar';
import { TitleBar } from './TitleBar';
import { ErrorBoundary } from './ErrorBoundary';
import { useDraft } from './use-draft';
import { useAppState, useWindowState } from '../state';
import { useCommand } from '../hooks';

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
  const actions = paneActions(state, t('fileChangeFailed'));
  const { names, changeLayout } = actions;
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
    setRuntimeErrors(runErrors ?? []);
    applyRuntimeErrors(runErrors ?? []);
  }, [runErrors]);

  const dropping = useDocumentDrop();

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
    actions.showEditor();
    actions.focusPane(reveal.file);
  });

  // The commands that act on view state and Monaco.
  useCommand((id) => {
    if (id === 'view.toggleSplit') actions.toggleSplit();
    else if (id === 'editor.toggleSoftWrap') toggleSoftWrap();
    else if (id === 'editor.toggleMinimap') toggleMinimap();
    else if (id === 'editor.format') void formatFocusedEditor();
  });
  useEditorTypes();

  useEffect(() => {
    document.title = state.title;
  }, [state.title]);

  const [sidebarWidth, setSidebarWidth] = useDraft(layout.sidebarWidth, (width) =>
    changeLayout({ sidebarWidth: width }),
  );
  const shownSidebarWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, sidebarWidth));

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
        onToggleSettings={actions.toggleSettings}
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
                onOpen={actions.openFromSidebar}
                onSetVisible={actions.setVisible}
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
          <Sheet state={state} actions={actions} dropping={dropping} />
        </ErrorBoundary>
      </div>
      <StatusBar files={names} />
    </div>
  );
});
