// Render and control web pages.
//
// For more info, see:
// https://electronjs.org/docs/api/web-contents

const { app, BrowserWindow, webContents } = require('electron/main')

app.whenReady().then(() => {
  const mainWindow = new BrowserWindow({ height: 600, width: 600 })
  mainWindow.loadFile('index.html')

  // This setTimeout is to demonstrate the method firing
  // for the demo, and is not needed in production.
  setTimeout(() => {
    const contents = webContents.getAllWebContents()[0]

    // The WebContents class has dozens of methods and
    // events available. As an example, we'll call one
    // of them here: loadURL, which loads Electron's
    // home page.
    const options = { extraHeaders: 'pragma: no-cache\n' }
    contents.loadURL('https://electronjs.org', options)
  }, 1000)
})
