// Register and handle a custom protocol.
//
// For more info, see:
// https://electronjs.org/docs/api/protocol

const { app, BrowserWindow, protocol } = require('electron/main')

app.whenReady().then(() => {
  protocol.handle('some-protocol', () => {
    // The body could also be a string or a ReadableStream.
    return new Response('<h1>Hello from the protocol handler</h1>', {
      headers: { 'content-type': 'text/html' }
    })
  })

  const mainWindow = new BrowserWindow({ height: 600, width: 600 })
  mainWindow.loadURL('some-protocol://index.html')
})
