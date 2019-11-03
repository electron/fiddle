// Display native system dialogs for opening and saving files, alerting, etc.
//
// For more info, see:
// https://electronjs.org/docs/api/dialog

const { app, BrowserWindow, dialog } = require('electron')

let mainWindow = null

app.on('ready', () => {
  mainWindow = new BrowserWindow({ height: 600, width: 600 })

  // Show an "Open File" dialog and attempt to open
  // the chosen file in our window.
  dialog.showOpenDialog(mainWindow, {
    properties: ['openFile']
  }).then(result => {
    if (result.canceled) {
      console.log('Dialog was canceled')
    } else {
      const file = result.filePaths[0]
      mainWindow.loadURL(`file://${file}`)
    }
  }).catch(err => {
    console.log(err)
  })
})
