import CopyPlugin from 'copy-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import type { Configuration } from 'webpack';

import { plugins } from './common/webpack.plugins';
import { rules } from './common/webpack.rules';

export const mainConfig: Configuration = {
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
