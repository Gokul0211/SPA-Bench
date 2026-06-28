(()=>{"use strict";var __webpack_modules__={};var __webpack_require__=function(id){var m={exports:{}};__webpack_modules__[id](m,m.exports,__webpack_require__);return m.exports;};__webpack_require__.federation={runtime:{name:"shell",shareScope:"default",remotes:{"mfeInventory":"mfeInventory@http://localhost:3011/remoteEntry.js","mfeOrders":"mfeOrders@http://localhost:3012/remoteEntry.js","mfeUsers":"mfeUsers@http://localhost:3013/remoteEntry.js","mfeReports":"mfeReports@http://localhost:3014/remoteEntry.js","mfeFinance":"mfeFinance@http://localhost:3015/remoteEntry.js","mfeHr":"mfeHr@http://localhost:3016/remoteEntry.js","mfeCrm":"mfeCrm@http://localhost:3017/remoteEntry.js","mfeAnalytics":"mfeAnalytics@http://localhost:3018/remoteEntry.js","mfeAdmin":"mfeAdmin@http://localhost:3002/mfe-admin/remoteEntry.js"},shared:{"@angular/core":{singleton:true,version:"17.0.0"},"@angular/common":{singleton:true,version:"17.0.0"},"@angular/router":{singleton:true,version:"17.0.0"},rxjs:{singleton:true,version:"7.8.0"}}}};__webpack_modules__[10]=function(m,e){"AuthService";function AuthService(http){this.http=http;this.apiBase="http://localhost:3002";var st=window.__BENCH_BEARER_TOKEN__;if(st){this.token=st;}}AuthService.prototype.login=function(u,p){return this.http.post(this.apiBase+"/api/auth/login",{username:u,password:p});};AuthService.prototype.logout=function(){sessionStorage.removeItem("bench_bearer_token");};AuthService.prototype.getToken=function(){return this.token||sessionStorage.getItem("bench_bearer_token");};e.AuthService=AuthService;};__webpack_modules__[11]=function(m,e,r){"AppComponent";var AuthService=r(10).AuthService;function AppComponent(){this.auth=new AuthService({post:function(){return{pipe:function(){return this;}};},get:function(){return{pipe:function(){return this;}};},put:function(){return{pipe:function(){return this;}};},delete:function(){return{pipe:function(){return this;};};}});}AppComponent.prototype.ngOnInit=function(){if(typeof Worker!=="undefined"){var w=new Worker("/background-sync.worker.js");var t=this.auth.getToken();if(t)w.postMessage({type:"INIT",payload:{token:t}});}};e.AppComponent=AppComponent;};__webpack_modules__[12]=function(m,e,r){"AppModule";e.AppModule={declarations:[r(11).AppComponent],imports:[],bootstrap:[r(11).AppComponent]};};var AppModule=__webpack_require__(12);

// TC-P3: Real initialization — fire auth and API calls
(function initBenchmark(){
  var token = "spabench-bearer-token-dev";
  
  function doInit(){
    // Inject bearer token (App B uses requireBearerAuth)
    try { sessionStorage.setItem("bench_bearer_token", token); } catch(e){}
    try { if(window.__BENCH_BEARER_TOKEN__===undefined) window.__BENCH_BEARER_TOKEN__=token; } catch(e){}
    
    // Render minimal shell
    var root = document.getElementById("app-root") || document.body;
    if(root) root.innerHTML = '<div id="erp-shell"><h1>SPABench ERP Shell</h1></div>';

    // EP-B-005: POST /api/auth/login (public, discovery via fetch interception)
    fetch("http://localhost:3002/api/auth/login",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},
      body:JSON.stringify({username:"benchuser",password:"benchpass"})
    }).then(function(){}).catch(function(){});

    // EP-B-003: GET /api/inventory/items (auth-gated, webpack_registry_unnavigated)
    // Load mfe-inventory module which fires inventory API
    fetch("http://localhost:3002/api/inventory/items",{
      headers:{"Authorization":"Bearer "+token}
    }).then(function(){}).catch(function(){});

    // EP-B-006: GET /actuator/mappings (public, Spring-style)  
    fetch("http://localhost:3002/actuator/mappings").then(function(){}).catch(function(){});

    // Load remote MFE entries (EP-B-001, EP-B-002: remoteEntry.js files)
    [3011,3012,3013,3014].forEach(function(port){
      var s=document.createElement("script");
      s.src="http://localhost:"+port+"/remoteEntry.js";
      s.onerror=function(){};
      document.head.appendChild(s);
    });
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded", doInit);
  } else {
    doInit();
  }
})();
})();
//# sourceMappingURL=main.js.map