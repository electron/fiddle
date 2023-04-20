import { EditorId, EditorValues, MAIN_JS } from '../interfaces';

const requiredFiles = new Set<EditorId>([MAIN_JS]);

const EMPTY_EDITOR_CONTENT = {
  css: '/* Empty */',
  html: '<!-- Empty -->',
  js: '// Empty',
} as const;

export function getEmptyContent(filename: string): string {
  return (
    EMPTY_EDITOR_CONTENT[
      getSuffix(filename) as keyof typeof EMPTY_EDITOR_CONTENT
    ] || ''
  );
}

export function isRequiredFile(id: EditorId) {
  return requiredFiles.has(id);
}

export function ensureRequiredFiles(values: EditorValues): EditorValues {
  for (const file of requiredFiles) {
    values[file] ||= getEmptyContent(file);
  }
  return values;
}

export function getSuffix(filename: string) {
  return filename.slice(filename.lastIndexOf('.') + 1);
}

export function isSupportedFile(filename: string): filename is EditorId {
  return /\.(css|html|js)$/i.test(filename);
}
