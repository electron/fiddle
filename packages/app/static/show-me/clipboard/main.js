// Perform copy and paste operations on the system clipboard.
//
// For more info, see:
// https://electronjs.org/docs/api/clipboard

const { app, BrowserWindow, ipcMain, clipboard } = require('electron/main')
const path = require('node:path')

ipcMain.handle('clipboard:readText', () => {
  return clipboard.readText()
})

ipcMain.handle('clipboard:writeText', (event, text) => {
  clipboard.writeText(text)
})

app.whenReady().then(() => {
  const mainWindow = new BrowserWindow({
    height: 600,
    width: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  mainWindow.loadFile('index.html')
})
