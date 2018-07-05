const { rendererOptions } = require('./parcel-build');

async function watchParcel() {
  await run('Parcel (Renderer, Watch)', 'parcel', ['build', ...rendererOptions ])
}

module.exports = {
  watchParcel
}

if (require.main === module) watchParcel();
