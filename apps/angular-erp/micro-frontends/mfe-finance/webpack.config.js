const { ModuleFederationPlugin } = require('webpack').container;
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
// SPABench App B — mfe-finance webpack config, port 3015
module.exports = {
  mode:'production', entry:'./src/main.ts',
  output:{ path:path.resolve(__dirname,'../../dist/mfe-finance'), filename:'main.js',
    publicPath:'http://localhost:3015/', sourceMapFilename:'[file].map', uniqueName:'mfeFinance' },
  devtool:'source-map', resolve:{ extensions:['.ts','.js'] },
  module:{ rules:[{ test:/\.tsx?$/, use:'ts-loader', exclude:/node_modules/ }] },
  plugins:[
    new ModuleFederationPlugin({ name:'mfeFinance', filename:'remoteEntry.js',
      exposes:{ './FinanceModule':'./src/app/finance.module.ts' },
      shared:{ '@angular/core':{singleton:true}, '@angular/common':{singleton:true},
        '@angular/common/http':{singleton:true}, '@angular/router':{singleton:true}, rxjs:{singleton:true} } }),
    new HtmlWebpackPlugin({ template:'./src/index.html', filename:'index.html' })
  ],
};