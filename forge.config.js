const fs = require('fs');
const path = require('path');

const packageJson = require('./package.json');
const { maybeFetchContributors } = require('./tools/contributors');

const { version } = packageJson;
const iconDir = path.resolve(__dirname, 'assets', 'icons');
const root = process.cwd();

if (process.env['WINDOWS_CODESIGN_FILE']) {
  const certPath = path.join(__dirname, 'win-certificate.pfx');
  const certExists = fs.existsSync(certPath);

  if (certExists) {
    process.env['WINDOWS_CODESIGN_FILE'] = certPath;
  }
}

const commonLinuxConfig = {
  icon: {
    scalable: path.resolve(iconDir, 'fiddle.svg'),
  },
  mimeType: ['x-scheme-handler/electron-fiddle'],
};

const config = {
  hooks: {
    generateAssets: async () => {
      await maybeFetchContributors();
    },
  },
  plugins: [
    [
      '@electron-forge/plugin-webpack',
      {
        devContentSecurityPolicy:
          "default-src 'none'; img-src 'self' https: data:; media-src 'none'; child-src 'self'; object-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https:; font-src 'self' https:;",
        devServer: {
          // Disallow browser from opening/reloading with HMR in development mode.
          open: false,
          liveReload: false,
          hot: 'only',
        },
        mainConfig: path.join(root, 'tools/webpack/webpack.main.config.js'),
        renderer: {
          nodeIntegration: true,
          config: path.join(root, 'tools/webpack/webpack.renderer.config.js'),
          entryPoints: [
            {
              html: path.join(root, './static/index.html'),
              js: path.join(root, './src/renderer/main.tsx'),
              name: 'main_window',
              preload: {
                js: path.join(root, 'src/preload/preload.ts'),
              },
            },
          ],
        },
      },
    ],
  ],
  packagerConfig: {
    name: 'Electron Fiddle',
    executableName: 'electron-fiddle',
    asar: true,
    icon: path.resolve(__dirname, 'assets', 'icons', 'fiddle'),
    appBundleId: 'com.electron.fiddle',
    usageDescription: {
      Camera:
        'Access is needed by certain built-in fiddles in addition to any custom fiddles that use the Camera',
      Microphone:
        'Access is needed by certain built-in fiddles in addition to any custom fiddles that use the Microphone',
      Calendars:
        'Access is needed by certain built-in fiddles in addition to any custom fiddles that may access Calendars',
      Contacts:
        'Access is needed by certain built-in fiddles in addition to any custom fiddles that may access Contacts',
      Reminders:
        'Access is needed by certain built-in fiddles in addition to any custom fiddles that may access Reminders',
    },
    appCategoryType: 'public.app-category.developer-tools',
    protocols: [
      {
        name: 'Electron Fiddle Launch Protocol',
        schemes: ['electron-fiddle'],
      },
    ],
    win32metadata: {
      CompanyName: 'Electron Community',
      OriginalFilename: 'Electron Fiddle',
    },
    osxSign: {
      identity: 'Developer ID Application: Felix Rieseberg (LT94ZKYDCJ)',
      hardenedRuntime: true,
      'gatekeeper-assess': false,
      entitlements: 'static/entitlements.plist',
      'entitlements-inherit': 'static/entitlements.plist',
      'signature-flags': 'library',
    },
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: (arch) => ({
        name: 'electron-fiddle',
        authors: 'Electron Community',
        exe: 'electron-fiddle.exe',
        iconUrl:
          'https://raw.githubusercontent.com/electron/fiddle/0119f0ce697f5ff7dec4fe51f17620c78cfd488b/assets/icons/fiddle.ico',
        loadingGif: './assets/loading.gif',
        noMsi: true,
        setupExe: `electron-fiddle-${version}-win32-${arch}-setup.exe`,
        setupIcon: path.resolve(iconDir, 'fiddle.ico'),
        certificateFile: process.env['WINDOWS_CODESIGN_FILE'],
        certificatePassword: process.env['WINDOWS_CODESIGN_PASSWORD'],
      }),
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      platforms: ['linux'],
      config: commonLinuxConfig,
    },
    {
      name: '@electron-forge/maker-rpm',
      platforms: ['linux'],
      config: commonLinuxConfig,
    },
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'electron',
          name: 'fiddle',
        },
        draft: true,
        prerelease: false,
      },
    },
  ],
};

function notarizeMaybe() {
  if (process.platform !== 'darwin') {
    return;
  }

  if (!process.env.CI) {
    console.log(`Not in CI, skipping notarization`);
    return;
  }

  if (!process.env.APPLE_ID || !process.env.APPLE_ID_PASSWORD) {
    console.warn(
      'Should be notarizing, but environment variables APPLE_ID or APPLE_ID_PASSWORD are missing!',
    );
    return;
  }

  config.packagerConfig.osxNotarize = {
    appBundleId: 'com.electron.fiddle',
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_ID_PASSWORD,
    ascProvider: 'LT94ZKYDCJ',
  };
}

notarizeMaybe();

// Finally, export it
module.exports = config;
