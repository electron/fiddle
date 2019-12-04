const { notarize } = require('electron-notarize');
const path = require('path');

const buildOutput = path.resolve(
  __dirname,
  '..',
  'out',
  'Electron Fiddle-darwin-x64',
  'Electron Fiddle.app'
);

module.exports = function () {
  if (process.platform !== 'darwin') {
    console.log('Not a Mac; skipping notarization');
    return;
  }

  if (!process.env.CI) {
    console.log(`Not in CI, skipping notarization`);
    return;
  }

  if (!process.env.APPLE_ID || !process.env.APPLE_ID_PASSWORD) {
    console.warn('Should be notarizing, but environment variables APPLE_ID or APPLE_ID_PASSWORD are missing!');
    return;
  }

  console.log('Notarizing...');

  return notarize({
    appBundleId: 'com.electron.fiddle',
    appPath: buildOutput,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_ID_PASSWORD,
    ascProvider: 'LT94ZKYDCJ'
  }).catch((e) => {
    console.error(e);
    throw e;
  });
}
