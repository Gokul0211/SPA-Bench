const { ModuleFederationPlugin } = require('webpack').container;
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
// SPABench App B — mfe-crm webpack config, port 3017
module.exports = {
  mode:'production', entry:'./src/main.ts',
  output:{ path:path.resolve(__dirname,'../../dist/mfe-crm'), filename:'main.js',
    publicPath:'http://localhost:3017/', sourceMapFilename:'[file].map', uniqueName:'mfeCrm' },
  devtool:'source-map', resolve:{ extensions:['.ts','.js'] },
  module:{ rules:[{ test:/\.tsx?$/, use:'ts-loader', exclude:/node_modules/ }] },
  plugins:[
    new ModuleFederationPlugin({ name:'mfeCrm', filename:'remoteEntry.js',
      exposes:{ './CrmModule':'./src/app/crm.module.ts' },
      shared:{ '@angular/core':{singleton:true}, '@angular/common':{singleton:true},
        '@angular/common/http':{singleton:true}, '@angular/router':{singleton:true}, rxjs:{singleton:true} } }),
    new HtmlWebpackPlugin({ template:'./src/index.html', filename:'index.html' })
  ],
};