import type { editor, IRange, languages } from 'monaco-editor';
import { describe, expect, it, vi } from 'vitest';

import { formatText, registerPrettierFormatter, type FormattingRegistry } from './format';

const spaces = { tabSize: 2, insertSpaces: true };

/** The bits of a Monaco text model the providers use. */
function fakeModel(text: string, language: string) {
  const lines = text.split('\n');
  const full: IRange = {
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: lines.length,
    endColumn: (lines.at(-1) ?? '').length + 1,
  };
  return {
    full,
    model: {
      getValue: () => text,
      getLanguageId: () => language,
      getFullModelRange: () => full,
      getOffsetAt: ({ lineNumber, column }: { lineNumber: number; column: number }) =>
        lines.slice(0, lineNumber - 1).reduce((sum, line) => sum + line.length + 1, 0) + column - 1,
    } as unknown as editor.ITextModel,
  };
}

function register() {
  const documents = new Map<string, languages.DocumentFormattingEditProvider>();
  const ranges = new Map<string, languages.DocumentRangeFormattingEditProvider>();
  const registry = {
    registerDocumentFormattingEditProvider: vi.fn((language: string, provider) => {
      documents.set(language, provider);
      return { dispose: () => documents.delete(language) };
    }),
    registerDocumentRangeFormattingEditProvider: vi.fn((language: string, provider) => {
      ranges.set(language, provider);
      return { dispose: () => ranges.delete(language) };
    }),
  } as unknown as FormattingRegistry;
  const disposables = registerPrettierFormatter(registry);
  return { documents, ranges, disposables };
}

const token = { isCancellationRequested: false } as never;

// @feature editor.format
describe('formatText', () => {
  it('formats JavaScript, CSS and HTML in the templates’ style', async () => {
    expect(await formatText('const a = {b:"c"};', 'javascript', spaces)).toBe("const a = { b: 'c' }\n");
    expect(await formatText('a{color:red}', 'css', { tabSize: 4, insertSpaces: true })).toBe('a {\n    color: red;\n}\n');
    expect(await formatText('<ul><li>a</li><li>b</li></ul>', 'html', spaces)).toBe(
      '<ul>\n  <li>a</li>\n  <li>b</li>\n</ul>\n',
    );
  });

  it('formats only the selected range', async () => {
    const text = 'const a = {b:1}\nconst c = {d:2}\n';
    const start = text.indexOf('const c');
    expect(await formatText(text, 'javascript', { ...spaces, range: { start, end: text.length } })).toBe(
      'const a = {b:1}\nconst c = { d: 2 }\n',
    );
  });
});

// @feature editor.format
describe('registerPrettierFormatter', () => {
  it('registers a document and a range formatter for JavaScript, HTML and CSS', () => {
    const { documents, ranges, disposables } = register();
    expect([...documents.keys()]).toEqual(['javascript', 'html', 'css']);
    expect([...ranges.keys()]).toEqual(['javascript', 'html', 'css']);
    for (const disposable of disposables) disposable.dispose();
    expect(documents.size + ranges.size).toBe(0);
  });

  it('replaces the whole model with the formatted text', async () => {
    const { documents } = register();
    const { model, full } = fakeModel('a{color:red}', 'css');
    const edits = await documents.get('css')!.provideDocumentFormattingEdits(model, spaces, token);
    expect(edits).toEqual([{ range: full, text: 'a {\n  color: red;\n}\n' }]);
  });

  it('formats a selection through the range provider', async () => {
    const { ranges } = register();
    const { model, full } = fakeModel('const a = {b:1}\nconst c = {d:2}\n', 'javascript');
    const selection = { startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 16 } as never;
    const edits = await ranges.get('javascript')!.provideDocumentRangeFormattingEdits(model, selection, spaces, token);
    expect(edits).toEqual([{ range: full, text: 'const a = {b:1}\nconst c = { d: 2 }\n' }]);
  });

  it('makes no edit when the text is already formatted or does not parse', async () => {
    const { documents } = register();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const tidy = fakeModel("const a = { b: 'c' }\n", 'javascript').model;
    expect(await documents.get('javascript')!.provideDocumentFormattingEdits(tidy, spaces, token)).toEqual([]);
    const broken = fakeModel('const = {', 'javascript').model;
    expect(await documents.get('javascript')!.provideDocumentFormattingEdits(broken, spaces, token)).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
