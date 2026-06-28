/**
 * SPABench App B — mfe-inventory Webpack 5 Module Federation config
 *
 * This MFE runs on port 3011 and exposes InventoryModule.
 * EP-B-001: http://localhost:3011/remoteEntry.js
 *
 * TC-P1-011 / TC-P1-012:
 *   The shell fetches this remoteEntry.js at startup. When loaded, all modules
 *   in this bundle are registered into the shared __webpack_modules__ table.
 *   InventoryService (inventory.service.ts) becomes __webpack_modules__[847].
 *
 * TC-P3-003 (webpack_registry_unnavigated):
 *   Module 847 (InventoryService) is registered but the shell router has no
 *   '/inventory' route — the module is never called during navigation.
 */
const { ModuleFederationPlugin } = require('webpack').container;
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

module.exports = (env) => ({
  mode: 'production',
  entry: './src/main.ts',

  output: {
    path: path.resolve(__dirname, '../../dist/mfe-inventory'),
    filename: 'main.js',
    publicPath: `http://localhost:${process.env.PORT || 3011}/`,
    sourceMapFilename: '[file].map',
    uniqueName: 'mfeInventory',
  },

  devtool: 'source-map',

  resolve: { extensions: ['.ts', '.js'] },

  module: {
    rules: [{ test: /\.tsx?$/, use: 'ts-loader', exclude: /node_modules/ }],
  },

  plugins: [
    new ModuleFederationPlugin({
      name: 'mfeInventory',
      filename: 'remoteEntry.js',
      exposes: {
        './InventoryModule': './src/app/inventory.module.ts',
      },
      shared: {
        '@angular/core':        { singleton: true, strictVersion: false },
        '@angular/common':      { singleton: true, strictVersion: false },
        '@angular/common/http': { singleton: true, strictVersion: false },
        '@angular/router':      { singleton: true, strictVersion: false },
        'rxjs':                 { singleton: true, strictVersion: false },
      },
    }),
    new HtmlWebpackPlugin({ template: './src/index.html', filename: 'index.html' }),
  ],
});
