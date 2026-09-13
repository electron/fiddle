const { desktopCapturer, ipcRenderer } = require('electron/renderer')

// The following example shows how to capture video from
// the screen. It also grabs each window, so you could
// just grab video from a single window.
//

function startCapture () {
  desktopCapturer.getSources({
    types: ['window', 'screen']
  }).then(async sources => {
    for (let i = 0; i < sources.length; ++i) {
      console.log(sources[i])
      if (sources[i].id.startsWith('screen')) {
        showStream(sources[i].id)
      }
    }
  })
}

async function showStream (sourceId) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
          minWidth: 1280,
          maxWidth: 1280,
          minHeight: 720,
          maxHeight: 720
        }
      }
    })
    handleStream(stream)
  } catch (e) {
    handleError(e)
  }
}

function handleStream (stream) {
  const video = document.querySelector('video')
  video.srcObject = stream
  video.onloadedmetadata = (e) => video.play()
}

function handleError (e) {
  console.log(e)
}

if (parseInt(process.versions.electron) >= 17) {
  ipcRenderer.on('SET_SOURCE', async (event, sourceId) => {
    showStream(sourceId)
  })
} else {
  window.addEventListener('DOMContentLoaded', () => {
    startCapture()
  })
}
