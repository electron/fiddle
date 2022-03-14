const sources = {
  DEFAULT: {
    electronMirror: 'https://github.com/electron/electron/releases/download/',
    electronNightlyMirror:
      'https://github.com/electron/nightlies/releases/download/',
  },
  CHINA: {
    electronMirror: 'https://npmmirror.com/mirrors/electron/',
    electronNightlyMirror: 'https://npmmirror.com/mirrors/electron-nightly/',
  },
  CUSTOM: {
    electronMirror: '',
    electronNightlyMirror: '',
  },
};

export const ELECTRON_MIRROR = {
  sourceType: 'DEFAULT' as keyof typeof sources,
  sources,
};

export type Sources = keyof typeof sources;
export type Mirrors = {
  electronMirror: string;
  electronNightlyMirror: string;
};
