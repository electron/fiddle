const { shell } = require('electron')

document.querySelector('#open-github').onclick = () => {
  shell.openExternal('https://github.com')
}

document.querySelector('#open-folder').onclick = () => {
  shell.showItemInFolder(__dirname)
}

document.querySelector('#beep').onclick = () => {
  shell.beep()
}
