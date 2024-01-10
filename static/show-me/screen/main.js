// Retrieve information about screen size, displays, cursor position, etc.
//
// For more info, see:
// https://electronjs.org/docs/api/screen

const { app, BrowserWindow, ipcMain, screen } = require('electron/main')
const path = require('node:path')

app.whenReady().then(() => {
  // Create a window that fills the screen's available
  // work area.
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  const mainWindow = new BrowserWindow({
    width,
    height,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  ipcMain.handle('get-displays', () => {
    return screen.getAllDisplays()
  })
  mainWindow.loadFile('index.html')
})
