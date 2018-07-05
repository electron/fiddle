const { run } = require('./run-bin');
const { rendererOptions } = require('./parcel-build');

async function watchParcel() {
  await run('Parcel (Renderer, Watch)', 'parcel', [ 'watch', ...rendererOptions ])
}

module.exports = {
  watchParcel
}

if (require.main === module) watchParcel();
