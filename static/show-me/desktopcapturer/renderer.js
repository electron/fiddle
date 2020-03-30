const { desktopCapturer } = require('electron')

// The following example shows how to capture video from
// the screen. It also grabs each window, so you could
// just grab video from a single window.
//
desktopCapturer.getSources({
  types: ['window', 'screen']
}, (error, sources) => {
  if (error) throw error
  for (let i = 0; i < sources.length; ++i) {
    console.log(sources[i])

    if (sources[i].id.startsWith('screen')) {
      navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sources[i].id,
            minWidth: 1280,
            maxWidth: 1280,
            minHeight: 720,
            maxHeight: 720
          }
        }
      }).then((stream) => handleStream(stream))
        .catch((error) => console.log(error))
    }
  }
})

function handleStream (stream) {
  const video = document.querySelector('video')
  video.srcObject = stream
  video.onloadedmetadata = (e) => video.play()
}
