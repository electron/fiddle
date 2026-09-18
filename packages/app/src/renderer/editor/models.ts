/**
 * One Monaco model per fiddle file, as `inmemory://fiddle/<name>`, kept in
 * step with `Window.fiddle.files`:
 *
 * - New names and every new `fiddleRev` fetch text with `Documents.GetFiles`.
 * - Models whose names are gone are disposed.
 * - Local changes go to main with `EditFile(name, text, fiddleRev)`, at most
 *   once per animation frame.
 *
 * Runtime errors are drawn here too, as model decorations and markers, so
 * every editor showing a file shows its errors. Monaco's own errors and
 * warnings are reported to `diagnostics.ts` for the badges.
 */
import { getEditorLanguage } from '../../fiddle/files';
import { documentsApi } from '../../ipc/renderer';
import { createStore, useStore } from '../store';
import { setEditorMarkers, type EditorMarker } from './diagnostics';
import { monaco } from './monaco';
import { getRuntimeErrors, type RuntimeError } from './runtime-errors';

type Model = monaco.editor.ITextModel;

/** The marker owner of the runtime errors drawn below; they count through runtime-errors.ts instead. */
const RUNTIME_OWNER = 'fiddle-runtime';

const models = new Map<string, Model>();
/** The `fiddleRev` whose text the models hold. Edits carry it, so main drops the ones made against another. */
let fiddleRev = -1;
let fetchSeq = 0;
/** True while we apply text from main, so it isn't echoed back. */
let applying = false;
const pendingEdits = new Set<string>();
let frame = 0;
/** Counts model creations and disposals. */
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

/** Re-renders when models are created or disposed; returns the file's model. */
export function useModel(name: string | null | undefined): Model | undefined {
  useStore(modelVersion);
  return getModel(name);
}

function emitModelsChanged() {
  modelVersion.set(modelVersion.get() + 1);
}

function flushEdits() {
  frame = 0;
  const rev = fiddleRev;
  for (const name of pendingEdits) {
    const model = models.get(name);
    if (!model) continue;
    documentsApi.EditFile(name, model.getValue(), rev).catch((error: unknown) => {
      console.error('[fiddle] EditFile failed', name, error);
    });
  }
  pendingEdits.clear();
}

function createModel(name: string, text: string): Model {
  const model = monaco.editor.createModel(text, getEditorLanguage(name), modelUri(name));
  model.updateOptions({ tabSize: 2, insertSpaces: true });
  model.onDidChangeContent(() => {
    if (applying) return;
    pendingEdits.add(name);
    if (!frame) frame = requestAnimationFrame(flushEdits);
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

/**
 * Brings the models in line with the store. Call it whenever the file list or
 * `fiddleRev` changes.
 */
export async function syncModels(names: readonly string[], rev: number): Promise<void> {
  markerListener ??= monaco.editor.onDidChangeMarkers(publishMarkers);
  const revChanged = rev !== fiddleRev;
  let changed = false;
  for (const [name, model] of models) {
    if (names.includes(name)) continue;
    model.dispose();
    models.delete(name);
    errorDecorations.delete(name);
    pendingEdits.delete(name);
    changed = true;
  }
  if (changed) publishMarkers();
  const missing = names.filter((name) => !models.has(name));
  if (!revChanged && missing.length === 0) {
    if (changed) emitModelsChanged();
    return;
  }
  const seq = ++fetchSeq;
  const texts = await documentsApi.GetFiles();
  if (seq !== fetchSeq) return;
  // Only now do edits carry the new rev: one typed while the text was on its way was made against the old
  // text, which the new text replaces, and main must not keep it.
  fiddleRev = rev;
  if (revChanged) pendingEdits.clear();
  for (const name of names) {
    const text = Object.hasOwn(texts, name) ? (texts[name] ?? '') : '';
    const model = models.get(name);
    if (!model) createModel(name, text);
    // A new fiddle replaces every model's text; otherwise keep local edits.
    else if (revChanged) setText(model, text);
  }
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
