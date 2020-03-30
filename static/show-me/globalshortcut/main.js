// The globalShortcut module can register/unregister a global keyboard shortcut
// with the operating system so that you can customize the operations for various
// shortcuts.
//
// Note: The shortcut is global; it will work even if the app does not have the
// keyboard focus. You should not use this module until the ready event of the
// app module is emitted. In this example, we're using "Accelerators":
// Accelerators are Strings that can contain multiple modifiers and key codes,
// combined by the + character, and are used to define keyboard shortcuts
// throughout your application.
//
// For more info, see:
// https://electronjs.org/docs/api/accelerator
// https://electronjs.org/docs/api/global-shortcut

const { app, globalShortcut } = require('electron')

app.on('ready', () => {
  // Register a 'CommandOrControl+Y' shortcut listener.
  //
  // On Linux and Windows, the Command key does not have any effect, so use
  // CommandOrControl which represents Command on macOS and Control on
  // Linux and Windows to define some accelerators.
  globalShortcut.register('CommandOrControl+Y', () => {
    console.log('The global shortkey was pressed!')
  })

  // It supports "special names". Check out the API documentation for a full
  // list.
  globalShortcut.register('VolumeUp', () => console.log('Turn it up!'))
  globalShortcut.register('VolumeDown', () => console.log('Turn it down!'))
})

app.on('will-quit', () => {
  // Unregister a shortcut.
  globalShortcut.unregister('CommandOrControl+Y')

  // Unregister all shortcuts.
  globalShortcut.unregisterAll()
})
