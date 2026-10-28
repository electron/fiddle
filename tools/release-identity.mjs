#!/usr/bin/env node
// Asserts the app identity against packages/app/build/identity.json. The previous
// release's userData, credentials and installs are only found if it never changes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Forge loads forge.config.ts with jiti, so this does the same.
import { createJiti } from 'jiti';

const appDir = path.resolve(import.meta.dirname, '..', 'packages', 'app');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(appDir, file), 'utf8'));
const expected = readJson('build/identity.json');
const pkg = readJson('package.json');

const jiti = createJiti(import.meta.filename);
const config = await jiti.import(path.join(appDir, 'forge.config.ts'), { default: true });

/** The resolved config of the maker called `name` (class makers) or with that package name. */
async function makerConfig(name) {
  const maker = config.makers.find((candidate) => candidate.name === name);
  if (!maker) throw new Error(`forge.config.ts has no "${name}" maker`);
  if (typeof maker.prepareConfig === 'function') await maker.prepareConfig('x64');
  return maker.config ?? {};
}

const packager = config.packagerConfig;
const squirrel = await makerConfig('squirrel');
const msix = await makerConfig('msix');
const deb = (await makerConfig('deb')).options ?? {};
const rpm = (await makerConfig('rpm')).options ?? {};
const appImage = (await makerConfig('@reforged/maker-appimage')).options ?? {};

const actual = {
  package: { name: pkg.name, productName: pkg.productName },
  packager: {
    name: packager.name,
    executableName: packager.executableName,
    appBundleId: packager.appBundleId,
    appCategoryType: packager.appCategoryType,
    protocols: (packager.protocols ?? []).flatMap((protocol) => protocol.schemes),
    companyName: packager.win32metadata?.CompanyName,
  },
  squirrel: {
    name: squirrel.name,
    exe: squirrel.exe,
    setupExe: squirrel.setupExe?.replace(pkg.version, '<version>'),
    noMsi: squirrel.noMsi,
  },
  msix: {
    packageIdentity: msix.manifestVariables?.packageIdentity,
    publisher: msix.manifestVariables?.publisher,
  },
  linux: {
    // deb and rpm are named after package.json's name, the AppImage after the
    // product name, unless a maker overrides it.
    deb: deb.name ?? pkg.name,
    rpm: rpm.name ?? pkg.name,
    appImage: appImage.productName ?? packager.name,
    bin: deb.bin,
    mimeType: deb.mimeType,
  },
};

try {
  assert.deepStrictEqual(actual, expected);
} catch (error) {
  console.error(error.message);
  console.error(
    '\nThe app identity no longer matches packages/app/build/identity.json. It must match ' +
      'the previous release, so fix forge.config.ts or package.json ' +
      'rather than the expected values.',
  );
  process.exit(1);
}
console.log('App identity matches packages/app/build/identity.json');
