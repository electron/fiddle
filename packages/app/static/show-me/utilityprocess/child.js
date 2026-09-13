process.parentPort.on('message', (e) => {
  if (e.data === 'Hello from parent!') {
    process.parentPort.postMessage('Hello from child!')
  }
})
