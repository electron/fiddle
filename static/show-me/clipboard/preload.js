const { clipboard } = require('electron')

// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
window.addEventListener('DOMContentLoaded', () => {
  const copyButton = document.querySelector('#copy')
  const pasteButton = document.querySelector('#paste')
  const textarea = document.querySelector('textarea')
  copyButton.onclick = () => {
    clipboard.writeText('Hello from Electron!')
  }
  pasteButton.onclick = () => {
    textarea.value = clipboard.readText()
  }
})
