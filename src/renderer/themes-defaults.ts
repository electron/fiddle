import * as MonacoType from 'monaco-editor';

export interface FiddleTheme {
  name?: string;
  isDark?: boolean;
  editor: Partial<MonacoType.editor.IStandaloneThemeData>;
  common: {
    'fonts-common': string;
    'foreground-1': string;
    'foreground-2': string;
    'foreground-3': string;
    'background-4': string;
    'background-3': string;
    'background-2': string;
    'background-1': string;
    'border-color-2': string;
    'border-color-1': string;
    border: string;
    'button-text-color': string;
    'text-color-1': string;
    'text-color-2': string;
    'text-color-3': string;
    'error-color': string;
  };
}

export interface LoadedFiddleTheme extends FiddleTheme {
  name: string;
  file: string;
  css?: string;
}

/**
 * Fiddle's default dark theme.
 */
export const defaultDark: LoadedFiddleTheme = {
  name: 'Fiddle (Dark)',
  file: 'defaultDark',
  isDark: true,
  common: {
    'foreground-1': '#9feafa',
    'foreground-2': '#8ac7d6',
    'foreground-3': '#608291',
    'background-4': '#21232d',
    'background-3': '#2c2e3b',
    'background-2': '#1d2427',
    'background-1': '#2f3241',
    'border-color-2': '#1e2527',
    'border-color-1': '#5c5f71',
    border: '1px solid var(--border-color-1)',
    'button-text-color': '#000',
    'text-color-1': '#ffffff',
    'text-color-2': '#1e2527',
    'text-color-3': '#dcdcdc',
    'error-color': '#df3434',
    // tslint:disable-next-line:max-line-length
    'fonts-common': `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"`
  },
  editor: {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#2f3241'
    }
  }
};

export const defaultLight: LoadedFiddleTheme = {
  name: 'Fiddle (Light)',
  file: 'defaultLight',
  isDark: false,
  common: {
    'foreground-1': '#9feafa',
    'foreground-2': '#256e80',
    'foreground-3': '#608291',
    'background-4': '#fbfbfb',
    'background-3': '#fbfbfb',
    'background-2': '#d6dde0',
    'background-1': '#f5f5f5',
    'border-color-2': '#1e2527',
    'border-color-1': '#d8dae2',
    'button-text-color': '#fff',
    border: '1px solid var(--border-color-1)',
    'text-color-1': '#000000',
    'text-color-2': '#1e2527',
    'text-color-3': '#0e0e0e',
    'error-color': '#df3434',
    // tslint:disable-next-line:max-line-length
    'fonts-common': `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"`
  },
  editor: {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {}
  }
};

export enum DefaultThemes {
  DARK = 'defaultDark',
  LIGHT = 'defaultLight'
}
