const { clipboard } = require('electron')

const copyButton = document.querySelector('#copy')
const pasteButton = document.querySelector('#paste')
const textarea = document.querySelector('textarea')

copyButton.onclick = () => {
  clipboard.writeText('Hello from Electron!')
}

pasteButton.onclick = () => {
  textarea.value = clipboard.readText()
}
