// The "autoUpdater" module enables apps to automatically update themselves.
//
// For more info, see:
// https://electronjs.org/docs/api/auto-updater

const { app, autoUpdater } = require('electron')

app.on('ready', () => {
  const server = 'https://your-deployment-url.com'
  const feed = `${server}/update/${process.platform}/${app.getVersion()}`

  // The following code won't work unless the app has been packaged.
  // You should only use the autoUpdater with packaged and code-signed
  // versions of your application.
  try {
    autoUpdater.setFeedURL(feed)
  } catch (error) {
    console.log(error)
  }

  // Once you've done that, you can go ahead and ask for updates:
  // autoUpdater.checkForUpdates()

  autoUpdater.on('checking-for-update', () => {
    console.log('The autoUpdater is checking for an update')
  })

  autoUpdater.on('update-available', () => {
    console.log('The autoUpdater has found an update!')
  })

  autoUpdater.on('update-available', () => {
    console.log('The autoUpdater has found an update and is now downloading it!')
  })

  autoUpdater.on('update-not-available', () => {
    console.log('The autoUpdater has not found any updates :(')
  })

  autoUpdater.on('update-downloaded', (event, notes, name, date) => {
    console.log('The autoUpdater has downloaded an update!')
    console.log(`The new release is named ${name} and was released on ${date}`)
    console.log(`The release notes are: ${notes}`)

    // The update will automatically be installed the next time the
    // app launches. If you want to, you can force the installation
    // now:
    autoUpdater.quitAndInstall()
  })
})
