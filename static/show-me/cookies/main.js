// Query and modify a session's cookies.
//
// For more info, see:
// https://electronjs.org/docs/api/cookies

const { app, BrowserWindow, session } = require('electron/main')

app.whenReady().then(() => {
  const mainWindow = new BrowserWindow({
    height: 600,
    width: 600
  })

  // Once the window has finished loading, let's check out
  // the cookies
  mainWindow.webContents.on('did-finish-load', async () => {
    // Query all cookies.
    try {
      const cookies = await session.defaultSession.cookies.get({})
      console.log(cookies)
    } catch (error) {
      console.error(error)
    }

    // Query all cookies associated with a specific url.
    try {
      const cookies = await session.defaultSession.cookies.get({ url: 'http://www.github.com' })
      console.log(cookies)
    } catch (error) {
      console.error(error)
    }

    // Set a cookie with the given cookie data;
    // may overwrite equivalent cookies if they exist.
    try {
      const cookie = { url: 'http://www.github.com', name: 'dummy_name', value: 'dummy' }
      await session.defaultSession.cookies.set(cookie)
    } catch (error) {
      console.error(error)
    }
  })

  mainWindow.loadURL('https://electronjs.org')
})
