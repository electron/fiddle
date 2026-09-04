import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { FuseV1Options, FuseVersion } from '@electron/fuses';
import type { SignToolOptions } from '@electron/windows-sign';
import { MakerMSIX } from '@electron-forge/maker-msix';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import type { ForgeConfig } from '@electron-forge/shared-types';

import packageJson from './package.json';
import { maybeFetchContributors } from './tools/contributors';
import { populateReleases } from './tools/fetch-releases';
import { mainConfig } from './tools/webpack/webpack.main.config';
import { rendererConfig } from './tools/webpack/webpack.renderer.config';

const { version } = packageJson;
const iconDir = path.resolve(__dirname, 'assets', 'icons');
const root = process.cwd();

const commonLinuxConfig = {
  categories: ['Development', 'Utility'],
  icon: {
    '1024x1024': path.resolve(iconDir, 'fiddle.png'),
    scalable: path.resolve(iconDir, 'fiddle.svg'),
  },
  mimeType: ['x-scheme-handler/electron-fiddle'],
};

const requirements = path.resolve(__dirname, 'tools/certs/requirements.txt');

/**
 * Windows code signing through Azure Trusted Signing.
 *
 * Authentication is not handled here. In CI, `azure/login` performs an OIDC
 * login with the Azure CLI, and the Trusted Signing dlib then picks up that
 * session through `AzureCliCredential`. This function only tells signtool
 * where the dlib lives and which account and certificate profile to use.
 *
 * Returns `undefined` when none of the Azure variables are set so that local
 * and CI builds produce unsigned artifacts, as before.
 */
function getWindowsSignOptions(): SignToolOptions | undefined {
  const {
    AZURE_CODE_SIGNING_DLIB: dlib,
    AZURE_CODE_SIGNING_ENDPOINT: endpoint,
    AZURE_CODE_SIGNING_ACCOUNT_NAME: accountName,
    AZURE_CODE_SIGNING_CERTIFICATE_PROFILE_NAME: certificateProfileName,
    WINDOWS_SIGNTOOL_PATH: signToolPath,
  } = process.env;

  if (!dlib && !endpoint && !accountName && !certificateProfileName) {
    return undefined;
  }

  if (!dlib || !endpoint || !accountName || !certificateProfileName) {
    throw new Error(
      'Azure Trusted Signing is only partially configured. Set all of ' +
        'AZURE_CODE_SIGNING_DLIB, AZURE_CODE_SIGNING_ENDPOINT, ' +
        'AZURE_CODE_SIGNING_ACCOUNT_NAME and ' +
        'AZURE_CODE_SIGNING_CERTIFICATE_PROFILE_NAME, or none of them.',
    );
  }

  if (!signToolPath) {
    // The signtool.exe vendored by @electron/windows-sign predates /dlib
    // support. Trusted Signing needs one from Windows SDK 10.0.22621.755+.
    throw new Error(
      'Azure Trusted Signing needs a recent signtool.exe. Set ' +
        'WINDOWS_SIGNTOOL_PATH to one from Windows SDK 10.0.22621.755 or later.',
    );
  }

  const metadataPath = path.join(
    os.tmpdir(),
    'electron-fiddle-trusted-signing-metadata.json',
  );

  fs.writeFileSync(
    metadataPath,
    JSON.stringify(
      {
        Endpoint: endpoint,
        CodeSigningAccountName: accountName,
        CertificateProfileName: certificateProfileName,
        // `azure/login` leaves us with an Azure CLI session. Skip the other
        // credential providers DefaultAzureCredential would otherwise probe,
        // some of which (managed identity) time out slowly on GitHub runners.
        ExcludeCredentials: [
          'ManagedIdentityCredential',
          'WorkloadIdentityCredential',
          'SharedTokenCacheCredential',
          'VisualStudioCredential',
          'VisualStudioCodeCredential',
          'AzurePowerShellCredential',
          'AzureDeveloperCliCredential',
          'InteractiveBrowserCredential',
        ],
      },
      null,
      2,
    ),
  );

  return {
    signToolPath,
    // Passed as an array so paths with spaces survive intact.
    signWithParams: ['/dlib', dlib, '/dmdf', metadataPath],
    timestampServer: 'http://timestamp.acs.microsoft.com',
    // Trusted Signing certificates are SHA-256 only; no SHA-1 dual signing.
    hashes: ['sha256'] as SignToolOptions['hashes'],
    // Certificate selection is done by the dlib, not by signtool's `/a`.
    automaticallySelectCertificate: false,
  };
}

