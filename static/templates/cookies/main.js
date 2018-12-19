// Query and modify a session's cookies.
//
// For more info, see:
// https://electronjs.org/docs/api/cookies

const { app, BrowserWindow, session } = require('electron')

let mainWindow = null

app.on('ready', () => {
  mainWindow = new BrowserWindow({
    height: 600,
    width: 600,
    webPreferences: {
      nodeIntegration: false
    }
  })

  // Once the window has finished loading, let's check out
  // the cookies
  mainWindow.webContents.on('did-finish-load', () => {
    // Query all cookies.
    session.defaultSession.cookies.get({}, (error, cookies) => {
      console.log(error, cookies)
    })

    // Query all cookies associated with a specific url.
    session.defaultSession.cookies.get({ url: 'http://www.github.com' }, (error, cookies) => {
      console.log(error, cookies)
    })

    // Set a cookie with the given cookie data;
    // may overwrite equivalent cookies if they exist.
    const cookie = { url: 'http://www.github.com', name: 'dummy_name', value: 'dummy' }
    session.defaultSession.cookies.set(cookie, (error) => {
      if (error) console.error(error)
    })
  })

  mainWindow.loadURL('https://electronjs.org')
})
