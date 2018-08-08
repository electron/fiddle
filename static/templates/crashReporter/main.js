// Submit crash reports to a remote server.
//
// For more info, see:
// https://electronjs.org/docs/api/crash-reporter

const { app, crashReporter } = require('electron')

let mainWindow = null

app.on('ready', () => {
  mainWindow = new BrowserWindow({ height: 600, width: 600 })
  mainWindow.loadFile('index.html')
})

crashReporter.start({
  productName: 'YourName',
  companyName: 'YourCompany',
  submitURL: 'https://your-domain.com/url-to-submit',
  uploadToServer: true
})
