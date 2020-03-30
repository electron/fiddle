// Collect tracing data from Chromium's content module for finding performance
// bottlenecks and slow operations.
//
// This module does not include a web interface so you need to open
// chrome://tracing/ in a Chrome browser and load the generated file to view
// the result.
//
// For more info, see:
// https://electronjs.org/docs/api/content-tracing

const { app, contentTracing } = require('electron')

app.on('ready', () => {
  const options = {
    categoryFilter: '*',
    traceOptions: 'record-until-full,enable-sampling'
  }

  contentTracing.startRecording(options, () => {
    console.log('Tracing started')

    setTimeout(() => {
      contentTracing.stopRecording('', (path) => {
        console.log('Tracing data recorded to ' + path)
      })
    }, 5000)
  })
})
