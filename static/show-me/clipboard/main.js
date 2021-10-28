// Perform copy and paste operations on the system clipboard.
//
// For more info, see:
// https://electronjs.org/docs/api/clipboard

const { app, BrowserWindow } = require('electron')

app.whenReady().then(() => {
  const mainWindow = new BrowserWindow({
    height: 600,
    width: 600,
    webPreferences: {
      nodeIntegration: false, // default in Electron >= 5
      contextIsolation: true // default in Electron >= 12
    }
  })

  mainWindow.loadFile('index.html')
})
