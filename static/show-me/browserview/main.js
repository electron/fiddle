// A BrowserView can be used to embed additional web content into a BrowserWindow.
// It is like a child window, except that it is positioned relative to its owning
// window. It is meant to be an alternative to the webview tag.
//
// For more info, see:
// https://electronjs.org/docs/api/browser-view

// In the main process.
const { BrowserView, BrowserWindow, app } = require('electron')

app.on('ready', () => {
  let win = new BrowserWindow({ width: 800, height: 600 })
  win.on('closed', () => {
    win = null
  })

  const view = new BrowserView({
    webPreferences: {
      nodeIntegration: false
    }
  })

  win.setBrowserView(view)
  view.setBounds({ x: 0, y: 0, width: 300, height: 300 })
  view.webContents.loadURL('https://electronjs.org')
})
