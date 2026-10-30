// Manage files and URLs using their default applications.
//
// For more info, see:
// https://electronjs.org/docs/api/shell

const { app, BrowserWindow, ipcMain, shell } = require('electron/main')
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

  ipcMain.on('open-github', () => {
    shell.openExternal('https://github.com')
  })

  ipcMain.on('open-folder', () => {
    shell.showItemInFolder(__dirname)
  })

  ipcMain.on('beep', () => {
    shell.beep()
  })
})
