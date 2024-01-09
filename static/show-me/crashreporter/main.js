// Submit crash reports to a remote server.
//
// For more info, see:
// https://electronjs.org/docs/api/crash-reporter

const { app, BrowserWindow, crashReporter } = require('electron/main')
const path = require('node:path')

crashReporter.start({
  productName: 'YourName',
  globalExtra: {
    _companyName: 'YourCompany'
  },
  submitURL: 'https://your-domain.com/url-to-submit',
  uploadToServer: true
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

  mainWindow.webContents.on('render-process-gone', () => {
    console.log('Window crashed!')
  })
})
