// A renamed file gets a new model and so a new undo history: Monaco can't move a model's edit stack to another URI.
import { getEditorLanguage } from '../../fiddle/files';
import { documentsApi } from '../../ipc/renderer';
import { log } from '../features/about/log';
import { createStore, useStore } from '../store';
import { toastError } from '../toast-error';
import { setEditorMarkers, type EditorMarker } from './diagnostics';
import { releaseViewState } from './editor-state';
import { monaco } from './monaco';
import { getRuntimeErrors, type RuntimeError } from './runtime-errors';

type Model = monaco.editor.ITextModel;

/** Runtime errors are drawn as markers of this owner; diagnostics counts them separately. */
const RUNTIME_OWNER = 'fiddle-runtime';

const models = new Map<string, Model>();
/** The `fiddleRev` whose text the models hold. Edits carry it, so main drops the ones made against another. */
let fiddleRev = -1;
let fetchSeq = 0;
/** True while we apply text from main, so it isn't echoed back. */
let applying = false;
const pendingEdits = new Set<string>();
/** What main holds for each file, as far as we know: the text it last sent us or we last sent it. */
const mirrored = new Map<string, string>();
/** While typing, a file's whole text goes to main at most this often. */
const EDIT_INTERVAL_MS = 250;
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let lastFlush = 0;
/** New text is on its way from main: edits made against the old rev would be dropped, so they wait for it. */
let refreshing = false;
/** A send failed and none has succeeded since: the user was told once, not on every keystroke. */
let editsFailing = false;
const modelVersion = createStore(0);
const synced = createStore(false);
const errorDecorations = new Map<string, string[]>();
let markerListener: monaco.IDisposable | undefined;

export function modelUri(name: string): monaco.Uri {
  return monaco.Uri.from({ scheme: 'inmemory', authority: 'fiddle', path: `/${name}` });
}

export function getModel(name: string | null | undefined): Model | undefined {
  return name ? models.get(name) : undefined;
}

/** Called after the first sync, successful or not, so the window can be shown. */
export function markModelsSynced(): void {
  synced.set(true);
}

export const useModelsSynced = (): boolean => useStore(synced);

export function useModel(name: string | null | undefined): Model | undefined {
  useStore(modelVersion);
  return getModel(name);
}

function emitModelsChanged() {
  modelVersion.set(modelVersion.get() + 1);
}

function scheduleFlush(): void {
  flushTimer ??= setTimeout(
    flushEdits,
    Math.max(0, lastFlush + EDIT_INTERVAL_MS - Date.now()),
  );
}

function flushEdits(): void {
  clearTimeout(flushTimer);
  flushTimer = undefined;
  if (refreshing || pendingEdits.size === 0) return;
  lastFlush = Date.now();
  const rev = fiddleRev;
  for (const name of pendingEdits) {
    const model = models.get(name);
    if (!model) continue;
    const text = model.getValue();
    mirrored.set(name, text);
    documentsApi.EditFile(name, text, rev).then(
      () => {
        editsFailing = false;
      },
      (error: unknown) => {
        log.error('saving an edit failed', name, error);
        if (!editsFailing) toastError(error);
        editsFailing = true;
        // Main lacks this text: the next flush sends it again.
        mirrored.delete(name);
        if (models.has(name)) pendingEdits.add(name);
      },
    );
  }
  pendingEdits.clear();
}

// Main runs and saves the text it holds, so what was typed goes before a command can read it: on any focus change
// and on a shortcut. This listener is registered before the keybinding dispatcher's, so it hears the key first.
window.addEventListener('blur', flushEdits, true);
window.addEventListener(
  'keydown',
  (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || /^F\d+$/.test(event.key))
      flushEdits();
  },
  true,
);

function createModel(name: string, text: string): Model {
  const model = monaco.editor.createModel(text, getEditorLanguage(name), modelUri(name));
  model.updateOptions({ tabSize: 2, insertSpaces: true });
  model.onDidChangeContent(() => {
    if (applying) return;
    pendingEdits.add(name);
    scheduleFlush();
  });
  models.set(name, model);
  return model;
}

