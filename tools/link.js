const electronLink = require('electron-link')

const snapshotScript = await electronLink({
  baseDirPath: './src',
  mainPath: './src/main.js',
  cachePath: '/cache/path',
  shouldExcludeModule: (modulePath) => excludedModules.has(modulePath)
})

const snapshotScriptPath = '/path/to/snapshot/script.js'
fs.writeFileSync(snapshotScriptPath, snapshotScript)

// Verify if we will be able to use this in `mksnapshot`
vm.runInNewContext(snapshotScript, undefined, {filename: snapshotScriptPath, displayErrors: true})