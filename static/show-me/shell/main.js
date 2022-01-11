// Manage files and URLs using their default applications.
//
// For more info, see:
// https://electronjs.org/docs/api/shell

const { app, BrowserWindow } = require('electron')
const path = require('path')

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
