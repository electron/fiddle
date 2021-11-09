const { ipcRenderer } = require('electron')

window.addEventListener('DOMContentLoaded', () => {
  const screens = ipcRenderer.sendSync('get-displays')
  document.querySelector('pre').innerText = JSON.stringify(screens, undefined, 2)
})
