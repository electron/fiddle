// Access information about media sources that can be used to capture audio
// and video from the desktop using the navigator.mediaDevices.getUserMedia API.
//
// For more info, see:
// https://electronjs.org/docs/api/desktop-capturer

const { app, BrowserWindow, desktopCapturer } = require('electron/main')
const path = require('node:path')

app.whenReady().then(() => {
  const mainWindow = new BrowserWindow({
    height: 600,
    width: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  mainWindow.loadFile('index.html')
  if (parseInt(process.versions.electron) >= 17) {
    desktopCapturer.getSources({ types: ['window', 'screen'] }).then(async sources => {
      for (const source of sources) {
        if (source.id.startsWith('screen')) {
          mainWindow.webContents.send('SET_SOURCE', source.id)
          return
        }
      }
    })
  }
})
