/* tslint:disable */

const path = require('path');
const package = require('./package.json');

module.exports = {
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
      identity: 'Developer ID Application: Felix Rieseberg (LT94ZKYDCJ)'
    },
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: {
        name: 'electron-fiddle',
        authors: 'Electron Community',
        exe: 'electron-fiddle.exe',
        iconUrl: 'https://raw.githubusercontent.com/electron/fiddle/b5bf652df0ba159ec40a62001dbb298649c3b985/assets/icons/fiddle.ico',
        loadingGif: './assets/loading.gif',
        noMsi: true,
        remoteReleases: '',
        setupExe: `electron-fiddle-${package.version}-setup-${process.arch}.exe`,
        setupIcon: path.resolve(__dirname, 'assets', 'icons', 'fiddle.ico'),
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
