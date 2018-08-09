// Render and control web pages.
//
// For more info, see:
// https://electronjs.org/docs/api/web-contents

const { app, BrowserWindow, webContents } = require('electron')

let mainWindow

app.on('ready', () => {
  mainWindow = new BrowserWindow({ height: 600, width: 600 })
  mainWindow.loadFile('index.html')

  setTimeout(() => {
    // ...later
    const contents = webContents.getAllWebContents()[0]

    // The WebContents class has dozens of methods and
    // events available. As an example, we'll call one
    // of them here: print(), which prints the current
    // page.

    contents.print()
  }, 1000)
})
