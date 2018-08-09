// Retrieve information about screen size, displays, cursor position, etc.
//
// For more info, see:
// https://electronjs.org/docs/api/screen

const { app, BrowserWindow, screen } = require('electron')

let mainWindow = null

app.on('ready', () => {
  // Create a window that fills the sceen's available
  // work area.
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  mainWindow = new BrowserWindow({ width, height })

  mainWindow.loadFile('index.html')
})
