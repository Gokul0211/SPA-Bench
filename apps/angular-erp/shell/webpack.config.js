/**
 * SPABench App B — Angular ERP Shell
 * Webpack 5 configuration with Module Federation plugin.
 *
 * TC-P1-011 (module_federation_remote_entry):
 *   Tools must parse the ModuleFederationPlugin `remotes` object to discover
 *   EP-B-001 (http://localhost:3011/remoteEntry.js) and
 *   EP-B-002 (http://localhost:3012/remoteEntry.js), plus all other remotes.
 *   A standard script-tag crawler will find only index.html → main.js → bootstrap.
 *   The remote URLs never appear as <script src> tags — they are loaded by the
 *   Webpack federation runtime from the configuration registered here.
 *
 * TC-P1-012 (module_federation_html_parse):
 *   After discovering a remoteEntry.js URL, tools must also fetch the MFE's
 *   index.html (e.g. http://localhost:3011/index.html) and parse it for
 *   additional script references and meta-information.
 *
 * source_maps_exposed: true — see output.sourceMapFilename below.
 */

const { ModuleFederationPlugin } = require('webpack').container;
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/main.ts',

  output: {
    path: path.resolve(__dirname, '../dist/shell'),
    filename: 'main.js',
    publicPath: 'http://localhost:3002/',
    // Source maps exposed for TC-P1.5-* (sourcemap_probe_standard, ts_service_file_recovery)
    sourceMapFilename: '[file].map',
  },

  devtool: 'source-map',

  resolve: {
    extensions: ['.ts', '.js'],
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },

  plugins: [
    new ModuleFederationPlugin({
      name: 'shell',

      // ── Remote entry points (TC-P1-011) ──────────────────────────────────
      // Each value follows the format: `<scopeName>@<remoteEntryUrl>`
      // The Webpack federation runtime fetches each remoteEntry.js at startup,
      // which registers all modules from the remote into __webpack_modules__.
      // EP-B-001: mfe-inventory runs on port 3011
      // EP-B-002: mfe-orders    runs on port 3012
      remotes: {
        mfeInventory: 'mfeInventory@http://localhost:3011/remoteEntry.js',
        mfeOrders:    'mfeOrders@http://localhost:3012/remoteEntry.js',
        mfeUsers:     'mfeUsers@http://localhost:3013/remoteEntry.js',
        mfeReports:   'mfeReports@http://localhost:3014/remoteEntry.js',
        mfeFinance:   'mfeFinance@http://localhost:3015/remoteEntry.js',
        mfeHr:        'mfeHr@http://localhost:3016/remoteEntry.js',
        mfeCrm:       'mfeCrm@http://localhost:3017/remoteEntry.js',
        mfeAnalytics: 'mfeAnalytics@http://localhost:3018/remoteEntry.js',
        // mfe-admin is co-hosted on this server (port 3002) at /mfe-admin/*.
        // It exposes LegacyReportService which ends up registered in the
        // __webpack_modules__ table but is never reachable via navigation —
        // satisfying TC-P3-003 (webpack_registry_unnavigated) for EP-B-004.
        mfeAdmin:     'mfeAdmin@http://localhost:3002/mfe-admin/remoteEntry.js',
      },

      // Shared dependencies — Angular core modules shared across shell + all MFEs
      shared: {
        '@angular/core':          { singleton: true, strictVersion: false, requiredVersion: '^17.0.0' },
        '@angular/common':        { singleton: true, strictVersion: false, requiredVersion: '^17.0.0' },
        '@angular/common/http':   { singleton: true, strictVersion: false, requiredVersion: '^17.0.0' },
        '@angular/router':        { singleton: true, strictVersion: false, requiredVersion: '^17.0.0' },
        'rxjs':                   { singleton: true, strictVersion: false, requiredVersion: '^7.0.0' },
      },
    }),

    new HtmlWebpackPlugin({
      template: './src/index.html',
      filename: 'index.html',
    }),
  ],
};
