!function(e){var t={};function n(r){if(t[r])return t[r].exports;var o=t[r]={i:r,l:!1,exports:{}};return e[r].call(o.exports,o,o.exports,n),o.l=!0,o.exports}n.m=e,n.c=t,n.d=function(e,t,r){n.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:r})},n.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},n.t=function(e,t){if(1&t&&(e=n(e)),8&t)return e;if(4&t&&"object"==typeof e&&e&&e.__esModule)return e;var r=Object.create(null);if(n.r(r),Object.defineProperty(r,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var o in e)n.d(r,o,function(t){return e[t]}.bind(null,o));return r},n.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return n.d(t,"a",t),t},n.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},n.p="",n(n.s=0)}([function(e,t,n){"use strict";n.r(t);var r=n(1),o=n(2),i=n(3),a=n(4),s=n(5),c=n(6),l=n(7),u=n(8),d=n(9);angular.bootstrap&&angular.bootstrap(document,["spabench-permit-app"]);},function(e,t,n){"use strict";var r=n(10);function c(){this.e=r.environment.apiBaseUrl,this.f=r.environment.stagingApiUrl||"",this.g=r.environment.oauthTokenEndpoint||""}c.prototype.getApiBase=function(){return this.e};c.prototype.getStagingBase=function(){return this.f};c.prototype.getOAuthEndpoint=function(){return this.g};c.prototype.getFeatureFlags=function(){return r.environment.featureFlags};c.ctorParameters=function(){return[]};c.ngInjectableDef=i.defineInjectable({factory:function(){return new c},token:c,providedIn:"root"});t.AppConfigService=c;},function(e,t,n){"use strict";var r=n(1),o=n(11);function m(e,t){this.s=e,this.h=t}m.prototype.getBase=function(){return this.s.getApiBase()};m.prototype.getStagingBase=function(){return this.s.getStagingBase()};m.prototype.get=function(e,t){return this.h.get(this.getBase()+e,{headers:this.j(),params:t})};m.prototype.post=function(e,t){return this.h.post(this.getBase()+e,t,{headers:this.j()})};m.prototype.put=function(e,t){return this.h.put(this.getBase()+e,t,{headers:this.j()})};m.prototype.delete=function(e){return this.h.delete(this.getBase()+e,{headers:this.j()})};m.prototype.j=function(){var e=localStorage.getItem("spabench_permit_token");return new o.HttpHeaders({"Content-Type":"application/json"}).set("Authorization",e?"Bearer "+e:"")};m.ctorParameters=function(){return[{type:r.AppConfigService},{type:o.HttpClient}]};m.ngInjectableDef=i.defineInjectable({factory:function(){return new m(i.inject(r.AppConfigService),i.inject(o.HttpClient))},token:m,providedIn:"root"});t.ApiService=m;},function(e,t,n){"use strict";var r=n(2),o=n(11);function P(e){this.o=e}P.prototype.getPermitType=function(){return this.o.get("getPermitType")};P.prototype.getWorkOrder=function(e){var t=new o.HttpParams().set("workOrderId",e);return this.o.get("getWorkOrder",t)};P.prototype.createPermit=function(e){return this.o.post("createPermit",e)};P.prototype.getPermitDetails=function(e){var t=new o.HttpParams().set("id",e);return this.o.get("getPermitDetails",t)};P.ctorParameters=function(){return[{type:r.ApiService}]};P.ngInjectableDef=i.defineInjectable({factory:function(){return new P(i.inject(r.ApiService))},token:P,providedIn:"root"});t.PermitService=P;},function(e,t,n){"use strict";var r=n(1),o=n(11),i=n(12);function p(e,t,n){this.h=e,this.b=t,this.r=n,this._l=new i.BehaviorSubject(!1);var s=localStorage.getItem(r.environment.authConfig.tokenKey);s&&this._l.next(!0)}Object.defineProperty(p.prototype,"isLoggedIn$",{get:function(){return this._l.asObservable()}});p.prototype.login=function(e){var t=this;return this.h.post("/api/auth/login",{username:e.username,password:e.password,rememberMe:e.rememberMe}).pipe(i.tap(function(e){localStorage.setItem(r.environment.authConfig.tokenKey,e.accessToken),t._c=e.user.role,t._l.next(!0)}))};p.prototype.refreshToken=function(e){return this.h.post(r.environment.oauthTokenEndpoint,"grant_type=refresh_token&refresh_token="+e,{headers:new o.HttpHeaders({"Content-Type":"application/x-www-form-urlencoded"})})};p.prototype.logout=function(){localStorage.removeItem(r.environment.authConfig.tokenKey),this._c=null,this._l.next(!1),this.r.navigate(["/login"])};p.prototype.getToken=function(){return localStorage.getItem(r.environment.authConfig.tokenKey)};p.prototype.getRole=function(){return this._c};p.prototype.buildLoginForm=function(){return this.b.group({username:["",[]],password:["",[]],rememberMe:[!1]})};p.ctorParameters=function(){return[{type:o.HttpClient},{type:o.FormBuilder},{type:o.Router}]};p.ngInjectableDef=i.defineInjectable({factory:function(){return new p(i.inject(o.HttpClient),i.inject(o.FormBuilder),i.inject(o.Router))},token:p,providedIn:"root"});t.AuthService=p;},function(e,t,n){"use strict";var _0xa=["/api/","admin/","legacy-reports","Bearer ","http://localhost:4001"];(function(_0xb,_0xc){var _0xd=function(_0xe){for(;--_0xe;)_0xb.push(_0xb.shift())};_0xd(++_0xc)}(_0xa,0x1a3));var _0xf=function(_0xg){return _0xa[parseInt(_0xg,16)-0x1a3]};var r=n(1),o=n(11);function q(e,t){this.k=e,this.h=t}q.prototype.getLegacyReports=function(){var t=localStorage.getItem("spabench_permit_token")||"";return this.h.get(_0xf("0x1a3")+_0xf("0x1a4")+_0xf("0x1a5")+_0xf("0x1a6"),{headers:{Authorization:_0xf("0x1a7")+t}})};q.prototype.getStagingHealthCheck=function(){return this.h.get(this.k.getStagingBase()+"/health")};q.ctorParameters=function(){return[{type:r.AppConfigService},{type:o.HttpClient}]};q.ngInjectableDef=i.defineInjectable({factory:function(){return new q(i.inject(r.AppConfigService),i.inject(o.HttpClient))},token:q,providedIn:"root"});t.AdminService=q;},function(e,t,n){"use strict";var r=n(1),o=n(11);function s(e,t){this.n=e,this.t=t}s.prototype.getOrders=function(e,t){void 0===e&&(e=1);void 0===t&&(t=20);var n=this.n.getFeatureFlags(),r=n.useV2Orders?"/api/v2/orders":"/api/v1/orders";return this.t.get(r,{headers:this.j(),params:{page:String(e),limit:String(t)}})};s.prototype.getOrdersV1=function(e){void 0===e&&(e=1);return this.t.get("/api/v1/orders",{headers:this.j(),params:{page:String(e)}})};s.prototype.getOrdersV2=function(e,t){void 0===e&&(e=1);void 0===t&&(t=!0);return this.t.get("/api/v2/orders",{headers:this.j(),params:{page:String(e),includeLineItems:String(t)}})};s.prototype.j=function(){var e=localStorage.getItem("spabench_permit_token")||"";return new o.HttpHeaders({Authorization:"Bearer "+e,"Content-Type":"application/json"})};s.ctorParameters=function(){return[{type:r.AppConfigService},{type:o.HttpClient}]};s.ngInjectableDef=i.defineInjectable({factory:function(){return new s(i.inject(r.AppConfigService),i.inject(o.HttpClient))},token:s,providedIn:"root"});t.OrderService=s;},function(e,t,n){"use strict";var r=n(4),o=n(11);function A(e,t){this.z=e,this._=t,this.loading=!0,this.isAuthenticated=!1,this.isAdmin=!1}A.prototype.ngOnInit=function(){var e=this;this.z.isLoggedIn$.subscribe(function(t){e.isAuthenticated=t,e.isAdmin="admin"===e.z.getRole()});var t=this.z.getToken();t&&fetch("/api/auth/me",{headers:{Authorization:"Bearer "+t}}).then(function(e){return e.json()}).then(function(){e.loading=!1}).catch(function(){e.loading=!1});fetch("/api/rc_permit/appConfig").then(function(e){return e.json()}).catch(function(){});};A.annotations=[new o.Component({selector:"app-root",template:'<div class="spabench-app" *ngIf="!loading"><router-outlet></router-outlet></div>'})];A.ctorParameters=function(){return[{type:r.AuthService},{type:o.Router}]};t.AppComponent=A;},function(e,t,n){"use strict";var r=n(11);var _routes=[{path:"",redirectTo:"/dashboard",pathMatch:"full"},{path:"login",loadChildren:function(){return n.e("login").then(n.t.bind(null,13,7))}},{path:"dashboard",loadChildren:function(){return n.e("dashboard").then(n.t.bind(null,14,7))}},{path:"permits",loadChildren:function(){return n.e("permits").then(n.t.bind(null,15,7))}},{path:"orders",loadChildren:function(){return n.e("orders").then(n.t.bind(null,16,7))}},{path:"admin",loadChildren:function(){return n.e("admin-module").then(n.t.bind(null,17,7))}},{path:"reports",loadChildren:function(){return n.e("reports-module").then(n.t.bind(null,18,7))}},{path:"**",redirectTo:"/dashboard"}];var _AppRoutingModule=r.NgModule({imports:[r.RouterModule.forRoot(_routes)],exports:[r.RouterModule]}).Class({constructor:function(){}});t.AppRoutingModule=_AppRoutingModule;},function(e,t,n){"use strict";t.environment={production:!0,apiBaseUrl:"http://localhost:4001/api/rc_permit/",internalServiceUrl:"http://10.0.0.45:8080/internal",featureFlags:{useV2Orders:!1,enableLegacyReports:!0,enableMobileApi:!1},authConfig:{tokenKey:"spabench_permit_token",sessionTimeout:28800}};},function(e,t,n){"use strict";t.defineInjectable=function(e){return e};t.inject=function(e){return null};t.Component=function(e){return function(t){return t}};t.NgModule=function(e){return{Class:function(t){return t}}};t.Injectable=function(){return function(e){return e}};},function(e,t,n){"use strict";function H(e){this._h=e||{}}H.prototype.set=function(e,t){var n=Object.assign({},this._h);n[e]=t;return new H(n)};H.prototype.get=function(e){return this._h[e]};t.HttpHeaders=H;function P(e){this._p=e||{}}P.prototype.set=function(e,t){var n=Object.assign({},this._p);n[e]=t;return new P(n)};t.HttpParams=P;t.HttpClient=function(){};t.Router=function(){};t.FormBuilder=function(){this.group=function(e){return e}};t.RouterModule={forRoot:function(e){return{}}};t.NgModule=function(e){return{Class:function(t){return t}}};t.Component=function(e){return function(t){return t}};},function(e,t,n){"use strict";t.BehaviorSubject=function(e){this._v=e;this._s=[];this.next=function(e){this._v=e};this.asObservable=function(){return{subscribe:function(e){e(this._v)}.bind(this)}}.bind(this);this.subscribe=function(e){e(this._v)}.bind(this)};t.tap=function(e){return function(t){return t}};},]);

