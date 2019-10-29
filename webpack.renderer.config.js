const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const webpack = require('webpack');

const rules = require('./webpack.rules');

rules.push({
  test: /\.css$/,
  use: [
    { loader: MiniCssExtractPlugin.loader },
    { loader: 'css-loader' }
  ],
});

rules.push({
  test: /\.less$/,
  use: [
    { loader: MiniCssExtractPlugin.loader },
    { loader: 'css-loader' },
    {
      loader: 'less-loader',
      options: {
        noIeCompat: true
      }
    }
  ],
});

rules.push({
  test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
  loader: 'file-loader',
  options: {
    name: '[name].[ext]',
    outputPath: 'fonts/'
  }
});

module.exports = {
  // Put your normal webpack config below here
  module: {
    rules,
  },
  resolve: {
    alias: {
      'monaco-editor': 'monaco-editor/esm/vs/editor/editor.api'
    },
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
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  plugins: [
    new MonacoWebpackPlugin({
      languages: [
        'typescript',
        'javascript',
        'html',
        'css'
      ]
    }),
    new BundleAnalyzerPlugin(),
    new MiniCssExtractPlugin({
      filename: "./css/[name].css"
    }),
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1
    })
  ],
  externals: {
    'es6-promise': 'es6-promise'
  }
};
