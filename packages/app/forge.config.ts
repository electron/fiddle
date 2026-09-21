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
import { extractsWithoutAddon, isTargetAddon } from './tools/native-addons';

// The app identity here is checked against build/identity.json in CI
// (tools/release-identity.mjs).

const appDir = import.meta.dirname;

// Pseudo-locales are generated, so only the real locale folders count.
const shippedLocales = fs
  .readdirSync(path.join(appDir, 'src/i18n/locales'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
// macOS names Chinese by script, not region.
const macScripts: Record<string, string> = { 'zh-CN': 'zh-Hans', 'zh-TW': 'zh-Hant' };
const macLocales = shippedLocales.map((locale) => macScripts[locale] ?? locale);
const iconDir = path.join(appDir, 'assets', 'icons');
const buildDir = path.join(appDir, 'build');
const entitlements = path.join(buildDir, 'entitlements.plist');
const requirements = path.join(buildDir, 'certs', 'requirements.txt');
const disclaimDir = path.join(appDir, 'native', 'disclaim');

// deb and rpm take a single icon: the 1024px PNG.
const linuxOptions = {
  bin: 'electron-fiddle',
  categories: ['Development' as const, 'Utility' as const],
  icon: path.join(iconDir, 'fiddle.png'),
  mimeType: ['x-scheme-handler/electron-fiddle'],
};

// Derived from Forge so the type matches the version Forge depends on.
type WindowsSignOptions = NonNullable<MakerMSIX['config']['windowsSignOptions']>;

/**
 * Azure Trusted Signing. Authentication happens outside: the dlib picks up
 * the Azure CLI session that `azure/login` leaves in CI. Returns `undefined`
 * (an unsigned build) when no Azure variable is set, and throws when only some
 * are.
 */
function getWindowsSignOptions(): WindowsSignOptions | undefined {
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
        // Skip the credential providers DefaultAzureCredential would probe
        // besides the Azure CLI; managed identity times out slowly on runners.
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
    hashes: ['sha256'] as WindowsSignOptions['hashes'],
    // The dlib selects the certificate, not signtool's `/a`.
    automaticallySelectCertificate: false,
  };
}

type NotarizeOptions = NonNullable<ForgeConfig['packagerConfig']>['osxNotarize'];

/** Notarizes on macOS in CI (or with FORCE_NOTARIZATION), with an Apple ID. */
function getNotarizeOptions(): NotarizeOptions {
  if (process.platform !== 'darwin') return undefined;

  if (!process.env.CI && !process.env.FORCE_NOTARIZATION) {
    console.log('Not in CI, skipping notarization');
    return undefined;
  }

  const { APPLE_ID, APPLE_ID_PASSWORD } = process.env;

  if (APPLE_ID && APPLE_ID_PASSWORD) {
    return {
      appleId: APPLE_ID,
      appleIdPassword: APPLE_ID_PASSWORD,
      teamId: 'UY52UFTVTM',
    };
  }

  console.warn('Should be notarizing, but APPLE_ID and APPLE_ID_PASSWORD are not set!');
  return undefined;
}

const windowsSignOptions = getWindowsSignOptions();

// Native modules stay external in the main bundle and Forge's Vite plugin packages
// only `.vite/`, so each is copied in with just the target's addon. A target with no
// addon fails the build unless core extracts without one (`extractsWithoutAddon`).
const NATIVE_MODULES = ['@electron-internal/extract-zip'];

async function copyNativeModules(buildPath: string, platform: string, arch: string) {
  const require = createRequire(import.meta.url);
  for (const name of NATIVE_MODULES) {
    const destination = path.join(buildPath, 'node_modules', name);
    await fs.promises.cp(path.dirname(require.resolve(name)), destination, {
      recursive: true,
      filter: (file) => !file.endsWith('.node') || isTargetAddon(file, platform, arch),
    });
    const hasAddon = fs.readdirSync(destination).some((file) => file.endsWith('.node'));
    if (!hasAddon && !extractsWithoutAddon(platform, arch)) {
      throw new Error(`${name} has no addon for ${platform}-${arch}`);
    }
  }
}

// Module installs spawn `node sfw.mjs npm …` from a per-user copy of
// `<resources>/sfw/` (src/main/platform/sfw.ts), so the script and the
// package.json it reads ship outside the asar. `resolve` throws when the package
// is missing, so packaging fails rather than shipping without Socket Firewall.
function stageSfw(): string {
  const root = path.dirname(createRequire(import.meta.url).resolve('sfw/package.json'));
  const staged = path.join(appDir, 'out', '.sfw', 'sfw');
  fs.rmSync(staged, { recursive: true, force: true });
  for (const name of ['package.json', path.join('dist', 'sfw.mjs')]) {
    fs.mkdirSync(path.dirname(path.join(staged, name)), { recursive: true });
    fs.copyFileSync(path.join(root, name), path.join(staged, name));
  }
  return staged;
}

// releases.json and contributors.json are compiled into main, so the copy of
// `static/` in `<resources>` leaves them out.
function stageStatic(): string {
  const source = path.join(appDir, 'static');
  const staged = path.join(appDir, 'out', '.static');
  fs.rmSync(staged, { recursive: true, force: true });
  fs.cpSync(source, path.join(staged, 'static'), {
    recursive: true,
    filter: (file) =>
      !['releases.json', 'contributors.json'].includes(path.relative(source, file)),
  });
  return path.join(staged, 'static');
}

// The macOS helper that starts fiddles without the app's privacy grants ships at
// `<resources>/fiddle-disclaim`, on darwin targets only.
const DISCLAIM_HELPER = 'fiddle-disclaim';

const config: ForgeConfig = {
  hooks: {
    // `yarn generate`: offline and idempotent. The Electron release list and
    // the contributors list are committed snapshots, so nothing is fetched.
    generateAssets: async () => {
      execFileSync(process.execPath, [path.join(appDir, 'tools', 'generate.mjs')], {
        stdio: 'inherit',
      });
    },
    prePackage: async (forgeConfig, platform) => {
      // `static/` holds Show Me, the quick-start template and
      // import-local-storage.html (`staticDir()` in src/main/documents/service.ts).
      // fiddle.png is the Linux About panel icon, which GTK reads from disk.
      const extraResource = [stageStatic(), path.join(iconDir, 'fiddle.png'), stageSfw()];
      if (platform === 'darwin') {
        if (process.platform !== 'darwin') {
          throw new Error('The macOS privacy helper can only be built on macOS.');
        }
        execFileSync('sh', [path.join(disclaimDir, 'build.sh')], { stdio: 'inherit' });
        extraResource.push(path.join(disclaimDir, 'build', DISCLAIM_HELPER));
      }
      (forgeConfig.packagerConfig ??= {}).extraResource = extraResource;
    },
    // Source maps are about three quarters of the asar and nothing at runtime
    // reads them. The release workflow uploads them from `.vite/`.
    packageAfterCopy: async (_config, buildPath, _electronVersion, platform, arch) => {
      await copyNativeModules(buildPath, platform, arch);
      const built = path.join(buildPath, '.vite');
      for (const file of await fs.promises.readdir(built, { recursive: true })) {
        if (file.endsWith('.map')) await fs.promises.rm(path.join(built, file));
      }
    },
  },
  packagerConfig: {
    name: 'Electron Fiddle',
    executableName: 'electron-fiddle',
    asar: { unpack: '**/*.node' },
    icon: path.join(iconDir, 'fiddle'),
    appBundleId: 'com.electron.fiddle',
    extendInfo: { CFBundleLocalizations: macLocales },
    appCategoryType: 'public.app-category.developer-tools',
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
      optionsForFile: (filePath) => {
        // The privacy helper only execs Electron: it needs no entitlements.
        if (path.basename(filePath) === DISCLAIM_HELPER) {
          return { entitlements: [], requirements };
        }
        return ['(Plugin).app', '(GPU).app', '(Renderer).app'].some((helper) =>
          filePath.includes(helper),
        )
          ? { requirements }
          : { entitlements, requirements };
      },
    },
    osxNotarize: getNotarizeOptions(),
  },
  makers: [
    new MakerSquirrel((arch: string) => ({
      name: 'electron-fiddle',
      authors: 'Electron Community',
      exe: 'electron-fiddle.exe',
      // Control Panel's Programs list fetches this, so it must be a public URL.
      iconUrl:
        'https://raw.githubusercontent.com/electron/fiddle/fiddle-2027/packages/app/assets/icons/fiddle.ico',
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
      // Publishing an alpha as a full release would make it the update target.
      prerelease: packageJson.version.includes('-'),
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