const windowsSignOptions = getWindowsSignOptions();

const config: ForgeConfig = {
  hooks: {
    generateAssets: async () => {
      await Promise.all([populateReleases(), maybeFetchContributors(true)]);
    },
  },
  plugins: [
    {
      name: '@electron-forge/plugin-webpack',
      config: {
        devContentSecurityPolicy:
          "default-src 'none'; img-src 'self' https: data:; media-src 'none'; child-src 'self' isolated-actions:; object-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https:; font-src 'self' https:;",
        devServer: {
          // Disallow browser from opening/reloading with HMR in development mode.
          open: false,
          liveReload: false,
          hot: 'only',
        },
        mainConfig: mainConfig,
        renderer: {
          config: rendererConfig,
          entryPoints: [
            {
              html: path.join(root, './static/index.html'),
              js: path.join(root, './src/renderer/main.tsx'),
              name: 'main_window',
              preload: {
                js: path.join(root, 'src/preload/preload.ts'),
              },
            },
            {
              html: path.join(root, './static/isolated-run-button.html'),
              js: path.join(root, './src/isolated-run-button.ts'),
              name: 'isolated_run_button',
            },
          ],
        },
      },
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    }),
  ],
  packagerConfig: {
    name: 'Electron Fiddle',
    executableName: 'electron-fiddle',
    // Unpack the embedded sfw script so system Node can spawn it — it can't
    // be executed from inside an asar archive. The `.webpack` segment must
    // be explicit because minimatch globstar skips dot-prefixed directories.
    asar: { unpack: '**/.webpack/sfw/**' },
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
      AudioCapture:
        'Access is needed by certain built-in fiddles in addition to any custom fiddles that may capture Audio',
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
      identity:
        'Developer ID Application: OpenJS Foundation, Inc. (UY52UFTVTM)',
      optionsForFile: (filePath) =>
        ['(Plugin).app', '(GPU).app', '(Renderer).app'].some((helper) =>
          filePath.includes(helper),
        )
          ? { requirements }
          : {
              entitlements: 'static/entitlements.plist',
              requirements,
            },
    },
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: (arch: string) => ({
        name: 'electron-fiddle',
        authors: 'Electron Community',
        exe: 'electron-fiddle.exe',
        iconUrl:
          'https://raw.githubusercontent.com/electron/fiddle/0119f0ce697f5ff7dec4fe51f17620c78cfd488b/assets/icons/fiddle.ico',
        loadingGif: './assets/loading.gif',
        noMsi: true,
        setupExe: `electron-fiddle-${version}-win32-${arch}-setup.exe`,
        setupIcon: path.resolve(iconDir, 'fiddle.ico'),
        windowsSign: windowsSignOptions,
      }),
    },
    new MakerMSIX({
      manifestVariables: {
        // Must match the subject of the Azure Trusted Signing certificate
        // exactly, or signtool refuses to sign the package.
        publisher:
          'CN=OpenJS Foundation, O=OpenJS Foundation, L=San Francisco, S=California, C=US',
        publisherDisplayName: 'OpenJS Foundation',
        packageIdentity: 'ElectronCommunity.ElectronFiddle',
        appExecutable: 'electron-fiddle.exe',
        packageDisplayName: 'Electron Fiddle',
        appDisplayName: 'Electron Fiddle',
        packageDescription: packageJson.description,
      },
      windowsSignOptions,
    }),
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
      config: {},
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
    {
      name: '@reforged/maker-appimage',
      platforms: ['linux'],
      config: {
        options: commonLinuxConfig,
      },
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
        generateReleaseNotes: true,
      },
    },
  ],
};

function notarizeMaybe() {
  if (process.platform !== 'darwin') {
    return;
  }

  if (!process.env.CI && !process.env.FORCE_NOTARIZATION) {
    // Not in CI, skipping notarization
    console.log('Not in CI, skipping notarization');
    return;
  }

  if (!process.env.APPLE_ID || !process.env.APPLE_ID_PASSWORD) {
    console.warn(
      'Should be notarizing, but environment variables APPLE_ID or APPLE_ID_PASSWORD are missing!',
    );
    return;
  }

  config.packagerConfig!.osxNotarize = {
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_ID_PASSWORD,
    teamId: 'UY52UFTVTM',
  };
}

notarizeMaybe();

// Finally, export it
export default config;
