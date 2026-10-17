// Customize the rendering of the current web page.
//
// For more info, see:
// https://electronjs.org/docs/api/web-frame

const { app, BrowserWindow } = require('electron/main')
const path = require('node:path')

app.whenReady().then(() => {
  const mainWindow = new BrowserWindow({
    width: 600,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })
  mainWindow.loadFile('index.html')
})
