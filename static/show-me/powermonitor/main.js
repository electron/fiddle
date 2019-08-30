// Monitor power state changes.
//
// For more info, see:
// https://electronjs.org/docs/api/power-monitor

const { app } = require('electron')

app.on('ready', () => {
  // We cannot require the "ready" module until
  // the app is ready
  const { powerMonitor } = require('electron')

  powerMonitor.on('suspend', () => {
    console.log('The system is going to sleep')
  })

  powerMonitor.on('resume', () => {
    console.log('The system is waking up')
  })

  powerMonitor.on('on-ac', () => {
    console.log('We\'re on AC power')
  })

  powerMonitor.on('on-battery', () => {
    console.log('We\'re on battery power')
  })
})
