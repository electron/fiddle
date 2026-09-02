// Register and handle custom protocol
//
// For more info, see:
// https://www.electronjs.org/docs/latest/api/protocol

const { app, BrowserWindow, protocol } = require('electron')

app.whenReady().then(() => {
  protocol.handle('some-protocol', () => {
    return new Response(
      Buffer.from('<h1>Hello from protocol handler</h1>'), // Could also be a string or ReadableStream.
      { headers: { 'content-type': 'text/html' } }
    )
  })
  const mainWindow = new BrowserWindow({ height: 600, width: 600 })
  mainWindow.loadURL('some-protocol://index.html')
})
