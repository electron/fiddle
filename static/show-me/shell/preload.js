const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld(
  'electron',
  {
    openGitHub: () => ipcRenderer.send('open-github'),
    openFolder: () => ipcRenderer.send('open-folder'),
    beep: () => ipcRenderer.send('beep')
  }
)
