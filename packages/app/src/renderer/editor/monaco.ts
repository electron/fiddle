/**
 * Monaco, loaded through Vite's ESM worker imports and started under the app's
 * CSP. `require-trusted-types-for 'script'` covers `new Worker()`, so workers
 * are created from bundled same-origin URLs through the `fiddleMonacoWorker`
 * Trusted Types policy (listed in src/main/csp.ts with Monaco's own policies).
 */
import * as monaco from 'monaco-editor';
import editorWorkerUrl from 'monaco-editor/editor/editor.worker.js?worker&url';
import cssWorkerUrl from 'monaco-editor/languages/features/css/css.worker.js?worker&url';
import htmlWorkerUrl from 'monaco-editor/languages/features/html/html.worker.js?worker&url';
import jsonWorkerUrl from 'monaco-editor/languages/features/json/json.worker.js?worker&url';
import tsWorkerUrl from 'monaco-editor/languages/features/typescript/ts.worker.js?worker&url';

import type { MonacoTheme } from '../../shared/settings';
import { registerPrettierFormatter } from './format';
import { buildLucentTheme, LUCENT_THEME, readEditorTokens } from './theme';

function workerUrl(label: string): string {
  switch (label) {
    case 'json':
      return jsonWorkerUrl;
    case 'css':
    case 'scss':
    case 'less':
      return cssWorkerUrl;
    case 'html':
    case 'handlebars':
    case 'razor':
      return htmlWorkerUrl;
    case 'typescript':
    case 'javascript':
      return tsWorkerUrl;
    default:
      return editorWorkerUrl;
  }
}

/** Only same-origin bundle URLs may become worker scripts. */
function sameOriginUrl(url: string): string {
  const resolved = new URL(url, location.href);
  if (resolved.origin !== location.origin)
    throw new Error(`Refusing worker URL ${resolved.href}`);
  return resolved.href;
}

interface TrustedTypePolicyFactory {
  createPolicy(
    name: string,
    rules: { createScriptURL(url: string): string },
  ): {
    createScriptURL(url: string): unknown;
  };
}

const workerPolicy = (
  window as { trustedTypes?: TrustedTypePolicyFactory }
).trustedTypes?.createPolicy('fiddleMonacoWorker', { createScriptURL: sameOriginUrl });

self.MonacoEnvironment = {
  getWorker(_workerId, label) {
    const url = workerPolicy
      ? workerPolicy.createScriptURL(workerUrl(label))
      : sameOriginUrl(workerUrl(label));
    // The DOM typings only admit string | URL; Chromium takes a TrustedScriptURL.
    return new Worker(url as unknown as string, { type: 'module', name: label });
  },
};

// JavaScript defaults: no semantic errors from missing typings, and the fiddle's
// CommonJS files are not modules (so top-level requires don't clash).
monaco.typescript.javascriptDefaults.setCompilerOptions({
  allowJs: true,
  allowNonTsExtensions: true,
  checkJs: false,
  target: monaco.typescript.ScriptTarget.ESNext,
  module: monaco.typescript.ModuleKind.CommonJS,
  moduleResolution: monaco.typescript.ModuleResolutionKind.NodeJs,
});
// Fiddles are CommonJS on purpose; skip "convert to ES module" style hints.
monaco.typescript.javascriptDefaults.setDiagnosticsOptions({
  noSuggestionDiagnostics: true,
});

// Formatting is Prettier's (./format.ts). Monaco uses the first formatter it
// finds, so the built-in JavaScript, HTML and CSS ones are turned off.
// setModeConfiguration replaces the whole configuration, so keep the rest.
const js = monaco.typescript.javascriptDefaults;
js.setModeConfiguration({ ...js.modeConfiguration, documentRangeFormattingEdits: false });
const html = monaco.html.htmlDefaults;
html.setModeConfiguration({
  ...html.modeConfiguration,
  documentFormattingEdits: false,
  documentRangeFormattingEdits: false,
});
const css = monaco.css.cssDefaults;
css.setModeConfiguration({
  ...css.modeConfiguration,
  documentFormattingEdits: false,
  documentRangeFormattingEdits: false,
});
registerPrettierFormatter(monaco.languages);

/**
 * (Re)defines the editor theme and applies it: Lucent, built from the current
 * tokens, or a custom theme's own Monaco theme data.
 */
export function applyEditorTheme(custom?: MonacoTheme): void {
  const { theme } = document.documentElement.dataset;
  const isDark = theme
    ? theme === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches;
  const data: monaco.editor.IStandaloneThemeData = custom
    ? {
        base: custom.base ?? (isDark ? 'vs-dark' : 'vs'),
        inherit: custom.inherit ?? true,
        rules: custom.rules ?? [],
        colors: custom.colors ?? {},
      }
    : buildLucentTheme(readEditorTokens(), isDark);
  monaco.editor.defineTheme(LUCENT_THEME, data);
  monaco.editor.setTheme(LUCENT_THEME);
}

/** The mono font from the tokens, resolved to a plain font-family list for Monaco. */
export function monoFontFamily(): string {
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue('--lu-font-mono')
      .trim() || 'monospace'
  );
}

// Monaco measures glyphs on creation; measure again whenever a font finishes loading. The fonts are
// requested when the first text uses them, after this module has run, so `fonts.ready` would be too early.
document.fonts.addEventListener('loadingdone', () => monaco.editor.remeasureFonts());

export { monaco };
