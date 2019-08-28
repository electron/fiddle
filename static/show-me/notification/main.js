// Create OS desktop notifications
//
// For more info, see:
// https://electronjs.org/docs/api/notification
// https://electronjs.org/docs/tutorial/notifications

const { app, BrowserWindow, Notification } = require('electron')

let mainWindow = null

app.on('ready', () => {
  mainWindow = new BrowserWindow({
    height: 600,
    width: 600,
    webPreferences: {
      nodeIntegration: true
    }
  })

  if (Notification.isSupported()) {
    const notification = new Notification({
      title: 'Hello World!',
      subtitle: 'Nice to see you',
      body: 'Are you having a good day?',
      hasReply: true
    })

    notification.on('show', () => console.log('Notification shown'))
    notification.on('click', () => console.log('Notification clicked'))
    notification.on('close', () => console.log('Notification closed'))
    notification.on('reply', (event, reply) => {
      console.log(`Reply: ${reply}`)
    })

    notification.show()
  } else {
    console.log('Hm, are notifications supported on this system?')
  }

  mainWindow.loadFile('index.html')
})
