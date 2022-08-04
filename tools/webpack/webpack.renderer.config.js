const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

const plugins = require('./common/webpack.plugins');
const rules = require('./common/webpack.rules');

module.exports = {
  module: {
    rules: [
      ...rules,
      // Handling styles
      {
        test: /\.css$/,
        use: [
          { loader: MiniCssExtractPlugin.loader },
          { loader: 'css-loader' },
        ],
      },
      {
        test: /\.less$/i,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
          },
          {
            loader: 'css-loader',
          },
          {
            // Used to load the url loaders present in blueprintjs (/resources/icons)
            loader: 'resolve-url-loader',
          },
          {
            loader: 'less-loader',
            options: {
              lessOptions: {
                // Used to evaluate css function (https://github.com/palantir/blueprint/issues/5011).
                math: 'always',
              },
            },
          },
        ],
      },
      // Handling assets
      {
        test: /\.(jpe?g|svg|png|gif|ico)(\?v=\d+\.\d+\.\d+)?$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/[name][ext]',
        },
      },
      {
        test: /\.(eot|ttf|woff2?)(\?v=\d+\.\d+\.\d+)?$/i,
        type: 'asset/resource',
        generator: {
          filename: 'fonts/[name][ext]',
        },
      },
    ],
  },
  plugins: [
    ...plugins,
    new MonacoWebpackPlugin({
      languages: ['typescript', 'javascript', 'html', 'css'],
    }),
    new MiniCssExtractPlugin({
      filename: './css/[name].css',
      // https://github.com/webpack-contrib/mini-css-extract-plugin#experimentalUseImportModule
      experimentalUseImportModule: false,
    }),
  ],
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.json'],
    alias: {
      'monaco-editor': 'monaco-editor/esm/vs/editor/editor.api.js',
    },
  },
  devtool: 'source-map',
};
