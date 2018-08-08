// An alternate transport for Chrome's remote debugging protocol.
//
// Chrome Developer Tools has a special binding available at JavaScript
// runtime that allows interacting with pages and instrumenting them.
//
// For more info, see:
// https://electronjs.org/docs/api/debugger

const { app, BrowserWindow } = require('electron')

let mainWindow = null

app.on('ready', () => {
  mainWindow = new BrowserWindow({ height: 600, width: 600 })

  mainWindow.loadFile('index.html')

  try {
    mainWindow.webContents.debugger.attach('1.1')
  } catch (err) {
    console.log('Debugger attach failed: ', err)
  }

  win.webContents.debugger.on('detach', (event, reason) => {
    console.log('Debugger detached due to: ', reason)
  })

  win.webContents.debugger.on('message', (event, method, params) => {
    if (method === 'Network.requestWillBeSent') {
      if (params.request.url === 'https://www.github.com') {
        win.webContents.debugger.detach()
      }
    }
  })

  win.webContents.debugger.sendCommand('Network.enable')
})
