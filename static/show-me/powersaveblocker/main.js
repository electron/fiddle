// Block the system from entering low-power (sleep) mode.
//
// For more info, see:
// https://electronjs.org/docs/api/power-save-blocker

const { app, powerSaveBlocker } = require('electron/main')

app.whenReady().then(() => {
  const id = powerSaveBlocker.start('prevent-display-sleep')

  console.log(powerSaveBlocker.isStarted(id))

  // Let's allow power save again in 60000ms
  setTimeout(() => {
    powerSaveBlocker.stop(id)
  }, 60000)
})
