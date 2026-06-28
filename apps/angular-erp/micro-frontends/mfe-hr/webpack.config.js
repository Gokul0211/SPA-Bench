const { ModuleFederationPlugin } = require('webpack').container;
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
// SPABench App B — mfe-hr webpack config, port 3016
module.exports = {
  mode:'production', entry:'./src/main.ts',
  output:{ path:path.resolve(__dirname,'../../dist/mfe-hr'), filename:'main.js',
    publicPath:'http://localhost:3016/', sourceMapFilename:'[file].map', uniqueName:'mfeHr' },
  devtool:'source-map', resolve:{ extensions:['.ts','.js'] },
  module:{ rules:[{ test:/\.tsx?$/, use:'ts-loader', exclude:/node_modules/ }] },
  plugins:[
    new ModuleFederationPlugin({ name:'mfeHr', filename:'remoteEntry.js',
      exposes:{ './HrModule':'./src/app/hr.module.ts' },
      shared:{ '@angular/core':{singleton:true}, '@angular/common':{singleton:true},
        '@angular/common/http':{singleton:true}, '@angular/router':{singleton:true}, rxjs:{singleton:true} } }),
    new HtmlWebpackPlugin({ template:'./src/index.html', filename:'index.html' })
  ],
};