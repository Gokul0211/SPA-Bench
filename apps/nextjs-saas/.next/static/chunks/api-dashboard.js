(()=>{"use strict";})();
// EP-E-022 to EP-E-023: REST order routes
// GET /api/orders — list orders
// DELETE /api/orders/:id — cancel order
var _listOrders=function(uid){return fetch((typeof API_BASE!=="undefined"?API_BASE:"")+"/api/orders"+(uid?"?userId="+uid:""),{headers:{Authorization:"Bearer "+((typeof sessionStorage!=="undefined"&&sessionStorage.getItem("bench_bearer_token"))||"")}});};
var _deleteOrder=function(id){return fetch((typeof API_BASE!=="undefined"?API_BASE:"")+"/api/orders/"+id,{method:"DELETE",headers:{Authorization:"Bearer "+((typeof sessionStorage!=="undefined"&&sessionStorage.getItem("bench_bearer_token"))||"")}});};
exports.OrderHandlers={list:_listOrders,delete:_deleteOrder};
//# sourceMappingURL=api-dashboard.js.map
