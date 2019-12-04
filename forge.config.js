/* tslint:disable */

const path = require('path')
const fs = require('fs')
const packageJson = require('./package.json')

const { version } = packageJson
const iconDir = path.resolve(__dirname, 'assets', 'icons')

const config = {
  hooks: {
    generateAssets: require('./tools/generateAssets')
  },
  packagerConfig: {
    name: 'Electron Fiddle',
    executableName: 'electron-fiddle',
    asar: true,
    icon: path.resolve(__dirname, 'assets', 'icons', 'fiddle'),
    // TODO: FIXME?
    // ignore: [
    //   /^\/\.vscode\//,
    //   /^\/tools\//
    // ],
    appBundleId: 'com.electron.fiddle',
    appCategoryType: 'public.app-category.developer-tools',
    protocols: [{
      name: 'Electron Fiddle Launch Protocol',
      schemes: ['electron-fiddle']
    }],
    win32metadata: {
      CompanyName: 'Electron Community',
      OriginalFilename: 'Electron Fiddle',
    },
    osxSign: {
      identity: 'Developer ID Application: Felix Rieseberg (LT94ZKYDCJ)',
      'hardened-runtime': true,
      'gatekeeper-assess': false,
      'entitlements': 'static/entitlements.plist',
      'entitlements-inherit': 'static/entitlements.plist',
      'signature-flags': 'library'
    }
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: (arch) => {
        const certificateFile = process.env.CI
          ? path.join(__dirname, 'cert.p12')
          : process.env.WINDOWS_CERTIFICATE_FILE;

        if (!certificateFile || !fs.existsSync(certificateFile)) {
          console.warn(`Warning: Could not find certificate file at ${certificateFile}`)
        }

        return {
          name: 'electron-fiddle',
          authors: 'Electron Community',
          exe: 'electron-fiddle.exe',
          iconUrl: 'https://raw.githubusercontent.com/electron/fiddle/0119f0ce697f5ff7dec4fe51f17620c78cfd488b/assets/icons/fiddle.ico',
          loadingGif: './assets/loading.gif',
          noMsi: true,
          remoteReleases: '',
          setupExe: `electron-fiddle-${version}-${arch}-setup.exe`,
          setupIcon: path.resolve(iconDir, 'fiddle.ico'),
          certificatePassword: process.env.WINDOWS_CERTIFICATE_PASSWORD,
          certificateFile
        }
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin']
    },
    {
      name: '@electron-forge/maker-deb',
      platforms: ['linux'],
      config: {
        icon: {
          scalable: path.resolve(iconDir, 'fiddle.svg')
        }
      }
    },
    {
      name: '@electron-forge/maker-rpm',
      platforms: ['linux']
    }
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'electron',
          name: 'fiddle'
        },
        draft: true,
        prerelease: false
      }
    }
  ]
}

function notarizeMaybe() {
  if (process.platform !== 'darwin') {
    return;
  }

  if (!process.env.CI) {
    console.log(`Not in CI, skipping notarization`);
    return;
  }

  if (!process.env.APPLE_ID || !process.env.APPLE_ID_PASSWORD) {
    console.warn('Should be notarizing, but environment variables APPLE_ID or APPLE_ID_PASSWORD are missing!');
    return;
  }

  config.packagerConfig.osxNotarize = {
    appBundleId: 'com.electron.fiddle',
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_ID_PASSWORD,
    ascProvider: 'LT94ZKYDCJ'
  }
}

notarizeMaybe()

// Finally, export it
module.exports = config
