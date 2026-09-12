import type IForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import { ProvidePlugin } from 'webpack';

const ForkTsCheckerWebpackPlugin: typeof IForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

export const plugins = [
  new ForkTsCheckerWebpackPlugin({
    logger: 'webpack-infrastructure',
  }),
  new ProvidePlugin({
    __importStar: ['tslib', '__importStar'],
  }),
];
