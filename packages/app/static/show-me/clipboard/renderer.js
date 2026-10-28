window.addEventListener('DOMContentLoaded', () => {
  const copyButton = document.querySelector('#copy')
  const pasteButton = document.querySelector('#paste')
  const textarea = document.querySelector('textarea')
  copyButton.onclick = () => {
    window.clipboard.writeText('Hello from Electron!')
  }
  pasteButton.onclick = async () => {
    textarea.value = await window.clipboard.readText()
  }
})
