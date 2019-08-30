// Submit crash reports to a remote server.
//
// For more info, see:
// https://electronjs.org/docs/api/crash-reporter

const { app, BrowserWindow } = require('electron')

let mainWindow = null

app.on('ready', () => {
  mainWindow = new BrowserWindow({
    height: 600,
    width: 600,
    webPreferences: {
      nodeIntegration: true
    }
  })
  mainWindow.loadFile('index.html')

  mainWindow.webContents.on('crashed', () => {
    console.log('Window crashed!')
  })
})
