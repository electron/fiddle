/**
 * One Monaco model per fiddle file, as `inmemory://fiddle/<name>`, kept in
 * step with `Window.fiddle.files` (REQUIREMENTS §3, "Editor text"):
 *
 * - New names and every new `fiddleRev` fetch text with `Documents.GetFiles`.
 * - Models whose names are gone are disposed.
 * - Local changes go to main with `EditFile(name, text, fiddleRev)`, at most
 *   once per animation frame.
 *
 * Runtime errors are drawn here too, as model decorations and markers, so
 * every editor showing a file shows its errors.
 */
import { useSyncExternalStore } from 'react';

import { getEditorLanguage } from '../../fiddle/files';
import { documentsApi } from '../../ipc/renderer';
import { monaco } from './monaco';
import { getRuntimeErrors, type RuntimeError } from './runtime-errors';

type Model = monaco.editor.ITextModel;

const models = new Map<string, Model>();
let fiddleRev = -1;
let fetchSeq = 0;
/** True while we apply text from main, so it isn't echoed back. */
let applying = false;
const pendingEdits = new Set<string>();
let frame = 0;
let version = 0;
const listeners = new Set<() => void>();
/** Decoration IDs of the error lines, per file. */
const errorDecorations = new Map<string, string[]>();

function emit() {
  version += 1;
  for (const listener of listeners) listener();
}

export function modelUri(name: string): monaco.Uri {
  return monaco.Uri.from({ scheme: 'inmemory', authority: 'fiddle', path: `/${name}` });
}

export function getModel(name: string | null | undefined): Model | undefined {
  return name ? models.get(name) : undefined;
}

/** Re-renders when models are created or disposed; returns the file's model. */
export function useModel(name: string | null | undefined): Model | undefined {
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version,
  );
  return getModel(name);
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

/**
 * Brings the models in line with the store. Call it whenever the file list or
 * `fiddleRev` changes.
 */
export async function syncModels(names: readonly string[], rev: number): Promise<void> {
  const revChanged = rev !== fiddleRev;
  fiddleRev = rev;
  let changed = false;
  for (const [name, model] of models) {
    if (names.includes(name)) continue;
    model.dispose();
    models.delete(name);
    errorDecorations.delete(name);
    pendingEdits.delete(name);
    changed = true;
  }
  const missing = names.filter((name) => !models.has(name));
  if (revChanged) pendingEdits.clear();
  if (!revChanged && missing.length === 0) {
    if (changed) emit();
    return;
  }
  const seq = ++fetchSeq;
  const texts = await documentsApi.GetFiles();
  if (seq !== fetchSeq) return;
  for (const name of names) {
    const text = Object.hasOwn(texts, name) ? (texts[name] ?? '') : '';
    const model = models.get(name);
    if (!model) createModel(name, text);
    // A new fiddle replaces every model's text; otherwise keep local edits.
    else if (revChanged) setText(model, text);
  }
  applyRuntimeErrors(getRuntimeErrors());
  emit();
}

/** Draws runtime errors: the spark-soft line, the spark line number and a squiggle. */
export function applyRuntimeErrors(errors: readonly RuntimeError[]): void {
  for (const [name, model] of models) {
    const mine = errors.filter((error) => error.file === name && error.line <= model.getLineCount());
    monaco.editor.setModelMarkers(
      model,
      'fiddle-runtime',
      mine.map((error) => {
        const word = model.getWordAtPosition({ lineNumber: error.line, column: error.column });
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
