(()=>{"use strict";})();
var _listInvoices=function(from){return fetch((typeof API_BASE!=="undefined"?API_BASE:"")+"/api/billing/invoices"+(from?"?from="+from:""),{headers:{Authorization:"Bearer "+((typeof sessionStorage!=="undefined"&&sessionStorage.getItem("saas_token"))||"")}});};
var _createInvoice=function(b){return fetch((typeof API_BASE!=="undefined"?API_BASE:"")+"/api/billing/invoices",{method:"POST",headers:{Authorization:"Bearer "+((typeof sessionStorage!=="undefined"&&sessionStorage.getItem("saas_token"))||""),"Content-Type":"application/json"},body:JSON.stringify(b)});};
var _deleteInvoice=function(id){return fetch((typeof API_BASE!=="undefined"?API_BASE:"")+"/api/billing/invoices/"+id,{method:"DELETE",headers:{Authorization:"Bearer "+((typeof sessionStorage!=="undefined"&&sessionStorage.getItem("saas_token"))||"")}});};
(self.__saas=self.__saas||{}).BillingHandlers={list:_listInvoices,create:_createInvoice,delete:_deleteInvoice};
//# sourceMappingURL=billing.js.map
