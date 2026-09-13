// Main process: the window Lucent expects. Verify each option on each OS.
const win = new BrowserWindow({
  width: 1280, height: 820, minWidth: 880, minHeight: 560,
  backgroundColor: '#00000000',
  // macOS
  titleBarStyle: 'hiddenInset',
  trafficLightPosition: { x: 20, y: 22 },
  vibrancy: 'under-window',
  visualEffectState: 'followWindow',
  // Windows 11: titleBarStyle 'hidden', backgroundMaterial 'acrylic',
  // titleBarOverlay { color: '#00000000', symbolColor: ink, height: 56 }
})
