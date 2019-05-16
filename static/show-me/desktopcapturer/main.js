// Access information about media sources that can be used to capture audio
// and video from the desktop using the navigator.mediaDevices.getUserMedia API.
//
// For more info, see:
// https://electronjs.org/docs/api/desktop-capturer

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
})
