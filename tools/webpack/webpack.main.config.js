const plugins = require('./common/webpack.plugins');
const rules = require('./common/webpack.rules');
const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: './src/main/main.ts',
  module: {
    rules,
  },
  devtool: 'source-map',
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  // https://webpack.js.org/configuration/optimization/#optimizationnodeenv
  plugins: [
    ...plugins,
    new CopyPlugin({
      patterns: [
        {
          from: 'static/electron-quick-start',
          to: '../static/electron-quick-start',
        },
        { from: 'static/show-me', to: '../static/show-me' },
        { from: 'assets/icons/fiddle.png', to: '../assets/icons/fiddle.png' },
      ],
    }),
  ],
  externals: [
    nodeExternals({
      modulesFromFile: true,
    }),
  ],
  optimization: {
    nodeEnv: false,
    minimize: true,
    minimizer: [
      new TerserPlugin({
        // We don't want to minimize the files - electron-quick-start/* and show-me/*
        exclude: /static/,
      }),
    ],
  },
};
