module.exports = [
  // Add support for native node modules
  {
    // We're specifying native_modules in the test because the asset relocator loader generates a
    // "fake" .node file which is really a cjs file.
    test: /native_modules\/.+\.node$/,
    use: 'node-loader',
  },
  {
    test: /\.(m?js|node)$/,
    parser: { amd: false },
    use: {
      loader: '@vercel/webpack-asset-relocator-loader',
      options: {
        outputAssetBase: 'native_modules',
      },
    },
  },
  {
    test: /\.tsx?$/,
    exclude: /(node_modules|\.webpack)/,
    use: {
      loader: 'ts-loader',
      options: {
        transpileOnly: true,
      },
    },
  },
  // TODO: Figure out the best way to handle assests.
  // {
  //   test: /\.(gif|icns|ico|jpg|png|otf|eot|woff|woff2|ttf)$/,
  //   type: 'asset/resource',
  // },
  // {
  //   test: /\.(ttf|eot|svg)$/,
  //   use: {
  //     loader: 'file-loader',
  //     options: {
  //       name: 'fonts/[hash].[ext]',
  //     },
  //   },
  // },
  // {
  //   test: /\.(woff|woff2)$/,
  //   use: {
  //     loader: 'url-loader',
  //     options: {
  //       name: 'fonts/[hash].[ext]',
  //       limit: 5000,
  //       mimetype: 'application/font-woff',
  //     },
  //   },
  // },
];
