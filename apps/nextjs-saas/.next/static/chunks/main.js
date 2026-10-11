(()=>{"use strict";var API_BASE="http://localhost:3005";function getToken(){return sessionStorage.getItem("saas_token")||"";}var WS_NOTIFICATIONS="ws://localhost:3005/ws/notifications";var NotificationService=function(){this.ws=null;this.listeners=[];};NotificationService.prototype.connect=function(token){var protocol=window.location.protocol==="https:"?"wss:":"ws:";var url=protocol+"//"+window.location.host+"/ws/notifications";this.ws=new WebSocket(url);var self=this;this.ws.onopen=function(){self.ws.send(JSON.stringify({type:"SUBSCRIBE",token:token}));};this.ws.onmessage=function(e){var m=JSON.parse(e.data);if(m.type==="PUBLISH")self.listeners.forEach(function(fn){fn(m.payload);});};};NotificationService.prototype.onNotification=function(fn){this.listeners.push(fn);};NotificationService.prototype.disconnect=function(){if(this.ws)this.ws.close();this.ws=null;};var WS_URL="ws://localhost:3005/ws/live-dashboard";var DashboardService=function(){this.ws=null;};DashboardService.prototype.fetchMetrics=async function(period,token){var url=new URL(API_BASE+"/api/dashboard/metrics");url.searchParams.set("period",period);var res=await fetch(url.toString(),{headers:{Authorization:"Bearer "+token}});return res.json();};DashboardService.prototype.connectLiveDashboard=function(token,onMetrics){this.ws=new WebSocket(WS_URL);var self=this;this.ws.onopen=function(){self.ws.send(JSON.stringify({type:"SUBSCRIBE",token:token}));};this.ws.onmessage=function(e){var m=JSON.parse(e.data);if(m.type==="PUBLISH")onMetrics(m.payload);};};window.__saas={NotificationService:NotificationService,DashboardService:DashboardService};

var UsersAPI={
  list:function(role){return fetch(API_BASE+"/api/users"+(role?"?role="+role:""),{headers:{Authorization:"Bearer "+getToken()}});},
  get:function(id){return fetch(API_BASE+"/api/users/"+id,{headers:{Authorization:"Bearer "+getToken()}});},
  create:function(b){return fetch(API_BASE+"/api/users",{method:"POST",headers:{Authorization:"Bearer "+getToken(),"Content-Type":"application/json"},body:JSON.stringify(b)});},
  update:function(id,b){return fetch(API_BASE+"/api/users/"+id,{method:"PUT",headers:{Authorization:"Bearer "+getToken(),"Content-Type":"application/json"},body:JSON.stringify(b)});},
  delete:function(id){return fetch(API_BASE+"/api/users/"+id,{method:"DELETE",headers:{Authorization:"Bearer "+getToken()}});}
};
var OrdersAPI={
  list:function(uid){return fetch(API_BASE+"/api/orders"+(uid?"?userId="+uid:""),{headers:{Authorization:"Bearer "+getToken()}});},
  delete:function(id){return fetch(API_BASE+"/api/orders/"+id,{method:"DELETE",headers:{Authorization:"Bearer "+getToken()}});}
};
var BillingAPI={
  listInvoices:function(from){return fetch(API_BASE+"/api/billing/invoices"+(from?"?from="+from:""),{headers:{Authorization:"Bearer "+getToken()}});},
  createInvoice:function(b){return fetch(API_BASE+"/api/billing/invoices",{method:"POST",headers:{Authorization:"Bearer "+getToken(),"Content-Type":"application/json"},body:JSON.stringify(b)});},
  deleteInvoice:function(id){return fetch(API_BASE+"/api/billing/invoices/"+id,{method:"DELETE",headers:{Authorization:"Bearer "+getToken()}});}
};
var TeamAPI={
  listMembers:function(){return fetch(API_BASE+"/api/team/members",{headers:{Authorization:"Bearer "+getToken()}});},
  addMember:function(b){return fetch(API_BASE+"/api/team/members",{method:"POST",headers:{Authorization:"Bearer "+getToken(),"Content-Type":"application/json"},body:JSON.stringify(b)});}
};

function quiet(p){return p.then(function(){}).catch(function(){})}
function gql(q,v){return fetch(API_BASE+"/graphql",{method:"POST",headers:{Authorization:"Bearer "+getToken(),"Content-Type":"application/json"},body:JSON.stringify({query:q,variables:v||{}})})}
var DASHBOARD_QUERY="query Dashboard($period:String!){getDashboardMetrics(period:$period){totalRevenue activeUsers churnRate}}";
var TEAM_QUERY="query Team($ws:ID!){listTeamMembers(workspaceId:$ws){id email role}}";
function dashboard(){var t=getToken(),root=document.getElementById("__next")||document.body;root.innerHTML='<div id="app"><h1>Dashboard</h1></div>';
var ds=new DashboardService(),ns=new NotificationService();
quiet(ds.fetchMetrics("last_30d",t));try{ds.connectLiveDashboard(t,function(){})}catch(e){}try{ns.connect(t)}catch(e){}
quiet(gql(DASHBOARD_QUERY,{period:"last_30d"}));quiet(gql(TEAM_QUERY,{ws:"ws-001"}));
quiet(UsersAPI.list());quiet(OrdersAPI.list());quiet(BillingAPI.listInvoices());quiet(TeamAPI.listMembers())}
function post(u,b){return fetch(API_BASE+u,{method:"POST",headers:{"Content-Type":"application/json","X-App-Id":"nextjs-saas"},body:JSON.stringify(b)}).then(function(r){if(!r.ok)throw new Error(u);return r.json()})}
function start(){var f=document.getElementById("login-form"),m=document.getElementById("mfa-form"),pending=null;
if(getToken()){if(f)f.hidden=!0;dashboard();return}
if(!f||!m)return;f.hidden=!1;
function fail(){var e=document.getElementById("login-error");if(e)e.hidden=!1}
function done(d){sessionStorage.setItem("saas_token",d.accessToken);f.hidden=!0;m.hidden=!0;dashboard()}
f.addEventListener("submit",function(ev){ev.preventDefault();post("/api/auth/login",{username:f.elements.username.value,password:f.elements.password.value}).then(function(d){if(d.requiresMFA){pending=d.sessionToken;f.hidden=!0;m.hidden=!1}else done(d)}).catch(fail)});
m.addEventListener("submit",function(ev){ev.preventDefault();post("/api/auth/mfa/verify",{token:m.elements.code.value,sessionToken:pending}).then(done).catch(fail)})}
"loading"===document.readyState?document.addEventListener("DOMContentLoaded",start):start()})();
//# sourceMappingURL=main.js.map
