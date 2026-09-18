/**
 * Formatting with standalone Prettier for
 * JavaScript, HTML and CSS: the whole document or the selection. Prettier
 * loads on the first format. monaco.ts registers it as Monaco's document and
 * range formatter, so the `editor.format` command and the context menu's
 * "Format document" and "Format selection" all go through it.
 */
import type { editor, IDisposable, IRange, languages } from 'monaco-editor';

export const PRETTIER_PARSERS = {
  javascript: 'babel',
  html: 'html',
  css: 'css',
} as const;
export type FormatLanguage = keyof typeof PRETTIER_PARSERS;

/** Fiddle's templates have no semicolons and use single quotes; formatting keeps that style. */
const STYLE = { semi: false, singleQuote: true };

type Prettier = typeof import('prettier/standalone');
let loading:
  | Promise<{
      format: Prettier['format'];
      plugins: NonNullable<Parameters<Prettier['format']>[1]>['plugins'];
    }>
  | undefined;

function loadPrettier() {
  loading ??= Promise.all([
    import('prettier/standalone'),
    import('prettier/plugins/babel'),
    import('prettier/plugins/estree'),
    import('prettier/plugins/html'),
    import('prettier/plugins/postcss'),
  ]).then(([standalone, ...plugins]) => ({ format: standalone.format, plugins }));
  return loading;
}

export interface FormatOptions {
  tabSize: number;
  insertSpaces: boolean;
  /** Character offsets of a selection to format; the rest is left as it is. */
  range?: { start: number; end: number };
}

/** `text` formatted by Prettier. Throws on a syntax error. */
export async function formatText(
  text: string,
  language: FormatLanguage,
  options: FormatOptions,
): Promise<string> {
  const { format, plugins } = await loadPrettier();
  return format(text, {
    ...STYLE,
    parser: PRETTIER_PARSERS[language],
    plugins,
    tabWidth: options.tabSize,
    useTabs: !options.insertSpaces,
    ...(options.range && {
      rangeStart: options.range.start,
      rangeEnd: options.range.end,
    }),
  });
}

function isFormatLanguage(id: string): id is FormatLanguage {
  return Object.hasOwn(PRETTIER_PARSERS, id);
}

/** One edit that replaces the model's text, or none when nothing changes or the code doesn't parse. */
async function formatModel(
  model: editor.ITextModel,
  options: languages.FormattingOptions,
  range?: IRange,
): Promise<languages.TextEdit[]> {
  const language = model.getLanguageId();
  if (!isFormatLanguage(language)) return [];
  const text = model.getValue();
  const selection = range && {
    start: model.getOffsetAt({
      lineNumber: range.startLineNumber,
      column: range.startColumn,
    }),
    end: model.getOffsetAt({ lineNumber: range.endLineNumber, column: range.endColumn }),
  };
  try {
    const formatted = await formatText(text, language, {
      tabSize: options.tabSize,
      insertSpaces: options.insertSpaces,
      ...(selection && { range: selection }),
    });
    return formatted === text
      ? []
      : [{ range: model.getFullModelRange(), text: formatted }];
  } catch (error) {
    // Usually a syntax error: leave the text alone. The editor's markers show where.
    console.warn('[fiddle] formatting failed', error);
    return [];
  }
}

export type FormattingRegistry = Pick<
  typeof languages,
  'registerDocumentFormattingEditProvider' | 'registerDocumentRangeFormattingEditProvider'
>;

export function registerPrettierFormatter(registry: FormattingRegistry): IDisposable[] {
  return Object.keys(PRETTIER_PARSERS).flatMap((language) => [
    registry.registerDocumentFormattingEditProvider(language, {
      displayName: 'Prettier',
      provideDocumentFormattingEdits: (model, options) => formatModel(model, options),
    }),
    registry.registerDocumentRangeFormattingEditProvider(language, {
      displayName: 'Prettier',
      provideDocumentRangeFormattingEdits: (model, range, options) =>
        formatModel(model, options, range),
    }),
  ]);
}
