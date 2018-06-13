/* tslint:disable */

const childProcess = require('child_process');
const path = require('path');
const logSymbols = require('log-symbols');

async function generateTypeScript() {
  await new Promise((resolve, reject) => {
    console.info(logSymbols.info, 'Compiling Typescript');

    const cmd = process.platform === 'win32' ? 'tsc.cmd' : 'tsc';
    const child = childProcess.spawn(
      path.resolve(__dirname, '..', 'node_modules', '.bin', cmd),
      ['-p', 'tsconfig.json'],
      {
        cwd: path.resolve(__dirname, '..'),
        stdio: 'inherit'
      }
    );

    child.on('exit', (code) => {
      if (code === 0) return resolve();
      reject(new Error('Typescript compilation failed'));
    });
  });
};

module.exports = {
  generateTypeScript
}
