const rules = require('./common/webpack.rules');
const plugins = require('./common/webpack.plugins');

rules.push(
  {
    test: /\.css$/,
    use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
  },
  {
    test: /\.less$/i,
    use: [
      {
        loader: 'style-loader',
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
);

module.exports = {
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.less'],
  },
  devtool: 'source-map',
};
