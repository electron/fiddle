const { remote } = require('electron')

// The BrowserWindow module can only be used from
// the main process, but thanks to the remote, we
// can create one from this renderer process.

const myWindow = new remote.BrowserWindow()
console.log(myWindow)

// Let's open developer tools
remote
  .getCurrentWebContents()
  .toggleDevTools()

console.log(remote)
