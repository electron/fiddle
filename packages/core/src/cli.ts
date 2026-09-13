#!/usr/bin/env node

import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { runFromCommandLine } from './command-line.js';

const entry = process.argv[1];
if (entry && (await fs.promises.realpath(entry)) === fileURLToPath(import.meta.url)) {
  void runFromCommandLine(process.argv.slice(2));
}
