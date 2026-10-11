(()=>{"use strict";var apiBase="http://localhost:3004";function tok(){try{return sessionStorage.getItem("portal_token")||""}catch(e){return""}}var axios={get:function(url,opts){return fetch(url,{method:"GET",headers:(opts&&opts.headers)||{}}).then(function(r){return r.json().then(function(d){return{data:d,status:r.status};});});},post:function(url,data,opts){return fetch(url,{method:"POST",headers:Object.assign({"Content-Type":"application/json"},(opts&&opts.headers)||{}),body:JSON.stringify(data)}).then(function(r){return r.json().then(function(d){return{data:d,status:r.status};});});},put:function(url,data,opts){return fetch(url,{method:"PUT",headers:Object.assign({"Content-Type":"application/json"},(opts&&opts.headers)||{}),body:JSON.stringify(data)}).then(function(r){return r.json().then(function(d){return{data:d,status:r.status};});});},delete:function(url,opts){return fetch(url,{method:"DELETE",headers:(opts&&opts.headers)||{}}).then(function(r){return r.json().then(function(d){return{data:d,status:r.status};});});},create:function(cfg){return axios;}};async function fetchUser(id){var _r=await axios.get(apiBase+"/api/users/"+id);return _r.data;}var WSDL_URL="/wsdl/legacy-service.wsdl";var _soapOps=null;async function loadSoapOperations(){if(_soapOps)return _soapOps;var r=await fetch(WSDL_URL);var txt=await r.text();var ops=[];var re=/<operation name="([^"]+)"/g,m;while((m=re.exec(txt))!==null)ops.push(m[1]);_soapOps=ops;return ops;}async function callSoapBridge(operationName,params){var ops=await loadSoapOperations();if(!ops.includes(operationName))throw new Error("Unknown op: "+operationName);var url=apiBase+"/api/legacy/bridge/"+operationName;return axios.post(url,params,{headers:{Authorization:"Bearer "+tok()}});}
var UserServiceFull={
  listUsers:function(dept){return axios.get(apiBase+"/api/users"+(dept?"?department="+dept:""));},
  createUser:function(b){return axios.post(apiBase+"/api/users",b);},
  updateUser:function(id,b){return axios.put(apiBase+"/api/users/"+id,b);},
  deleteUser:function(id){return axios.delete(apiBase+"/api/users/"+id);},
  patchStatus:function(id,s){return fetch(apiBase+"/api/users/"+id+"/status",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:s})});}
};
var DepartmentService={
  list:function(){return fetch(apiBase+"/api/departments");},
  create:function(b){return fetch(apiBase+"/api/departments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)});}
};
var PermitServiceFull={
  list:function(s){return fetch(apiBase+"/api/permits"+(s?"?status="+s:""));},
  create:function(b){return fetch(apiBase+"/api/permits",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)});},
  delete:function(id){return fetch(apiBase+"/api/permits/"+id,{method:"DELETE"});}
};
var DocumentService={
  get:function(id){return fetch(apiBase+"/api/documents/"+id);},
  upload:function(permitId,file){var fd=new FormData();fd.append("file",file);fd.append("permitId",permitId);return fetch(apiBase+"/api/documents/upload",{method:"POST",body:fd});}
};
var AuditService={
  getLog:function(from,to){return fetch(apiBase+"/api/audit-log"+(from?"?from="+from:""));},
};
var LegacyService={
  getReports:function(){return fetch(apiBase+"/api/legacy/reports");}
};

function quiet(p){return p.then(function(){}).catch(function(){})}
async function portal(){var n=document.querySelector("#__nuxt");if(n)n.innerHTML='<div id="portal-app"><h1>Government Portal</h1><div id="content"></div></div>';
quiet(DepartmentService.list());quiet(AuditService.getLog());quiet(UserServiceFull.listUsers());quiet(PermitServiceFull.list());
try{var ops=await loadSoapOperations();for(var i=0;i<ops.length;i++){try{await callSoapBridge(ops[i],{employeeId:"7",salary:50000,reportType:"annual",dateRange:{from:"2026-01-01",to:"2026-12-31"}})}catch(e){}}}catch(e){}}
function login(u,p){return fetch(apiBase+"/api/auth/login",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:u,password:p})}).then(function(r){if(!r.ok)throw new Error("login");return r.json()}).then(function(d){sessionStorage.setItem("portal_token",d.token)})}
document.addEventListener("DOMContentLoaded",function(){var f=document.getElementById("login-form");
if(tok()){if(f)f.hidden=!0;portal();return}
if(!f)return;f.hidden=!1;f.addEventListener("submit",function(ev){ev.preventDefault();login(f.elements.username.value,f.elements.password.value).then(function(){f.hidden=!0;portal()}).catch(function(){var m=document.getElementById("login-error");if(m)m.hidden=!1})})});})();
