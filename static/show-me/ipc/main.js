// The ipcMain and ipcRenderer modules allow communication between the mai
// process and the renderer processes.
//
// For more info, see:
// https://electronjs.org/docs/api/ipc-main
// https://electronjs.org/docs/api/ipc-renderer

const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

app.whenReady().then(() => {
  const mainWindow = new BrowserWindow({
    height: 600,
    width: 600,
    webPreferences: {
      nodeIntegration: false, // default in Electron >= 5
      contextIsolation: true, // default in Electron >= 12
      preload: path.join(__dirname, 'preload.js')
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

  ipcMain.handle('invoke-handle-message', (event, arg) => {
    console.log(arg)
    return 'pong'
  })

  mainWindow.loadFile('index.html')
})
