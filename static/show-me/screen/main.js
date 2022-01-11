// Retrieve information about screen size, displays, cursor position, etc.
//
// For more info, see:
// https://electronjs.org/docs/api/screen

const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

app.whenReady().then(() => {
  // We cannot require the screen module until the
  // app is ready
  const { screen } = require('electron')

  // Create a window that fills the sceen's available
  // work area.
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  const mainWindow = new BrowserWindow({
    width,
    height,
    webPreferences: {
      nodeIntegration: false, // default in Electron >= 5
      contextIsolation: true, // default in Electron >= 12
      preload: path.join(__dirname, 'preload.js')
    }
  })

  ipcMain.handle('get-displays', () => {
    return screen.getAllDisplays()
  })
  mainWindow.loadFile('index.html')
})
