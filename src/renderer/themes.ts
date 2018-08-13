import * as MonacoType from 'monaco-editor';

export interface FiddleTheme {
  editor: Partial<MonacoType.editor.IStandaloneThemeData>;
  fonts: {
    common: string;
  };
  colors: {
    'foreground-brighter': string;
    'foreground-bright': string;
    'foreground-tuned': string;
    'background-3': string;
    'background-2': string;
    'background-1': string;
    'border-color-dark': string;
    'border-color': string;
    border: string;
    'text-color': string;
    'text-color-dark': string;
    'text-color-bright': string;
    'error-color': string;
  };
  css: string;
}

/**
 * The Monaco editor theme used by Electron Fiddle.
 */
export const defaultDark = {
  common: {
    'foreground-brighter': '#9feafa',
    'foreground-bright': '#8ac7d6',
    'foreground-tuned': '#608291',
    'background-3': '#2c2e3b',
    'background-2': '#1d2427',
    'background-1': '#2f3241',
    'border-color-dark': '#1e2527',
    'border-color': '#5c5f71',
    border: '1px solid var(--border-color)',
    'text-color': '#d4d4d4',
    'text-color-dark': '#1e2527',
    'text-color-bright': '#dcdcdc',
    'error-color': '#df3434',
      // tslint:disable-next-line:max-line-length
    'fonts-common': `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";`
  },
  editor: {
    base: 'vs-dark',
    inherit: true,
    rules: [{ background: '2f3241' }],
    colors: {
      'editor.background': '#2f3241'
    }
  }
};

export async function getTheme(): Promise<FiddleTheme> {
  const theme = defaultDark;
  let cssContent = '';

  Object.keys(theme.common).forEach((key) => {
    cssContent += `  --${key}: ${theme.common[key]};\n`;
  });

  return {
    ...theme,
    css: `html, body {\n${cssContent}\n}`
  } as any;
}
