const { ModuleFederationPlugin } = require('webpack').container;
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
// SPABench App B — mfe-orders webpack config, port 3012
module.exports = {
  mode:'production', entry:'./src/main.ts',
  output:{ path:path.resolve(__dirname,'../../dist/mfe-orders'), filename:'main.js',
    publicPath:'http://localhost:3012/', sourceMapFilename:'[file].map', uniqueName:'mfeOrders' },
  devtool:'source-map', resolve:{ extensions:['.ts','.js'] },
  module:{ rules:[{ test:/\.tsx?$/, use:'ts-loader', exclude:/node_modules/ }] },
  plugins:[
    new ModuleFederationPlugin({ name:'mfeOrders', filename:'remoteEntry.js',
      exposes:{ './OrdersModule':'./src/app/orders.module.ts' },
      shared:{ '@angular/core':{singleton:true}, '@angular/common':{singleton:true},
        '@angular/common/http':{singleton:true}, '@angular/router':{singleton:true}, rxjs:{singleton:true} } }),
    new HtmlWebpackPlugin({ template:'./src/index.html', filename:'index.html' })
  ],
};