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
