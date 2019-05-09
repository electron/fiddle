// The ipcMain and ipcRenderer modules allow communication between the mai
// process and the renderer processes.
//
// For more info, see:
// https://electronjs.org/docs/api/ipc-main
// https://electronjs.org/docs/api/ipc-renderer

const { app, BrowserWindow, ipcMain } = require('electron')

let mainWindow = null

app.on('ready', () => {
  mainWindow = new BrowserWindow({
    height: 600,
    width: 600,
    webPreferences: {
      nodeIntegration: true
    }
  })

  ipcMain.on('asynchronous-message', (event, arg) => {
    console.log(arg) // prints "ping"
    event.sender.send('asynchronous-reply', 'pong')
  })

  ipcMain.on('synchronous-message', (event, arg) => {
    console.log(arg) // prints "ping"
    event.returnValue = 'pong'
  })

  mainWindow.loadFile('index.html')
})
