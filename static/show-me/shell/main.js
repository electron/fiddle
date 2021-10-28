// Manage files and URLs using their default applications.
//
// For more info, see:
// https://electronjs.org/docs/api/shell

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
