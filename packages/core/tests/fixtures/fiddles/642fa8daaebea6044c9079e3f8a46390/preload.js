const { contextBridge } = require('electron');

// Test helpers
const test = {
  assert: (ok, ...logs) => {
    if (!ok) test.fail(...logs);
  },
  fail: (...logs) => test.done(false, ...logs),
  done: (success = true, ...logs) => {
    if (!success) logs.unshift(new Error('test failed'));
    require('electron').ipcRenderer.send('test-done', success, ...logs);
    process.exit(0);
  },
};

const verstr = process.versions.electron;
const ver = verstr
  .split('-', 1)[0]
  .split('.')
  .map((tok) => +tok)
  .reduce((acc, cur) => acc * 100 + cur, 0);
console.log(verstr, ver);
test.assert(ver < 120002); // < 12.0.2
test.done();

contextBridge.exposeInMainWorld('test', test);
