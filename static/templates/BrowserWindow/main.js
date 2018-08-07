// The "BrowserWindow" class is the primary way to create user interfaces
// in Electron. A BrowserWindow is, like the name suggests, a window.
//
// For more info, see:
// https://github.com/electron/electron/blob/master/docs/api/browser-window.md

const { app, BrowserWindow } = require('electron')

app.on('ready', () => {
  // BrowserWindows can be created in plenty of shapes, sizes, and forms.
  // Check out the editor's auto-completion for all the configuration
  // options available in the current version.
  let win = new BrowserWindow({
    width: 800,
    height: 600
  })

  win.on('closed', () => {
    win = null
  })

  // Load a remote URL
  win.loadURL('https://github.com')
})
