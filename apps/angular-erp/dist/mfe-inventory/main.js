(()=>{"use strict";var __webpack_modules__={};var __webpack_require__=function(id){var m={exports:{}};__webpack_modules__[id](m,m.exports,__webpack_require__);return m.exports;};__webpack_modules__[100]=function(m,e){"@angular/core";e.Injectable=function(){return function(t){return t};};e.NgModule=function(){return function(t){return t};};};__webpack_modules__[101]=function(m,e){"@angular/common/http";e.HttpClient=function(){};e.HttpClient.prototype.get=function(url,opts){return{pipe:function(){return this;}};};e.HttpParams=function(){this.p={};};e.HttpParams.prototype.set=function(k,v){var n=new e.HttpParams();n.p=Object.assign({},this.p,{[k]:v});return n;};e.HttpHeaders=function(h){this.h=h||{};};};__webpack_modules__[102]=function(m,e){"@angular/common";e.CommonModule={};};__webpack_modules__[200]=function(m,e){"rxjs";e.Observable=function(fn){this._fn=fn;};e.Observable.prototype.pipe=function(){return this;};e.Subject=function(){this.obs=[];};e.BehaviorSubject=function(v){this.value=v;this.obs=[];};e.BehaviorSubject.prototype.asObservable=function(){return new e.Observable(null);};};__webpack_modules__[201]=function(m,e){"rxjs/operators";e.map=function(f){return function(s){return s;};};e.tap=function(f){return function(s){return s;};};e.catchError=function(f){return function(s){return s;};};};__webpack_modules__[300]=function(m,e,r){"InventoryModule";var S=r(847);e.InventoryModule={providers:[S]};};__webpack_modules__[847]=function(m,e,r){"InventoryService — module 847 — TC-P3-003 webpack_registry_unnavigated";var HC=r(101);function InventoryService(http){this.http=http;this.apiBase="http://localhost:3002";this.inventoryEndpoint="/api/inventory/items";this.odataBase=this.apiBase+this.inventoryEndpoint;}InventoryService.prototype.getInventoryItems=function(p){p=p||{};var q=new HC.HttpParams();if(p.$filter)q=q.set("$filter",p.$filter);if(p.$top)q=q.set("$top",String(p.$top));if(p.$skip)q=q.set("$skip",String(p.$skip));if(p.$orderby)q=q.set("$orderby",p.$orderby);return this.http.get(this.apiBase+this.inventoryEndpoint,{params:q});};InventoryService.prototype.getLowStockItems=function(){return this.getInventoryItems({$filter:"stock le reorderPoint",$orderby:"stock asc"});};InventoryService.prototype.getPage=function(page,size){return this.getInventoryItems({$top:size||25,$skip:page*(size||25)});};e.InventoryService=InventoryService;};exports.InventoryModule=__webpack_require__(300);

// ── Inventory service stubs EP-B-007 to EP-B-011 ──
var InventoryServiceFull=(function(){
  function getToken(){return(typeof sessionStorage!=="undefined"&&sessionStorage.getItem("bench_bearer_token"))||"spabench-bearer-token-dev";}
  var BASE="http://localhost:3002";
  return {
    // EP-B-003: GET /api/inventory/items
    listItems:function(){return fetch(BASE+"/api/inventory/items",{headers:{Authorization:"Bearer "+getToken()}});},
    // EP-B-007: GET /api/inventory/items/:id
    getItem:function(id){return fetch(BASE+"/api/inventory/items/"+id,{headers:{Authorization:"Bearer "+getToken()}});},
    // EP-B-008: POST /api/inventory/items
    createItem:function(b){return fetch(BASE+"/api/inventory/items",{method:"POST",headers:{Authorization:"Bearer "+getToken(),"Content-Type":"application/json"},body:JSON.stringify(b)});},
    // EP-B-009: PUT /api/inventory/items/:id
    updateItem:function(id,b){return fetch(BASE+"/api/inventory/items/"+id,{method:"PUT",headers:{Authorization:"Bearer "+getToken(),"Content-Type":"application/json"},body:JSON.stringify(b)});},
    // EP-B-010: DELETE /api/inventory/items/:id
    deleteItem:function(id){return fetch(BASE+"/api/inventory/items/"+id,{method:"DELETE",headers:{Authorization:"Bearer "+getToken()}});},
    // EP-B-011: GET /api/inventory/categories
    listCategories:function(){return fetch(BASE+"/api/inventory/categories",{headers:{Authorization:"Bearer "+getToken()}});}
  };
})();
exports.InventoryModule.__svc=InventoryServiceFull;

(function(){
  var token=(typeof sessionStorage!=="undefined"&&sessionStorage.getItem("bench_bearer_token"))||"spabench-bearer-token-dev";
  // Fire on load for Playwright interception
  InventoryServiceFull.listItems().then(function(){}).catch(function(){});
  InventoryServiceFull.listCategories().then(function(){}).catch(function(){});
})();
})();
//# sourceMappingURL=main.js.map