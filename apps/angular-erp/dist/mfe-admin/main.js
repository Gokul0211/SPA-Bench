(()=>{"use strict";var __webpack_modules__={};var __webpack_require__=function(id){var m={exports:{}};__webpack_modules__[id](m,m.exports,__webpack_require__);return m.exports;};__webpack_modules__[100]=function(m,e){"@angular/core";e.Injectable=function(){return function(t){return t};};};__webpack_modules__[101]=function(m,e){"@angular/common/http";e.HttpClient=function(){};e.HttpClient.prototype.get=function(url,opts){return{pipe:function(){return this;}};};e.HttpClient.prototype.post=function(url,body,opts){return{pipe:function(){return this;}};};e.HttpHeaders=function(h){this.h=h||{};};};__webpack_modules__[200]=function(m,e){"adminEnvironment";var adminEnvironment={production:true,apiBaseUrl:"http://localhost:3002",internalApiUrl:"http://10.0.1.45:8080/internal/api",features:{userProvisioning:true,auditLog:true,legacyMigration:true}};e.adminEnvironment=adminEnvironment;};__webpack_modules__[847]=function(m,e,r){"LegacyReportService";var env=r(200).adminEnvironment;function LegacyReportService(http){this.http=http;this.internalBase=env.internalApiUrl;}LegacyReportService.prototype.getLegacyReport=function(type,auth){return this.http.get(this.internalBase+"/reports/"+type,{headers:{Authorization:auth}});};LegacyReportService.prototype.submitAdminPayload=function(payload,auth){return this.http.post(this.internalBase+"/admin/submit",payload,{headers:{Authorization:auth,"Content-Type":"application/json"}});};e.LegacyReportService=LegacyReportService;};exports.AdminModule=__webpack_require__(847);

// TC-P3: Fire admin API calls — EP-B-004 internal IP exposure
(function(){
  var token = (typeof sessionStorage !== "undefined" && sessionStorage.getItem("bench_bearer_token")) || "spabench-bearer-token-dev";
  var svc = new (__webpack_require__(847).LegacyReportService)({get:function(u,o){return fetch(u,{headers:o&&o.headers||{}}).then(function(r){return r.json();});},post:function(u,b,o){return fetch(u,{method:"POST",headers:Object.assign({"Content-Type":"application/json"},o&&o.headers||{}),body:JSON.stringify(b)}).then(function(r){return r.json();});}});
  // EP-B-004: GET http://10.0.1.45:8080/internal/api/reports/annual (internal IP)
  svc.getLegacyReport("annual","Bearer "+token).catch(function(){});
})();
})();

// ── Admin/Employee/Report service stubs EP-B-012 to EP-B-020 ──
var AdminServiceFull=(function(){
  function getToken(){return(typeof sessionStorage!=="undefined"&&sessionStorage.getItem("bench_bearer_token"))||"spabench-bearer-token-dev";}
  var BASE="http://localhost:3002";
  return {
    // EP-B-012: GET /api/employees
    listEmployees:function(dept){return fetch(BASE+"/api/employees"+(dept?"?department="+dept:""),{headers:{Authorization:"Bearer "+getToken()}});},
    // EP-B-013: GET /api/employees/:id
    getEmployee:function(id){return fetch(BASE+"/api/employees/"+id,{headers:{Authorization:"Bearer "+getToken()}});},
    // EP-B-014: POST /api/employees
    createEmployee:function(b){return fetch(BASE+"/api/employees",{method:"POST",headers:{Authorization:"Bearer "+getToken(),"Content-Type":"application/json"},body:JSON.stringify(b)});},
    // EP-B-015: PUT /api/employees/:id
    updateEmployee:function(id,b){return fetch(BASE+"/api/employees/"+id,{method:"PUT",headers:{Authorization:"Bearer "+getToken(),"Content-Type":"application/json"},body:JSON.stringify(b)});},
    // EP-B-016: PATCH /api/admin/users/:id/role
    patchUserRole:function(id,role){return fetch(BASE+"/api/admin/users/"+id+"/role",{method:"PATCH",headers:{Authorization:"Bearer "+getToken(),"Content-Type":"application/json"},body:JSON.stringify({role:role})});},
    // EP-B-017: GET /api/reports/monthly
    getMonthlyReport:function(month){return fetch(BASE+"/api/reports/monthly?month="+month,{headers:{Authorization:"Bearer "+getToken()}});},
    // EP-B-018: POST /api/reports/generate
    generateReport:function(b){return fetch(BASE+"/api/reports/generate",{method:"POST",headers:{Authorization:"Bearer "+getToken(),"Content-Type":"application/json"},body:JSON.stringify(b)});},
    // EP-B-019: GET /api/admin/settings
    getSettings:function(){return fetch(BASE+"/api/admin/settings",{headers:{Authorization:"Bearer "+getToken()}});},
    // EP-B-020: PUT /api/admin/settings
    updateSettings:function(b){return fetch(BASE+"/api/admin/settings",{method:"PUT",headers:{Authorization:"Bearer "+getToken(),"Content-Type":"application/json"},body:JSON.stringify(b)});}
  };
})();

(function(){
  var token=(typeof sessionStorage!=="undefined"&&sessionStorage.getItem("bench_bearer_token"))||"spabench-bearer-token-dev";
  // Fire on load for Playwright interception
  AdminServiceFull.listEmployees().then(function(){}).catch(function(){});
  AdminServiceFull.getSettings().then(function(){}).catch(function(){});
  AdminServiceFull.getMonthlyReport("2024-01").then(function(){}).catch(function(){});
})();

//# sourceMappingURL=main.js.map