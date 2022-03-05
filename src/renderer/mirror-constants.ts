import { Mirrors } from '../interfaces';

export const ELECTRON_MIRRORS: {
  DEFAULT: Mirrors;
  CHINA: Mirrors;
} = {
  DEFAULT: {
    electronMirror: 'https://github.com/electron/electron/releases/download/',
    electronNightlyMirror:
      'https://github.com/electron/nightlies/releases/download/',
  },
  CHINA: {
    electronMirror: 'https://npmmirror.com/mirrors/electron/',
    electronNightlyMirror: 'https://npmmirror.com/mirrors/electron-nightly/',
  },
};
