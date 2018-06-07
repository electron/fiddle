/* tslint:disable */
const childProcess = require('child_process');
const path = require('path');

module.exports = async () => {
  await new Promise((resolve, reject) => {
    console.info('Compiling Typescript');

    const child = childProcess.spawn(
      path.resolve(__dirname, '..', 'node_modules', '.bin', 'tsc'),
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
