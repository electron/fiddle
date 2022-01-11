// Access information about media sources that can be used to capture audio
// and video from the desktop using the navigator.mediaDevices.getUserMedia API.
//
// For more info, see:
// https://electronjs.org/docs/api/desktop-capturer

const { app, BrowserWindow } = require('electron')
const path = require('path')

app.whenReady().then(() => {
  const mainWindow = new BrowserWindow({
    height: 600,
    width: 600,
    webPreferences: {
      nodeIntegration: false, // default in Electron >= 5
      contextIsolation: true, // default in Electron >= 12
      preload: path.join(__dirname, 'preload.js')
    }
  })

  mainWindow.loadFile('index.html')
})
