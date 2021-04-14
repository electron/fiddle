import * as path from 'path';
import { DEFAULT_EDITORS, DefaultEditorId, EditorId } from '../interfaces';

export function isKnownFile(filename: string): boolean {
  return DEFAULT_EDITORS.includes(filename as any);
}

const TITLE_MAP: Record<DefaultEditorId, string> = Object.freeze({
  [DefaultEditorId.main]: `Main Process (${DefaultEditorId.main})`,
  [DefaultEditorId.renderer]: `Renderer Process (${DefaultEditorId.renderer})`,
  [DefaultEditorId.preload]: `Preload (${DefaultEditorId.preload})`,
  [DefaultEditorId.html]: `HTML (${DefaultEditorId.html})`,
  [DefaultEditorId.css]: `Stylesheet (${DefaultEditorId.css})`,
});

export function getEditorTitle(id: EditorId): string {
  return TITLE_MAP[id] || `Custom Editor (${id})`;
}

const EMPTY_EDITOR_CONTENT = {
  css: '/* Empty */',
  html: '<!-- Empty -->',
  js: '// Empty',
} as const;

function getSuffix(filename: string): string {
  return path.parse(filename).ext.slice(1);
}

export function getEmptyContent(filename: string): string {
  return EMPTY_EDITOR_CONTENT[getSuffix(filename)] || '';
}

const SupportedFiles = Object.freeze(
  new Set(Object.keys(EMPTY_EDITOR_CONTENT)),
);

export function isSupportedFile(filename: string): boolean {
  return SupportedFiles.has(getSuffix(filename));
}
