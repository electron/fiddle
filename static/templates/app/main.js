// The "app" object controls your applications life-cycle. It exposes various
// events and methods to control how your app exposes itself to the operating
// system.
//
// For more info, see:
// https://electronjs.org/docs/api/app

const { app } = require('electron')

app.on('ready', () => console.log('The app is now ready for action'))

app.on('browser-window-created', () => console.log('A window was created!'))
app.on('browser-window-focus', () => console.log('...and focused!'))

console.log(`The app lives at: ${app.getAppPath()}`)
console.log(`It's named: ${app.getName()}`)
console.log(`It has the version: ${app.getVersion()}`)
