// Accelerators are Strings that can contain multiple modifiers and key codes,
// combined by the + character, and are used to define keyboard shortcuts
// throughout your application.
//
// For more info, see:
// https://electronjs.org/docs/api/accelerator

const { app, globalShortcut } = require('electron')

app.on('ready', () => {
  // Register a 'CommandOrControl+Y' shortcut listener.
  //
  // On Linux and Windows, the Command key does not have any effect, so use
  // CommandOrControl which represents Command on macOS and Control on
  // Linux and Windows to define some accelerators.
  globalShortcut.register('CommandOrControl+Y', () => {
    console.log(`The global shortkey was pressed!`)
  })

  // It supports "special names". Check out the API documentation for a full
  // list.
  globalShortcut.register('VolumeUp', () => console.log(`Turn it up!`))
  globalShortcut.register('VolumeDown', () => console.log(`Turn it down!`))
})
