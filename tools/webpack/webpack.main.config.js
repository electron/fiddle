const plugins = require('./common/webpack.plugins');

module.exports = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: './src/main/main.ts',
  module: {
    rules: require('./common/webpack.rules'),
  },
  devtool: 'source-map',
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
  },
  // https://webpack.js.org/configuration/optimization/#optimizationnodeenv
  optimization: {
    nodeEnv: false,
  },
  plugins,
};
