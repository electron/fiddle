// Manage browser sessions, cookies, cache, proxy settings, etc.
//
// For more info, see:
// https://electronjs.org/docs/api/session

const { app, session } = require('electron')

app.on('ready', () => {
  const { defaultSession } = session

  // There are quite a few methods available
  // on the session object, here are just two
  // examples:

  // Current user agent
  console.log(defaultSession.getUserAgent())

  // Cache Size
  defaultSession.getCacheSize((result) => {
    console.log(result)
  })
})
