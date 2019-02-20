// Create native application menus and context menus.
//
// For more info, see:
// https://electronjs.org/docs/api/menu

const { app, BrowserWindow, Menu } = require('electron')

let mainWindow = null

app.on('ready', () => {
  mainWindow = new BrowserWindow({ height: 600, width: 600 })
  mainWindow.loadFile('index.html')

  const template = [
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'Hello From Electron!',
      submenu: [
        {
          label: 'I have a custom handler',
          click () {
            console.log('👋')
          }
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forcereload' },
        { role: 'toggledevtools' },
        { type: 'separator' },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        { type: 'separator' }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
})
