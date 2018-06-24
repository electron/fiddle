/* tslint:disable */

const path = require('path');

module.exports = {
  hooks: {
    generateAssets: require('./tools/generateAssets')
  },
  packagerConfig: {
    name: 'Electron Fiddle',
    executableName: 'electron-fiddle',
    asar: true,
    icon: path.resolve(__dirname, 'static', 'icons', 'electron'),
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
      CompanyName: 'Electron',
      OriginalFilename: 'Electron Fiddle',
    },
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: {
        name: 'electron_fiddle',
        authors: 'Electron Community',
        exe: 'electron-fiddle.exe',
        iconUrl: 'https://github.com/electron/electron/blob/fe0f203/atom/browser/resources/win/atom.ico?raw=true',
        // loadingGif: '// TODO',
        noMsi: true,
        // Enable when we have our first release
        // remoteReleases: ''
        setupExe: 'Electron Fiddle Setup.exe',
        setupIcon: path.resolve(__dirname, 'static', 'icons', 'electron.ico'),
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin']
    },
    {
      name: '@electron-forge/maker-deb',
      platforms: ['linux']
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
        prerelease: true
      }
    }
  ]
};
