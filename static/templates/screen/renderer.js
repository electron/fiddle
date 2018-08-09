const { screen } = require('electron')

const screens = screen.getAllDisplays()
const div = document.querySelector('div')

div.innerText = JSON.stringify(screens);
