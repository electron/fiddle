// The inAppPurchase module enables in-app purchases in the Mac App Store.
//
// This example will not work when run with Electron Fiddle, since the
// needs to be packaged for and published in the Mac App Store.
//
// For more info, see:
// https://electronjs.org/docs/api/in-app-purchase

const { app, inAppPurchase } = require('electron')

app.on('ready', () => {
  // Can the user can make a payment?
  if (inAppPurchase.canMakePayments()) {
    const productID = 'myProductId'
    const quantity = 1

    // Let's go shopping!
    inAppPurchase.purchaseProduct(productID, quantity)
  }
})
