// Submit crash reports to a remote server.
//
// For more info, see:
// https://electronjs.org/docs/api/crash-reporter

const { app, BrowserWindow, crashReporter } = require('electron')
const path = require('path')

crashReporter.start({
  productName: 'YourName',
  companyName: 'YourCompany',
  submitURL: 'https://your-domain.com/url-to-submit',
  uploadToServer: true
})

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

  mainWindow.webContents.on('crashed', () => {
    console.log('Window crashed!')
  })
})
