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
  //
  // If you provide a callback, the method will be asynchronous,
  // but in thise case, we'll just use the synchronous variant.
  const file = dialog.showOpenDialog({
    title: 'Hello!',
    properties: ['openFile']
  })

  mainWindow.loadURL(`file://${file}`)
})
