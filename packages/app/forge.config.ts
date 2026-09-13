import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerMSIX } from '@electron-forge/maker-msix';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { PublisherGitHub } from '@electron-forge/publisher-github';
import type { ForgeConfig } from '@electron-forge/shared-types';

import packageJson from './package.json';

// Packaging, signing and release: REQUIREMENTS §12. The app identity here is
// checked against build/identity.json in CI (tools/release-identity.mjs).

const appDir = import.meta.dirname;

// Shipped UI locales (src/i18n/locales/*). Pseudo-locales are generated and never listed.
const shippedLocales = fs
  .readdirSync(path.join(appDir, 'src/i18n/locales'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const iconDir = path.join(appDir, 'assets', 'icons');
const buildDir = path.join(appDir, 'build');
const entitlements = path.join(buildDir, 'entitlements.plist');
const requirements = path.join(buildDir, 'certs', 'requirements.txt');

// deb and rpm take a single icon: the 1024px PNG.
const linuxOptions = {
  bin: 'electron-fiddle',
  categories: ['Development' as const, 'Utility' as const],
  icon: path.join(iconDir, 'fiddle.png'),
  mimeType: ['x-scheme-handler/electron-fiddle'],
};

/**
 * Windows code signing through Azure Trusted Signing.
 *
 * Authentication is not handled here. In CI, `azure/login` performs an OIDC
 * login with the Azure CLI, and the Trusted Signing dlib then picks up that
 * session through `AzureCliCredential`. This function only tells signtool
 * where the dlib lives and which account and certificate profile to use.
 *
 * Returns `undefined` when none of the Azure variables are set, so local and
 * CI builds produce unsigned artifacts. Throws when only some are set.
 */
// Derived from Forge rather than imported from `@electron/windows-sign`, so the
// type always matches the version Forge itself depends on.
type WindowsSignOptions = NonNullable<MakerMSIX['config']['windowsSignOptions']>;

function getWindowsSignOptions(): WindowsSignOptions | undefined {
  const {
    AZURE_CODE_SIGNING_DLIB: dlib,
    AZURE_CODE_SIGNING_ENDPOINT: endpoint,
    AZURE_CODE_SIGNING_ACCOUNT_NAME: accountName,
    AZURE_CODE_SIGNING_CERTIFICATE_PROFILE_NAME: certificateProfileName,
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
    // Passed as an array so paths with spaces survive intact.
    signWithParams: ['/dlib', dlib, '/dmdf', metadataPath],
    timestampServer: 'http://timestamp.acs.microsoft.com',
    // Trusted Signing certificates are SHA-256 only; no SHA-1 dual signing.
    hashes: ['sha256'] as WindowsSignOptions['hashes'],
    // Certificate selection is done by the dlib, not by signtool's `/a`.
    automaticallySelectCertificate: false,
  };
}

type NotarizeOptions = NonNullable<ForgeConfig['packagerConfig']>['osxNotarize'];

/**
 * Notarization runs only on macOS in CI (or with FORCE_NOTARIZATION). It uses
 * an App Store Connect API key: APPLE_API_KEY is the path to the `.p8` file,
 * with APPLE_API_KEY_ID and APPLE_API_ISSUER. An Apple ID (APPLE_ID and
 * APPLE_ID_PASSWORD) is accepted as a fallback.
 */
function getNotarizeOptions(): NotarizeOptions {
  if (process.platform !== 'darwin') return undefined;

  if (!process.env.CI && !process.env.FORCE_NOTARIZATION) {
    console.log('Not in CI, skipping notarization');
    return undefined;
  }

  const {
    APPLE_API_KEY,
    APPLE_API_KEY_ID,
    APPLE_API_ISSUER,
    APPLE_ID,
    APPLE_ID_PASSWORD,
  } = process.env;

  if (APPLE_API_KEY && APPLE_API_KEY_ID && APPLE_API_ISSUER) {
    return {
      appleApiKey: APPLE_API_KEY,
      appleApiKeyId: APPLE_API_KEY_ID,
      appleApiIssuer: APPLE_API_ISSUER,
    };
  }

  if (APPLE_ID && APPLE_ID_PASSWORD) {
    return {
      appleId: APPLE_ID,
      appleIdPassword: APPLE_ID_PASSWORD,
      teamId: 'UY52UFTVTM',
    };
  }

  console.warn(
    'Should be notarizing, but APPLE_API_KEY, APPLE_API_KEY_ID and APPLE_API_ISSUER are missing!',
  );
  return undefined;
}

const windowsSignOptions = getWindowsSignOptions();

/**
 * Native modules can't be bundled, so vite.main.config.mts keeps them external,
 * and Forge's Vite plugin packages only `.vite/`. This copies each one into the
 * app's node_modules, with only the target's napi-rs addon
 * (`index.<platform>-<arch>[-<abi>].node` or `index.<platform>-universal.node`).
 * `asar.unpack` keeps the addons out of the asar. None has dependencies.
 */
const NATIVE_MODULES = ['@electron-internal/extract-zip'];

async function copyNativeModules(buildPath: string, platform: string, arch: string) {
  const isTargetAddon = (file: string) => {
    const tag = /^index\.(.+)\.node$/.exec(path.basename(file))?.[1];
    return (
      tag === `${platform}-universal` ||
      tag === `${platform}-${arch}` ||
      !!tag?.startsWith(`${platform}-${arch}-`)
    );
  };
  const require = createRequire(import.meta.url);
  for (const name of NATIVE_MODULES) {
    await fs.promises.cp(
      path.dirname(require.resolve(name)),
      path.join(buildPath, 'node_modules', name),
      { recursive: true, filter: (file) => !file.endsWith('.node') || isTargetAddon(file) },
    );
  }
}

const config: ForgeConfig = {
  hooks: {
    // `yarn generate`: offline and idempotent. The Electron release list and
    // the contributors list are committed snapshots, so nothing is fetched.
    generateAssets: async () => {
      execFileSync(process.execPath, [path.join(appDir, 'tools', 'generate.mjs')], {
        stdio: 'inherit',
      });
    },
    packageAfterCopy: async (_config, buildPath, _electronVersion, platform, arch) => {
      await copyNativeModules(buildPath, platform, arch);
    },
  },
  packagerConfig: {
    name: 'Electron Fiddle',
    executableName: 'electron-fiddle',
    asar: { unpack: '**/*.node' },
    // Bundled content main reads at runtime: Show Me, the quick-start template,
    // releases.json, contributors.json and import-local-storage.html. Packaged
    // builds find it at `<resources>/static`, dev runs at `<app path>/static`
    // (`staticDir()` in src/main/documents/service.ts).
    extraResource: [path.join(appDir, 'static')],
    icon: path.join(iconDir, 'fiddle'),
    appBundleId: 'com.electron.fiddle',
    extendInfo: { CFBundleLocalizations: shippedLocales },
    appCategoryType: 'public.app-category.developer-tools',
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
    protocols: [
      { name: 'Electron Fiddle Launch Protocol', schemes: ['electron-fiddle'] },
    ],
    win32metadata: {
      CompanyName: 'Electron Community',
      OriginalFilename: 'Electron Fiddle',
    },
    // Hardened runtime. Without the identity in the keychain (local and PR
    // builds), packager warns and leaves the app ad-hoc signed.
    osxSign: {
      identity: 'Developer ID Application: OpenJS Foundation, Inc. (UY52UFTVTM)',
      optionsForFile: (filePath) =>
        ['(Plugin).app', '(GPU).app', '(Renderer).app'].some((helper) =>
          filePath.includes(helper),
        )
          ? { requirements }
          : { entitlements, requirements },
    },
    osxNotarize: getNotarizeOptions(),
  },
  makers: [
    new MakerSquirrel((arch: string) => ({
      name: 'electron-fiddle',
      authors: 'Electron Community',
      exe: 'electron-fiddle.exe',
      iconUrl:
        'https://raw.githubusercontent.com/electron/fiddle/0119f0ce697f5ff7dec4fe51f17620c78cfd488b/assets/icons/fiddle.ico',
      loadingGif: path.join(appDir, 'assets', 'loading.gif'),
      noMsi: true,
      setupExe: `electron-fiddle-${packageJson.version}-win32-${arch}-setup.exe`,
      setupIcon: path.join(iconDir, 'fiddle.ico'),
      windowsSign: windowsSignOptions,
    })),
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
    new MakerZIP({}, ['darwin']),
    new MakerDeb({ options: linuxOptions }),
    new MakerRpm({ options: linuxOptions }),
    {
      name: '@reforged/maker-appimage',
      platforms: ['linux'],
      // The AppImage maker takes an icon set: the 1024px PNG and the SVG.
      config: {
        options: {
          ...linuxOptions,
          icon: {
            '1024x1024': path.join(iconDir, 'fiddle.png'),
            scalable: path.join(iconDir, 'fiddle.svg'),
          },
        },
      },
    },
  ],
  publishers: [
    new PublisherGitHub({
      repository: { owner: 'electron', name: 'fiddle' },
      draft: true,
      prerelease: false,
      generateReleaseNotes: true,
    }),
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
