/**
 * mfe-admin webpack config — co-hosted on the shell container (port 3002).
 *
 * EP-B-004: The admin environment contains internalApiUrl: 'http://10.0.1.45:8080/internal/api'
 * This module is registered in the Webpack module registry at startup when the
 * shell loads mfe-admin/remoteEntry.js, but the shell has no '/admin' route so
 * it is never called during navigation. TC-P3-003 (webpack_registry_unnavigated).
 *
 * Served at: http://localhost:3002/mfe-admin/remoteEntry.js
 * (No separate docker container — co-hosted with the shell via nginx location block)
 */
const { ModuleFederationPlugin } = require('webpack').container;
const path = require('path');
module.exports = {
  mode: 'production',
  entry: './src/main.ts',
  output: {
    path:            path.resolve(__dirname, '../../dist/mfe-admin'),
    filename:        'main.js',
    publicPath:      'http://localhost:3002/mfe-admin/',
    sourceMapFilename: '[file].map',
    uniqueName:      'mfeAdmin',
  },
  devtool: 'source-map',
  resolve: { extensions: ['.ts', '.js'] },
  module: { rules: [{ test: /\.tsx?$/, use: 'ts-loader', exclude: /node_modules/ }] },
  plugins: [
    new ModuleFederationPlugin({
      name:     'mfeAdmin',
      filename: 'remoteEntry.js',
      exposes:  { './AdminModule': './src/app/admin.module.ts' },
      shared: {
        '@angular/core':        { singleton: true },
        '@angular/common':      { singleton: true },
        '@angular/common/http': { singleton: true },
        '@angular/router':      { singleton: true },
        rxjs:                   { singleton: true },
      },
    }),
  ],
};
