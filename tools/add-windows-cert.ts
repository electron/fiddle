import * as os from 'node:os';
import * as path from 'node:path';

import * as fs from 'fs-extra';

export async function generateWindowsSigningCert() {
  try {
    const dir = await fs.mkdtemp(path.resolve(os.tmpdir(), 'builder-folder-'));

    const certAsBase64 = process.env.WINDOWS_SIGNING_CERT;
    if (!certAsBase64) {
      throw new Error(`Could not find code sign cert base value`);
    }

    const certificatePath = path.resolve(dir, 'win-certificate.pfx');
    await fs.writeFile(certificatePath, certAsBase64.replace(/\\n/g, ''), {
      encoding: 'base64',
    });

    if (!certificatePath) {
      throw new Error(`Could not generate cert at ${certificatePath}`);
    }
    return certificatePath;
  } catch (err) {
    throw new Error(`Could not generate code signing cert: ${err}`);
  }
}