function setText(model: Model, text: string) {
  if (model.getValue() === text) return;
  applying = true;
  try {
    model.setValue(text);
  } finally {
    applying = false;
  }
}

/** Monaco's errors and warnings on the fiddle's files (syntax errors, CSS and JSON problems). */
function publishMarkers(): void {
  const list: EditorMarker[] = [];
  for (const [name, model] of models) {
    for (const marker of monaco.editor.getModelMarkers({ resource: model.uri })) {
      if (marker.owner === RUNTIME_OWNER) continue;
      if (marker.severity === monaco.MarkerSeverity.Error)
        list.push({ file: name, severity: 'error' });
      else if (marker.severity === monaco.MarkerSeverity.Warning)
        list.push({ file: name, severity: 'warning' });
    }
  }
  setEditorMarkers(list);
}

export async function syncModels(names: readonly string[], rev: number): Promise<void> {
  markerListener ??= monaco.editor.onDidChangeMarkers(publishMarkers);
  const revChanged = rev !== fiddleRev;
  let changed = false;
  for (const [name, model] of models) {
    if (names.includes(name)) continue;
    model.dispose();
    models.delete(name);
    releaseViewState(name);
    errorDecorations.delete(name);
    pendingEdits.delete(name);
    mirrored.delete(name);
    changed = true;
  }
  if (changed) publishMarkers();
  const missing = names.filter((name) => !models.has(name));
  if (!revChanged && missing.length === 0) {
    if (changed) emitModelsChanged();
    return;
  }
  const seq = ++fetchSeq;
  refreshing = revChanged;
  let texts: Awaited<ReturnType<typeof documentsApi.GetFiles>>;
  try {
    texts = await documentsApi.GetFiles();
  } finally {
    if (seq === fetchSeq) refreshing = false;
  }
  if (seq !== fetchSeq) return;
  fiddleRev = rev;
  if (revChanged) pendingEdits.clear();
  for (const name of names) {
    const text = Object.hasOwn(texts, name) ? (texts[name] ?? '') : '';
    const model = models.get(name);
    if (!model) createModel(name, text);
    else if (revChanged) {
      // A new fiddle replaces every model's text. A rename or an add bumps the rev too, and leaves the files as
      // they were: text typed meanwhile, on top of what main still holds, is kept and sent again.
      const local = model.getValue();
      if (local !== text && text === mirrored.get(name)) pendingEdits.add(name);
      else setText(model, text);
    }
    mirrored.set(name, text);
  }
  if (pendingEdits.size > 0) scheduleFlush();
  applyRuntimeErrors(getRuntimeErrors());
  emitModelsChanged();
}

export function applyRuntimeErrors(errors: readonly RuntimeError[]): void {
  for (const [name, model] of models) {
    const mine = errors.filter(
      (error) => error.file === name && error.line <= model.getLineCount(),
    );
    monaco.editor.setModelMarkers(
      model,
      RUNTIME_OWNER,
      mine.map((error) => {
        const word = model.getWordAtPosition({
          lineNumber: error.line,
          column: error.column,
        });
        return {
          severity: monaco.MarkerSeverity.Error,
          message: error.message,
          startLineNumber: error.line,
          startColumn: word?.startColumn ?? error.column,
          endLineNumber: error.line,
          endColumn: word?.endColumn ?? error.column + 1,
        };
      }),
    );
    const next = model.deltaDecorations(
      errorDecorations.get(name) ?? [],
      mine.map((error) => ({
        range: new monaco.Range(error.line, 1, error.line, 1),
        options: {
          isWholeLine: true,
          className: 'lu-error-line',
          marginClassName: 'lu-error-line',
          lineNumberClassName: 'lu-error-line-number',
        },
      })),
    );
    errorDecorations.set(name, next);
  }
}