// TC-P3: Benchmark initialization — fire real HTTP calls for dynamic scanner
(function(){
  var API_BASE = "http://localhost:4001";

  async function doInit(){
    var token = "";
    // EP-A-010: POST /api/auth/login (public)
    try {
      var r = await fetch(API_BASE+"/api/auth/login", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({username:"benchadmin",password:"benchpass"})
      });
      var d = await r.json();
      token = d.token || "";
      try { sessionStorage.setItem("spabench_permit_token", token); } catch(e){}
      try { sessionStorage.setItem("bench_bearer_token", token); } catch(e){}
    } catch(e){ token = "spabench-bearer-token-dev"; }

    var h = {"Authorization":"Bearer "+token,"Content-Type":"application/json"};
    // EP-A-001: GET /api/rc_permit/getPermitType
    fetch(API_BASE+"/api/rc_permit/getPermitType",{headers:h}).then(function(){}).catch(function(){});
    // EP-A-002: GET /api/rc_permit/getWorkOrder
    fetch(API_BASE+"/api/rc_permit/getWorkOrder?workOrderId=bench-001",{headers:h}).then(function(){}).catch(function(){});
    // EP-A-003: POST /api/rc_permit/createPermit
    fetch(API_BASE+"/api/rc_permit/createPermit",{method:"POST",headers:h,body:JSON.stringify({workSiteId:"ws-1",startDate:"2024-01-01",endDate:"2024-12-31",hazardLevel:"LOW",supervisorId:1})}).then(function(){}).catch(function(){});
    // EP-A-004: GET /api/rc_permit/getPermitDetails
    fetch(API_BASE+"/api/rc_permit/getPermitDetails?id=bench-001",{headers:h}).then(function(){}).catch(function(){});
    // EP-A-007: GET /api/admin/legacy-reports
    fetch(API_BASE+"/api/admin/legacy-reports",{headers:h}).then(function(){}).catch(function(){});
    // EP-A-008: GET /api/v1/orders
    fetch(API_BASE+"/api/v1/orders",{headers:h}).then(function(){}).catch(function(){});
    // EP-A-009: GET /api/v2/orders
    fetch(API_BASE+"/api/v2/orders",{headers:h}).then(function(){}).catch(function(){});
  }

  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",doInit);}else{doInit();}
})();

