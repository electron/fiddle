import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_MANIFEST_FILENAME = 'FiddleAppxManifest.xml';
const TARGET_MANIFEST_FILENAME = 'AppxManifest.xml';
const SPARSE_PACKAGE_NAME = 'Electron.Fiddle.MSIX';

/**
 * Map Node.js os.arch() to Windows AppxManifest ProcessorArchitecture values.
 */
function getAppxArchitecture(): string {
  const arch = os.arch();
  switch (arch) {
    case 'x64':
      return 'x64';
    case 'ia32':
      return 'x86';
    case 'arm64':
      return 'arm64';
    default:
      return 'x64';
  }
}

/** A PowerShell single-quoted string. PowerShell also treats curly quotes as quotes. */
function psQuote(value: string): string {
  return `'${value.replace(/['\u2018\u2019\u201A\u201B]/g, (quote) => quote + quote)}'`;
}

function xmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function executePowerShell(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ps = spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      command,
    ]);

    let stdout = '';
    let stderr = '';

    ps.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    ps.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    ps.on('close', (code: number) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`PowerShell command failed: ${stderr || stdout}`));
      }
    });

    ps.on('error', (err: Error) => {
      reject(err);
    });
  });
}

async function unregisterSparsePackage(): Promise<void> {
  try {
    const result = await executePowerShell(
      `Get-AppxPackage -Name "${SPARSE_PACKAGE_NAME}" | Select-Object -ExpandProperty PackageFullName`,
    );

    const packages = result
      .trim()
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    for (const pkg of packages) {
      console.log(`Unregistering sparse package: ${pkg}`);
      await executePowerShell(`Remove-AppxPackage -Package ${psQuote(pkg)}`);
      console.log(`Successfully unregistered: ${pkg}`);
    }
  } catch {
    console.log('No existing sparse package to unregister');
  }
}

/**
 * Registers a sparse package for the Electron install in `electronDir`, which
 * gives it a Windows app identity like an MSIX package. Does nothing off
 * Windows. Failures are logged, not thrown.
 */
export async function registerElectronIdentity(
  version: string,
  electronDir: string,
): Promise<void> {
  if (process.platform !== 'win32') {
    return;
  }

  const electronExe = path.join(electronDir, 'electron.exe');

  if (!fs.existsSync(electronExe)) {
    console.log(`Electron not found at ${electronDir}, skipping identity registration`);
    return;
  }

  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const sourcePath = path.join(__dirname, '..', 'static', SOURCE_MANIFEST_FILENAME);
    const targetPath = path.join(electronDir, TARGET_MANIFEST_FILENAME);

    let manifest = fs.readFileSync(sourcePath, 'utf8');
    const displayName = `Electron (${version}) MSIX`;
    const architecture = getAppxArchitecture();
    manifest = manifest.replace(/\$DISPLAY_NAME\$/g, () => xmlEscape(displayName));
    manifest = manifest.replace(/\$ARCHITECTURE\$/g, () => architecture);

    console.log(`Writing manifest with version ${version} to ${targetPath}`);
    fs.writeFileSync(targetPath, manifest, 'utf8');

    await unregisterSparsePackage();

    console.log(`Registering sparse package from: ${electronDir}`);
    await executePowerShell(
      `Add-AppxPackage -ExternalLocation ${psQuote(electronDir)} -Register ${psQuote(targetPath)}`,
    );

    console.log('Sparse package registered successfully');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to register sparse package:', message);
  }
}
