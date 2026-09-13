import path from 'node:path';

import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { VitePlugin } from '@electron-forge/plugin-vite';
import type { ForgeConfig } from '@electron-forge/shared-types';

import packageJson from './package.json';

const iconDir = path.join(import.meta.dirname, 'assets', 'icons');

const linuxOptions = {
  bin: 'electron-fiddle',
  categories: ['Development' as const, 'Utility' as const],
  icon: path.join(iconDir, 'fiddle.png'),
  mimeType: ['x-scheme-handler/electron-fiddle'],
};

// Signing, notarization, MSIX, AppImage and publishing arrive with the
// packaging milestone (REQUIREMENTS §12).
const config: ForgeConfig = {
  packagerConfig: {
    name: 'Electron Fiddle',
    executableName: 'electron-fiddle',
    asar: true,
    icon: path.join(iconDir, 'fiddle'),
    appBundleId: 'com.electron.fiddle',
    appCategoryType: 'public.app-category.developer-tools',
    protocols: [
      { name: 'Electron Fiddle Launch Protocol', schemes: ['electron-fiddle'] },
    ],
    win32metadata: {
      CompanyName: 'Electron Community',
      OriginalFilename: 'Electron Fiddle',
    },
  },
  makers: [
    new MakerSquirrel((arch: string) => ({
      name: 'electron-fiddle',
      authors: 'Electron Community',
      exe: 'electron-fiddle.exe',
      noMsi: true,
      loadingGif: path.join(import.meta.dirname, 'assets', 'loading.gif'),
      setupExe: `electron-fiddle-${packageJson.version}-win32-${arch}-setup.exe`,
      setupIcon: path.join(iconDir, 'fiddle.ico'),
    })),
    new MakerZIP({}, ['darwin']),
    new MakerDeb({ options: linuxOptions }),
    new MakerRpm({ options: linuxOptions }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        { entry: 'src/main/index.ts', config: 'vite.main.config.mts', target: 'main' },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.mts',
          target: 'preload',
        },
      ],
      renderer: [{ name: 'main_window', config: 'vite.renderer.config.mts' }],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.EnableCookieEncryption]: true,
    }),
  ],
};

export default config;
