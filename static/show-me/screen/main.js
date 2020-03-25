// Retrieve information about screen size, displays, cursor position, etc.
//
// For more info, see:
// https://electronjs.org/docs/api/screen

const { app, BrowserWindow } = require('electron')

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
      nodeIntegration: true
    }
  })

  mainWindow.loadFile('index.html')
})
