(()=>{"use strict";})();
var _listOrders=function(uid){return fetch((typeof API_BASE!=="undefined"?API_BASE:"")+"/api/orders"+(uid?"?userId="+uid:""),{headers:{Authorization:"Bearer "+((typeof sessionStorage!=="undefined"&&sessionStorage.getItem("saas_token"))||"")}});};
var _deleteOrder=function(id){return fetch((typeof API_BASE!=="undefined"?API_BASE:"")+"/api/orders/"+id,{method:"DELETE",headers:{Authorization:"Bearer "+((typeof sessionStorage!=="undefined"&&sessionStorage.getItem("saas_token"))||"")}});};
(self.__saas=self.__saas||{}).OrderHandlers={list:_listOrders,delete:_deleteOrder};
//# sourceMappingURL=api-dashboard.js.map
