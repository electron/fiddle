// Perform copy and paste operations on the system clipboard.
//
// For more info, see:
// https://electronjs.org/docs/api/clipboard

const { app, BrowserWindow } = require('electron')

let mainWindow = null

app.on('ready', () => {
  mainWindow = new BrowserWindow({ height: 600, width: 600 })

  mainWindow.loadFile('index.html')
})
