const chokidar = require('chokidar');
const { debounce } = require('lodash');

const { compileTypeScript } = require('./tsc')
const { compileLess } = require('./lessc')

// This is the simplest of all file-watchers, but it works!
async function _compile(event, path) {
  console.log(`${path} changed, rebuilding`, event);

  try {
    await compileTypeScript();
  } catch (error) {
    console.log(`Compiling TypeScript failed`);
  }

  try {
    await compileLess();
  } catch (error) {
    console.log(`Compiling Less failed`);
  }
}

const compile = debounce(_compile, 500);

chokidar.watch('./src', {
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: true
}).on('all', compile);

console.log(`🔍 Watching files for changes...`)

process.on('exit', () => {
  console.log(`Shutting down file watcher...`);
});
