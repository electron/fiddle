import * as fs from 'node:fs';
import * as path from 'node:path';

fs.rmSync(path.join(__dirname, '.webpack'), { force: true, recursive: true });
