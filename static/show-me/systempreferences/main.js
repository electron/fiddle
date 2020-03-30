// Get system preferences.
//
// For more info, see:
// https://electronjs.org/docs/api/system-preferences#systempreferences

const { app, systemPreferences } = require('electron')

app.on('ready', () => {
  // This module let's us access various system preferences.
  // Let's start with macOS:

  if (process.platform === 'darwin') {
    // Let's get the recent places
    const places = systemPreferences.getUserDefault('NSNavRecentPlaces', 'array')
    console.log(places)
  }

  if (process.platform === 'win32') {
    // As an example, let's get the accent color of
    // the users current theme
    const accentColor = systemPreferences.getAccentColor()
    console.log(accentColor)

    // Did the user select a high contrast theme?
    const isHighContrast = systemPreferences.isInvertedColorScheme()
    console.log(isHighContrast)
  }
})
