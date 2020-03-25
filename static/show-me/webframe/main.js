// Customize the rendering of the current web page.
//
// For more info, see:
// https://electronjs.org/docs/api/web-frame

const { app, BrowserWindow } = require('electron')

app.whenReady().then(() => {
  const mainWindow = new BrowserWindow({
    width: 600,
    height: 600,
    webPreferences: {
      nodeIntegration: true
    }
  })
  mainWindow.loadFile('index.html')
})