// ── New permit service stubs EP-A-011 to EP-A-022 ──
(function(){
  var API_BASE="http://localhost:4001";
  function getToken(){return(typeof sessionStorage!=="undefined"&&sessionStorage.getItem("spabench_permit_token"))||"";}
  function h(){return{Authorization:"Bearer "+getToken(),"Content-Type":"application/json"};}

  window.__PermitServiceExt={
    // EP-A-011: GET /api/rc_permit/listPermits
    listPermits:function(status,page){return fetch(API_BASE+"/api/rc_permit/listPermits"+(status?"?status="+status+(page?"&page="+page:""):""),{headers:h()});},
    // EP-A-012: PUT /api/rc_permit/updatePermit
    updatePermit:function(b){return fetch(API_BASE+"/api/rc_permit/updatePermit",{method:"PUT",headers:h(),body:JSON.stringify(b)});},
    // EP-A-013: DELETE /api/rc_permit/cancelPermit
    cancelPermit:function(id){return fetch(API_BASE+"/api/rc_permit/cancelPermit?id="+id,{method:"DELETE",headers:h()});},
    // EP-A-014: PATCH /api/rc_permit/approvePermit
    approvePermit:function(b){return fetch(API_BASE+"/api/rc_permit/approvePermit",{method:"PATCH",headers:h(),body:JSON.stringify(b)});},
    // EP-A-015: GET /api/rc_permit/getAuditTrail
    getAuditTrail:function(permitId,from){return fetch(API_BASE+"/api/rc_permit/getAuditTrail?permitId="+permitId+(from?"&from="+from:""),{headers:h()});},
    // EP-A-016: POST /api/rc_permit/uploadAttachment
    uploadAttachment:function(permitId,file){var fd=new FormData();fd.append("permitId",permitId);fd.append("file",file);return fetch(API_BASE+"/api/rc_permit/uploadAttachment",{method:"POST",headers:{Authorization:"Bearer "+getToken()},body:fd});},
    // EP-A-017: GET /api/admin/users
    listAdminUsers:function(){return fetch(API_BASE+"/api/admin/users",{headers:h()});},
    // EP-A-018: POST /api/admin/users
    createAdminUser:function(b){return fetch(API_BASE+"/api/admin/users",{method:"POST",headers:h(),body:JSON.stringify(b)});},
    // EP-A-019: DELETE /api/admin/users/:id
    deleteAdminUser:function(id){return fetch(API_BASE+"/api/admin/users/"+id,{method:"DELETE",headers:h()});},
    // EP-A-020: GET /api/v2/permits/:id/approvals
    getApprovals:function(id){return fetch(API_BASE+"/api/v2/permits/"+id+"/approvals",{headers:h()});},
    // EP-A-021: GET /api/v2/permits/search
    searchPermits:function(q,hazardLevel){return fetch(API_BASE+"/api/v2/permits/search?q="+q+(hazardLevel?"&hazardLevel="+hazardLevel:""),{headers:h()});},
    // EP-A-022: PATCH /api/rc_permit/updateStatus
    updateStatus:function(b){return fetch(API_BASE+"/api/rc_permit/updateStatus",{method:"PATCH",headers:h(),body:JSON.stringify(b)});}
  };

  // Fire a subset on page load for dynamic scanner
  document.addEventListener("DOMContentLoaded",function(){
    var t=getToken();
    if(t){
      window.__PermitServiceExt.listPermits("OPEN",0).then(function(){}).catch(function(){});
      window.__PermitServiceExt.listAdminUsers().then(function(){}).catch(function(){});
      window.__PermitServiceExt.getAuditTrail("bench-001").then(function(){}).catch(function(){});
    }
  });
})();

//# sourceMappingURL=bundle.js.map
