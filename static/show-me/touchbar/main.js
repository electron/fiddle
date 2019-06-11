// Create TouchBar layouts for native macOS applications
//
// For more info, see:
// https://electronjs.org/docs/api/touch-bar

const { app, BrowserWindow, TouchBar } = require('electron')
const { TouchBarLabel, TouchBarButton, TouchBarSpacer } = TouchBar

let mainWindow = null

app.on('ready', () => {
  mainWindow = new BrowserWindow({ height: 600, width: 600 })
  mainWindow.loadFile('index.html')

  // This API only works on macOS devices with a TouchBar.
  if (process.platform !== 'darwin') return

  let spinning = false

  // Reel labels
  const reel1 = new TouchBarLabel()
  const reel2 = new TouchBarLabel()
  const reel3 = new TouchBarLabel()

  // Spin result label
  const result = new TouchBarLabel()

  // Spin button
  const spin = new TouchBarButton({
    label: '🎰 Spin',
    backgroundColor: '#7851A9',
    click: () => {
      // Ignore clicks if already spinning
      if (spinning) {
        return
      }

      spinning = true
      result.label = ''

      let timeout = 10
      const spinLength = 4 * 1000 // 4 seconds
      const startTime = Date.now()

      const spinReels = () => {
        updateReels()

        if ((Date.now() - startTime) >= spinLength) {
          finishSpin()
        } else {
          // Slow down a bit on each spin
          timeout *= 1.1
          setTimeout(spinReels, timeout)
        }
      }

      spinReels()
    }
  })

  const getRandomValue = () => {
    const values = ['🍒', '💎', '7️⃣', '🍊', '🔔', '⭐', '🍇', '🍀']
    return values[Math.floor(Math.random() * values.length)]
  }

  const updateReels = () => {
    reel1.label = getRandomValue()
    reel2.label = getRandomValue()
    reel3.label = getRandomValue()
  }

  const finishSpin = () => {
    const uniqueValues = new Set([reel1.label, reel2.label, reel3.label]).size
    if (uniqueValues === 1) {
      // All 3 values are the same
      result.label = '💰 Jackpot!'
      result.textColor = '#FDFF00'
    } else if (uniqueValues === 2) {
      // 2 values are the same
      result.label = '😍 Winner!'
      result.textColor = '#FDFF00'
    } else {
      // No values are the same
      result.label = '🙁 Spin Again'
      result.textColor = null
    }
    spinning = false
  }

  const touchBar = new TouchBar({
    items: [
      spin,
      new TouchBarSpacer({ size: 'large' }),
      reel1,
      new TouchBarSpacer({ size: 'small' }),
      reel2,
      new TouchBarSpacer({ size: 'small' }),
      reel3,
      new TouchBarSpacer({ size: 'large' }),
      result
    ]
  })

  mainWindow.setTouchBar(touchBar)
})
