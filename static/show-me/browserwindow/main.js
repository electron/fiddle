// The "BrowserWindow" class is the primary way to create user interfaces
// in Electron. A BrowserWindow is, like the name suggests, a window.
//
// For more info, see:
// https://electronjs.org/docs/api/browser-window

const { app, BrowserWindow } = require('electron')

const windows = []

app.on('ready', () => {
  // BrowserWindows can be created in plenty of shapes, sizes, and forms.
  // Check out the editor's auto-completion for all the configuration
  // options available in the current version.
  //
  // Let's make a few windows!

  // A window that's only half visible
  windows.push(
    new BrowserWindow({
      opacity: 0.5,
      x: 200,
      y: 200
    })
  )
  
  // A transparent window. On Windows OS, a transparent window must be frameless
  if (process.platform != 'win32') {
    windows.push(
      new BrowserWindow({
        transparent: true,
        x: 300,
        y: 300
      })
    )  
  }
  else {
    windows.push(
      new BrowserWindow({
        transparent: true,
        frame: false,
        x: 300,
        y: 300
      })
    )
  }

  // A window that's fixed and always on top
  windows.push(
    new BrowserWindow({
      movable: false,
      resizable: false,
      alwaysOnTop: true,
      maximizable: false,
      minimizable: false,
      x: 600,
      y: 600
    })
  )

  windows.forEach((window) => {
    // Load our index.html
    window.loadFile('index.html')
  })
})
