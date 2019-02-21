const { screen } = require('electron')

const screens = screen.getAllDisplays()
const pre = document.querySelector('pre')

pre.innerText = JSON.stringify(screens, undefined, 2)
