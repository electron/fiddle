import {
  EditorId,
  EditorValues,
  MAIN_CJS,
  MAIN_JS,
  MAIN_MJS,
} from '../interfaces';

const mainEntryPointFiles = new Set<EditorId>([MAIN_CJS, MAIN_JS, MAIN_MJS]);

const EMPTY_EDITOR_CONTENT: Record<EditorId, string> = {
  '.css': '/* Empty */',
  '.html': '<!-- Empty -->',
  '.cjs': '// Empty',
  '.js': '// Empty',
  '.mjs': '// Empty',
  '.json': '{}',
} as const;

export function getEmptyContent(filename: string): string {
  return EMPTY_EDITOR_CONTENT[`.${getSuffix(filename)}` as EditorId] || '';
}

export function isMainEntryPoint(id: EditorId) {
  return mainEntryPointFiles.has(id);
}

export function ensureRequiredFiles(values: EditorValues): EditorValues {
  const mainEntryPoint = Object.keys(values).find((id: EditorId) =>
    mainEntryPointFiles.has(id),
  ) as EditorId | undefined;

  // If no entry point is found, default to main.js
  if (!mainEntryPoint) {
    values[MAIN_JS] = getEmptyContent(MAIN_JS);
  } else {
    values[mainEntryPoint] ||= getEmptyContent(mainEntryPoint);
  }

  return values;
}

export function getSuffix(filename: string) {
  return filename.slice(filename.lastIndexOf('.') + 1);
}

export function isSupportedFile(filename: string): filename is EditorId {
  return /\.(css|html|cjs|js|mjs|json)$/i.test(filename);
}
