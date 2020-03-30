// Issue HTTP/HTTPS requests using Chromium's native networking library.
//
// The net module is a client-side API for issuing HTTP(S) requests. It
// is similar to the HTTP and HTTPS modules of Node.js but uses Chromium's
// native networking library instead of the Node.js implementation, offering
// better support for web proxies.
//
// For more info, see:
// https://electronjs.org/docs/api/net

const { app, net } = require('electron')

app.on('ready', () => {
  const request = net.request('https://github.com')

  request.on('response', (response) => {
    console.log(`STATUS: ${response.statusCode}`)
    console.log(`HEADERS: ${JSON.stringify(response.headers)}`)

    response.on('data', (chunk) => {
      console.log(`BODY: ${chunk}`)
    })

    response.on('end', () => {
      console.log('No more data in the response.')
    })
  })

  request.end()
})
