import { moveName } from '../../fiddle/files';
import { documentsApi, modulesApi, versionsApi } from '../../ipc/renderer';
import { followActiveFile } from '../../shared/panes';
import type { VersionRefValue, WindowLayout, WindowState } from '../../shared/stores';
import { createOptimistic } from '../optimistic';

const windowChanges = createOptimistic<WindowState>();
const change = windowChanges.change;

/** The Window store with pending changes on top, or null before it has loaded. */
export function useWithPending(base: WindowState | null): WindowState | null {
  return windowChanges.use(base, base?.rev ?? 0);
}

export function setLayout(
  current: WindowLayout,
  patch: Partial<WindowLayout>,
  errorTitle: string,
): Promise<boolean> {
  const layout = { ...current, ...patch };
  return change(
    (state) => ({ ...state, layout: { ...state.layout, ...patch } }),
    () => documentsApi.SetLayout(layout),
    errorTitle,
  );
}

/** Like main (Documents' `commit`): the focused pane follows the active file, and hidden files leave the panes. */
function withFiles(
  state: WindowState,
  files: WindowState['fiddle']['files'],
  activeFile: string | null,
): WindowState {
  const visible = files.filter((f) => f.visible).map((f) => f.name);
  const panes = followActiveFile(
    state.layout.panes,
    state.fiddle.activeFile,
    activeFile,
    visible,
  );
  return {
    ...state,
    fiddle: { ...state.fiddle, files, activeFile },
    layout:
      panes === state.layout.panes
        ? state.layout
        : { ...state.layout, panes: [...panes] },
  };
}

export function setActiveFile(name: string, errorTitle: string): Promise<boolean> {
  return change(
    (state) =>
      withFiles(
        state,
        state.fiddle.files.map((f) => (f.name === name ? { ...f, visible: true } : f)),
        name,
      ),
    () => documentsApi.SetActiveFile(name),
    errorTitle,
  );
}

export function setFileVisible(
  name: string,
  visible: boolean,
  errorTitle: string,
): Promise<boolean> {
  return change(
    (state) =>
      withFiles(
        state,
        state.fiddle.files.map((f) => (f.name === name ? { ...f, visible } : f)),
        state.fiddle.activeFile,
      ),
    () => documentsApi.SetFileVisible(name, visible),
    errorTitle,
  );
}

/** Moves a file's tab in front of `before`'s, or to the end. */
export function moveFile(
  name: string,
  before: string | null,
  errorTitle: string,
): Promise<boolean> {
  return change(
    (state) => {
      const byName = new Map(state.fiddle.files.map((f) => [f.name, f]));
      const names = moveName(
        state.fiddle.files.map((f) => f.name),
        name,
        before,
      );
      return {
        ...state,
        fiddle: { ...state.fiddle, files: names.map((n) => byName.get(n)!) },
      };
    },
    () => documentsApi.MoveFile(name, before),
    errorTitle,
  );
}

export function setVersionRef(
  ref: VersionRefValue,
  errorTitle: string,
): Promise<boolean> {
  return change(
    (state) => ({ ...state, fiddle: { ...state.fiddle, versionRef: ref } }),
    () => versionsApi.SetVersion(ref),
    errorTitle,
  );
}

export function setView(view: WindowState['view'], errorTitle: string): Promise<boolean> {
  return change(
    (state) => ({ ...state, view }),
    () => documentsApi.SetView(view),
    errorTitle,
  );
}

/** Adds a module at `version`, or at its latest when `version` is null (the row appears once main has looked it up). */
export function addModule(
  name: string,
  version: string | null,
  errorTitle: string,
): Promise<boolean> {
  return change(
    (state) =>
      version === null
        ? state
        : {
            ...state,
            fiddle: {
              ...state.fiddle,
              modules: { ...state.fiddle.modules, [name]: version },
            },
          },
    () => modulesApi.AddModule(name, version),
    errorTitle,
  );
}
