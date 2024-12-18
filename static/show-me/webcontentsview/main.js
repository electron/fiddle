// A View that displays a WebContents.
//
// For more info, see:
// https://electronjs.org/docs/api/web-contents-view

// In the main process.
const { app, BaseWindow, WebContentsView } = require('electron')

app.whenReady().then(() => {
  const win = new BaseWindow({ width: 800, height: 400 })

  const view1 = new WebContentsView()
  win.contentView.addChildView(view1)
  view1.setBounds({ x: 0, y: 0, width: 400, height: 400 })
  view1.webContents.loadURL('https://www.electronjs.org')

  const view2 = new WebContentsView()
  win.contentView.addChildView(view2)
  view2.setBounds({ x: 400, y: 0, width: 400, height: 400 })
  view2.webContents.loadURL('https://www.electronjs.org/fiddle')
})
