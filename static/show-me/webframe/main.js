// Customize the rendering of the current web page.
//
// For more info, see:
// https://electronjs.org/docs/api/web-frame

const { app, BrowserWindow } = require('electron')

let mainWindow = null

app.on('ready', () => {
  mainWindow = new BrowserWindow({ height: 600, width: 600,
    webPreferences: {
      nodeIntegration: true
    } })
  mainWindow.loadFile('index.html')
})
