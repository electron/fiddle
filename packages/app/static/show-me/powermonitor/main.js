// Monitor power state changes.
//
// For more info, see:
// https://electronjs.org/docs/api/power-monitor

const { app, powerMonitor } = require('electron/main')

app.whenReady().then(() => {
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
