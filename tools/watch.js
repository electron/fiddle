const chokidar = require('chokidar');
const { debounce } = require('lodash');

const { compileTypeScript } = require('./tsc')
const { compileLess } = require('./lessc')

const DEBOUNCE_TIMEOUT = 250;

const tsc = debounce(async () => {
  try {
    await compileTypeScript();
  } catch (error) {
    console.log(`Compiling TypeScript failed`);
  }
}, DEBOUNCE_TIMEOUT);

const less = debounce(async () => {
  try {
    await compileLess();
  } catch (error) {
    console.log(`Compiling Less failed`);
  }
}, DEBOUNCE_TIMEOUT);

const compile = (event = {}, path = '') => {
  console.log(`${new Date().toLocaleTimeString()}: ${path} changed`);
  if (path.endsWith('less')) less();
  if (path.endsWith('ts')) tsc();
  console.log(``);
}

chokidar.watch('./src', {
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: true
}).on('all', compile);

console.log(`🔍 Watching files for changes...`)

process.on('exit', () => {
  console.log(`Shutting down file watcher...`);
});
