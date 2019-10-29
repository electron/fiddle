module.exports = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: './src/main/main.ts',
  // Put your normal webpack config below here
  module: {
    rules: require('./webpack.rules'),
  },
  resolve: {
    /**
     * Determines which file extensions are okay to leave off from
     * the ends of require / import paths. Has no impact on what file types
     * webpack will process.
     *
     * For example:
     *
     * import { logger } from './logger';
     *
     * Instead of:
     *
     * import { logger } from './logger.ts';
     */
    extensions: [ '.ts', '.tsx', '.js', '.jsx', '.json' ],
  }
};
