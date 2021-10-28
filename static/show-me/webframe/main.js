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
      nodeIntegration: false, // default in Electron >= 5
      contextIsolation: true // default in Electron >= 12
    }
  })
  mainWindow.loadFile('index.html')
})
