(()=>{"use strict";var React={createElement:function(t,p,...c){return{type:t,props:{},children:[]};},useState:function(i){return[i,function(){}];},useEffect:function(fn,deps){if(typeof fn==="function")fn();},createContext:function(d){return{_d:d};},useContext:function(c){return c._d;}};var API_BASE="http://localhost:3003";function getToken(){return sessionStorage.getItem("shop_token")||"";}async function getProduct(id,include){var url=new URL(API_BASE+"/api/v2/products/"+id);if(include)url.searchParams.set("include",include);var res=await fetch(url.toString(),{headers:{Authorization:"Bearer "+getToken()}});if(!res.ok)throw new Error("failed");return res.json();}async function openProductCache(){return new Promise(function(resolve,reject){var req=indexedDB.open("product-cache-db",1);req.onupgradeneeded=function(){req.result.createObjectStore("product-cache");};req.onsuccess=function(){resolve(req.result);};req.onerror=function(){reject(req.error);};});}async function cacheProductRequest(requestUrl,cacheKey){var db=await openProductCache();var tx=db.transaction("product-cache","readwrite");var store=tx.objectStore("product-cache");store.put({requestUrl:requestUrl,cacheKey:cacheKey,cachedAt:Date.now()},"latest-list");}async function listProducts(params){var _url=new URL(API_BASE+"/api/v2/products/list");if(params&&params.page!=null)_url.searchParams.set("page",String(params.page));if(params&&params.limit!=null)_url.searchParams.set("limit",String(params.limit));if(params&&params.category)_url.searchParams.set("category",params.category);var res2=await fetch(_url.toString());if(!res2.ok)throw new Error("list failed");var data=await res2.json();await cacheProductRequest(_url.toString(),data._cacheKey);return data;}function ProductCatalog(props){var ps=React.useState([]),products=ps[0];var pg=React.useState(0),page=pg[0];React.useEffect(function(){listProducts({page:page,limit:props.pageSize||12,category:props.category}).then(function(d){}).catch(function(){});},[page,props.pageSize,props.category]);return React.createElement("div",{className:"catalog"});}
var OrderService={
  getOrders:function(p){return fetch(API_BASE+"/api/v2/orders"+(p&&p.userId?"?userId="+p.userId:""),{headers:{Authorization:"Bearer "+getToken()}});},
  getOrder:function(id){return fetch(API_BASE+"/api/v2/orders/"+id,{headers:{Authorization:"Bearer "+getToken()}});},
  createOrder:function(b){return fetch(API_BASE+"/api/v2/orders",{method:"POST",headers:{Authorization:"Bearer "+getToken(),"Content-Type":"application/json"},body:JSON.stringify(b)});},
  updateOrderStatus:function(id,s){return fetch(API_BASE+"/api/v2/orders/"+id+"/status",{method:"PATCH",headers:{Authorization:"Bearer "+getToken(),"Content-Type":"application/json"},body:JSON.stringify({status:s})}); }
};
var UserService={
  getMe:function(){return fetch(API_BASE+"/api/v2/users/me",{headers:{Authorization:"Bearer "+getToken()}});},
  updateMe:function(b){return fetch(API_BASE+"/api/v2/users/me",{method:"PUT",headers:{Authorization:"Bearer "+getToken(),"Content-Type":"application/json"},body:JSON.stringify(b)});}
};
var CartService={
  deleteCart:function(id){return fetch(API_BASE+"/api/v2/cart/"+id,{method:"DELETE",headers:{Authorization:"Bearer "+getToken()}});}
};
var ReviewService={
  getReviews:function(pid){return fetch(API_BASE+"/api/v2/reviews?productId="+pid);},
  createReview:function(b){return fetch(API_BASE+"/api/v2/reviews",{method:"POST",headers:{Authorization:"Bearer "+getToken(),"Content-Type":"application/json"},body:JSON.stringify(b)});}
};
var AdminService={
  getAdminProducts:function(){return fetch(API_BASE+"/api/v2/admin/products",{headers:{Authorization:"Bearer "+getToken()}});},
  createAdminProduct:function(b){return fetch(API_BASE+"/api/v2/admin/products",{method:"POST",headers:{Authorization:"Bearer "+getToken(),"Content-Type":"application/json"},body:JSON.stringify(b)});},
  deleteAdminProduct:function(id){return fetch(API_BASE+"/api/v2/admin/products/"+id,{method:"DELETE",headers:{Authorization:"Bearer "+getToken()}});}
};
var ProductServiceFull={
  createProduct:function(b){return fetch(API_BASE+"/api/v2/products",{method:"POST",headers:{Authorization:"Bearer "+getToken(),"Content-Type":"application/json"},body:JSON.stringify(b)});},
  updateProduct:function(id,b){return fetch(API_BASE+"/api/v2/products/"+id,{method:"PUT",headers:{Authorization:"Bearer "+getToken(),"Content-Type":"application/json"},body:JSON.stringify(b)});},
  deleteProduct:function(id){return fetch(API_BASE+"/api/v2/products/"+id,{method:"DELETE",headers:{Authorization:"Bearer "+getToken()}});}
};
function quiet(p){return p.then(function(){}).catch(function(){})}
function startRecommendations(){if(typeof Worker==="undefined")return;var wk=new Worker("/recommendation.worker.js");wk.postMessage({type:"RECOMMEND",token:getToken()})}
function openCheckout(){return import("/assets/checkout.chunk.js").catch(function(){})}
function signedIn(){quiet(OrderService.getOrders({userId:"me"}));quiet(UserService.getMe());startRecommendations();
if(sessionStorage.getItem("shop_role")==="admin")quiet(AdminService.getAdminProducts())}
function login(u,p){return fetch(API_BASE+"/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:u,password:p})}).then(function(r){if(!r.ok)throw new Error("login");return r.json()}).then(function(d){sessionStorage.setItem("shop_token",d.token);sessionStorage.setItem("shop_role",d.user&&d.user.role||"")})}
document.addEventListener("DOMContentLoaded",function(){var root=document.getElementById("root")||document.body;
root.innerHTML='<div id="app"><h1>Shop</h1><div id="catalog"></div><button id="checkout-btn" type="button">Checkout</button></div>';
document.getElementById("checkout-btn").addEventListener("click",openCheckout);
quiet(listProducts({page:0,limit:12}));quiet(fetch(API_BASE+"/api/v2/products"));quiet(getProduct("prod-001","reviews"));quiet(ReviewService.getReviews("prod-001"));
var f=document.getElementById("login-form");
if(getToken()){if(f)f.hidden=!0;signedIn();return}
if(!f)return;f.hidden=!1;f.addEventListener("submit",function(ev){ev.preventDefault();login(f.elements.username.value,f.elements.password.value).then(function(){f.hidden=!0;signedIn()}).catch(function(){var m=document.getElementById("login-error");if(m)m.hidden=!1})})});})();
//# sourceMappingURL=index.abc123.js.map
