import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { FuseV1Options, FuseVersion } from '@electron/fuses';
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
// Derived from Forge rather than imported from `@electron/windows-sign`, so the
// type always matches the version Forge itself depends on.
type WindowsSignOptions = NonNullable<
  MakerMSIX['config']['windowsSignOptions']
>;

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
    hashes: ['sha256'] as WindowsSignOptions['hashes'],
    // Certificate selection is done by the dlib, not by signtool's `/a`.
    automaticallySelectCertificate: false,
  };
}

const windowsSignOptions = getWindowsSignOptions();

/**
 * Windows 10 SDK bin directory holding makeappx.exe, makepri.exe and
 * signtool.exe. Because we supply our own AppxManifest, electron-windows-msix
 * derives the SDK version from the manifest's MinVersion and fails unless an
 * SDK of exactly that version is installed, so point it at one explicitly.
 * CI already selects the newest SDK's signtool; locally, fall back to the
 * newest installed SDK that ships makeappx.exe.
 */
function getWindowsKitPath(): string | undefined {
  if (process.platform !== 'win32') {
    return undefined;
  }

  const { WINDOWS_SIGNTOOL_PATH: signToolPath } = process.env;
  if (signToolPath) {
    return path.dirname(signToolPath);
  }

  const kitsBin = path.join(
    process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
    'Windows Kits',
    '10',
    'bin',
  );
  const hostArch =
    process.env.PROCESSOR_ARCHITECTURE === 'ARM64' ? 'arm64' : 'x64';
  if (!fs.existsSync(kitsBin)) {
    return undefined;
  }

  const compareVersions = (a: string, b: string) => {
    const [na, nb] = [a, b].map((v) => v.split('.').map(Number));
    const i = na.findIndex((n, idx) => n !== nb[idx]);
    return i === -1 ? 0 : na[i] - nb[i];
  };
  const newest = fs
    .readdirSync(kitsBin)
    .filter(
      (name) =>
        /^10\.\d+\.\d+\.\d+$/.test(name) &&
        fs.existsSync(path.join(kitsBin, name, hostArch, 'makeappx.exe')),
    )
    .sort(compareVersions)
    .pop();

  return newest ? path.join(kitsBin, newest, hostArch) : undefined;
}

const msixManifestTemplate = path.resolve(
  __dirname,
  'tools/msix/AppxManifest.xml.in',
);
// Tile and Start menu icons referenced by the manifest. The packager's
// bundled defaults are placeholder images, not the Fiddle logo.
const msixAssets = path.resolve(__dirname, 'tools/msix/assets');

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Renders the MSIX AppxManifest for the given architecture and returns its
 * path. The packager's built-in template has no protocol declaration, and an
 * MSIX app can only register `electron-fiddle://` through its manifest, so we
 * ship our own template (see tools/msix/AppxManifest.xml.in).
 */
function renderMsixManifest(arch: string): string {
  const processorArchitecture = { x64: 'x64', arm64: 'arm64', ia32: 'x86' }[
    arch
  ];
  if (!processorArchitecture) {
    throw new Error(`Unsupported MSIX architecture: ${arch}`);
  }

  // MSIX versions are four-part; drop any prerelease suffix like the packager does.
  const msixVersion = /^\d+\.\d+\.\d+$/.test(version)
    ? `${version}.0`
    : version.replace(/[-+].*/, '.0');

  const manifest = fs
    .readFileSync(msixManifestTemplate, 'utf8')
    .replace(/{{Version}}/g, msixVersion)
    .replace(/{{ProcessorArchitecture}}/g, processorArchitecture)
    .replace(/{{Description}}/g, escapeXml(packageJson.description));

  const manifestPath = path.join(
    os.tmpdir(),
    `electron-fiddle-AppxManifest-${arch}.xml`,
  );
  fs.writeFileSync(manifestPath, manifest);
  return manifestPath;
}

/**
 * update.electronjs.org only serves MSIX updates for x64 and arm64 packages,
 * so an ia32 MSIX would never receive updates. Only build the x64 package.
 */
class MakerMSIXx64 extends MakerMSIX {
  async make(options: Parameters<MakerMSIX['make']>[0]) {
    if (options.targetArch !== 'x64') {
      console.log(
        `Skipping MSIX for ${options.targetArch}: only the x64 MSIX is published`,
      );
      return [];
    }
    return super.make(options);
  }
}

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
    new MakerMSIXx64((arch: string) => ({
      appManifest: renderMsixManifest(arch),
      packageAssets: msixAssets,
      windowsKitPath: getWindowsKitPath(),
      manifestVariables: {
        // The manifest is rendered from tools/msix/AppxManifest.xml.in, so
        // the other variables are ignored. The publisher is still used as the
        // subject of the self-signed dev cert that unsigned local builds are
        // signed with; it must match the Publisher in the manifest, which in
        // turn must match the subject of the Azure Trusted Signing
        // certificate exactly, or signtool refuses to sign the package.
        publisher:
          'CN=OpenJS Foundation, O=OpenJS Foundation, L=San Francisco, S=California, C=US',
      },
      windowsSignOptions,
    })),
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
