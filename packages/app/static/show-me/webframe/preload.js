const { webFrame } = require('electron/renderer')

setInterval(() => {
  // A random number
  const level = Math.floor(Math.random() * 10)

  // Let's set a random zoom level
  webFrame.setZoomLevel(level)
}, 750)
