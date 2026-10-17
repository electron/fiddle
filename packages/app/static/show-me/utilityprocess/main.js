// The "utilityProcess" module allows creating a child process with
// Node.js and Message ports enabled.It provides the equivalent of[`child_process.fork`][] API from Node.js
// but instead uses[Services API][] from Chromium to launch the child process.
//
// For more info, see:
// https://electronjs.org/docs/api/utility-process

const { app, utilityProcess } = require('electron/main')
const path = require('node:path')

app.whenReady().then(() => {
  const child = utilityProcess.fork(path.join(__dirname, 'child.js'))

  child.on('spawn', () => {
    console.log(`Child process spawned with PID: ${child.pid}`)
    child.postMessage('Hello from parent!')
  })

  child.on('message', (message) => {
    console.log(`Received message from child: ${message}`)
  })

  child.on('exit', (code) => {
    console.log(`Child exited with code: ${code}`)
  })
})
