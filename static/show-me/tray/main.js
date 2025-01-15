// Add icons and context menus to the system's notification area.
//
// For more info, see:
// https://electronjs.org/docs/api/tray

const { app, Tray, Menu, nativeImage } = require('electron/main')
const path = require('node:path')

app.whenReady().then(() => {
  const iconPath = path.join(__dirname, 'icon.png')
  const icon = nativeImage.createFromPath(iconPath)
  const tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Item1', type: 'radio' },
    { label: 'Item2', type: 'radio' },
    { label: 'Item3', type: 'radio', checked: true },
    { label: 'Item4', type: 'radio' }
  ])

  tray.setToolTip('This is my application.')
  tray.setContextMenu(contextMenu)
})
