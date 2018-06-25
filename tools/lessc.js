/* tslint:disable */

const { run } = require('./run-bin');

async function compileLess() {
  const args = [
    '--source-map-inline',
    './src/less/root.less',
    './static/css/root.css'
  ];

  await run('Less','lessc', args);
};

module.exports = {
  compileLess
}

if (require.main === module) compileLess();
