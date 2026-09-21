/**
 * The tab row and editor panes as the window's files and layout give them, and what the tabs, panes, sidebar and
 * title bar do to them. Main owns the state: each action requests a change, which window-state.ts shows at once
 * and toasts under `failTitle` if main refuses it.
 */
import {
  closePane,
  dropOnPane,
  MAX_PANES,
  neighbourOf,
  shownPanes,
  storedPanes,
  type PaneDropPosition,
} from '../../shared/panes';
import { DEFAULT_LAYOUT, type WindowLayout, type WindowState } from '../../shared/stores';
import { splitTarget } from './processes';
import {
  moveFile,
  setActiveFile,
  setFileVisible,
  setLayout,
  setView,
} from './window-state';

export type PaneActions = ReturnType<typeof paneActions>;

export function paneActions(state: WindowState, failTitle: string) {
  const { fiddle, layout } = state;
  const names = fiddle.files.map((file) => file.name);
  // The tab row shows the visible files and selects the focused pane's file.
  const visibleNames = fiddle.files
    .filter((file) => file.visible)
    .map((file) => file.name);
  const active =
    fiddle.activeFile && visibleNames.includes(fiddle.activeFile)
      ? fiddle.activeFile
      : (visibleNames[0] ?? null);
  // The files in the editor panes, from the start; a single entry means no split.
  const panes = shownPanes(layout.panes, visibleNames, active);
  const split = panes.length > 1;

  const changeLayout = (patch: Partial<WindowLayout>) =>
    void setLayout(layout, patch, failTitle);
  const openFile = (name: string) => void setActiveFile(name, failTitle);
  const showEditor = () => {
    if (state.view !== 'editor') void setView('editor', failTitle);
  };

  /** Shows these panes (layout first, so main sees them before the focus change), focusing `focus`. */
  const showPanes = (next: readonly string[], focus?: string | null) => {
    const stored = storedPanes(next);
    if (
      stored.length !== layout.panes.length ||
      stored.some((name, i) => name !== layout.panes[i])
    )
      changeLayout({ panes: stored });
    if (focus && focus !== fiddle.activeFile) openFile(focus);
  };
  /** Closes a pane without hiding its file; the neighbouring pane takes its focus. */
  const closePaneOf = (name: string) =>
    showPanes(
      closePane(panes, name),
      name === active ? neighbourOf(panes, name) : undefined,
    );
  // Closing a tab hides its file. Its pane closes with it; the last pane shows the next tab instead.
  const closeFile = (name: string) => {
    if (split && panes.includes(name)) closePaneOf(name);
    else if (name === active) {
      const index = visibleNames.indexOf(name);
      const next = visibleNames[index + 1] ?? visibleNames[index - 1];
      if (next) openFile(next);
    }
    void setFileVisible(name, false, failTitle);
  };

  return {
    names,
    /** The focused pane's file, which the tab row selects; null when no file is open. */
    active,
    panes,
    changeLayout,
    // A tab (or sidebar row) picks the focused pane's file: a file in another pane moves focus there instead.
    openFile,
    showEditor,
    /** Picking a file in the sidebar leaves the Settings page. */
    openFromSidebar: (name: string) => {
      showEditor();
      openFile(name);
    },
    toggleSettings: () =>
      void setView(state.view === 'settings' ? 'editor' : 'settings', failTitle),
    /** From the sidebar: showing a file opens its tab, hiding it closes the tab. */
    setVisible: (name: string, visible: boolean) =>
      visible ? void setFileVisible(name, true, failTitle) : closeFile(name),
    closeFile,
    /** A tab was dragged along the row: its file goes in front of `before`'s, or to the end. */
    moveFile: (name: string, before: string | null) =>
      void moveFile(name, before, failTitle),
    focusPane: (name: string) => {
      if (name !== fiddle.activeFile) openFile(name);
    },
    // One pane: open a second one beside it. Several: keep only the focused one.
    toggleSplit: () => {
      if (!active) return;
      if (split) return showPanes([active]);
      const target = splitTarget(active, names);
      if (!target) return;
      if (!visibleNames.includes(target)) void setFileVisible(target, true, failTitle);
      showPanes([active, target]);
    },
    closePane: closePaneOf,
    maximize: (name: string) => showPanes([name], name),
    /** A tab was dropped on pane `index`: in its middle, or on the edge where a new pane opens. */
    dropTab: (name: string, index: number, position: PaneDropPosition) => {
      if (!visibleNames.includes(name)) return;
      const next = dropOnPane(panes, name, index, position);
      if (next.length <= MAX_PANES) showPanes(next, name);
    },
    resetLayout: () => {
      changeLayout({ ...DEFAULT_LAYOUT });
      for (const file of fiddle.files)
        if (!file.visible) void setFileVisible(file.name, true, failTitle);
    },
  };
}
