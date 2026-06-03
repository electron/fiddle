import CopyPlugin from 'copy-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import type { Configuration } from 'webpack';

import { plugins } from './common/webpack.plugins';
import { rules } from './common/webpack.rules';

export const mainConfig = (
  _env: unknown,
  args: Record<string, unknown>,
): Configuration => {
  const isDev = args.mode !== 'production';

  return {
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
      extensionAlias: {
        '.js': ['.js', '.ts'],
      },
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
          {
            from: 'assets/icons/fiddle.png',
            to: '../assets/icons/fiddle.png',
          },
          {
            from: 'node_modules/sfw/dist/sfw.mjs',
            to: '../sfw/dist/sfw.mjs',
          },
          {
            from: 'node_modules/sfw/package.json',
            to: '../sfw/package.json',
          },
          // namor v3 reads its word lists from disk at runtime via
          // `fs.readFileSync(path.resolve(__dirname, '../dict', ...))`. When
          // bundled, __dirname is `.webpack/main`, so the dict files need to
          // live at `.webpack/dict` for namor to find them.
          {
            from: 'node_modules/namor/dict',
            to: '../dict',
          },
        ],
      }),
    ],
    optimization: {
      nodeEnv: false,
      minimize: !isDev,
      minimizer: [
        new TerserPlugin({
          // We don't want to minimize the files - electron-quick-start/* and show-me/*
          exclude: /static/,
        }),
      ],
    },
    cache: isDev ? { type: 'filesystem' } : false,
  };
};
