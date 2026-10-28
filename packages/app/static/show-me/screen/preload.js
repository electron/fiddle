const { ipcRenderer } = require('electron/renderer')

window.addEventListener('DOMContentLoaded', () => {
  ipcRenderer
    .invoke('get-displays')
    .then((screens) => {
      document.querySelector('pre').innerText = JSON.stringify(screens, undefined, 2)
    })
})
