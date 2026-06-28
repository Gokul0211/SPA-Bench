(()=>{"use strict";})();

// EP-E-017 to EP-E-021: REST user management routes
// GET /api/users — list all users (auth-gated)
// GET /api/users/:id — get user by id
// POST /api/users — create user  
// PUT /api/users/:id — update user
// DELETE /api/users/:id — delete user
var _listUsers=function(role){return fetch(typeof API_BASE!=="undefined"?API_BASE+"/api/users":"/api/users",{headers:{Authorization:"Bearer "+((typeof sessionStorage!=="undefined"&&sessionStorage.getItem("bench_bearer_token"))||"")}});};
var _getUser=function(id){return fetch((typeof API_BASE!=="undefined"?API_BASE:"")+"/api/users/"+id,{headers:{Authorization:"Bearer "+((typeof sessionStorage!=="undefined"&&sessionStorage.getItem("bench_bearer_token"))||"")}});};
var _createUser=function(b){return fetch((typeof API_BASE!=="undefined"?API_BASE:"")+"/api/users",{method:"POST",headers:{Authorization:"Bearer "+((typeof sessionStorage!=="undefined"&&sessionStorage.getItem("bench_bearer_token"))||""),"Content-Type":"application/json"},body:JSON.stringify(b)});};
var _updateUser=function(id,b){return fetch((typeof API_BASE!=="undefined"?API_BASE:"")+"/api/users/"+id,{method:"PUT",headers:{Authorization:"Bearer "+((typeof sessionStorage!=="undefined"&&sessionStorage.getItem("bench_bearer_token"))||""),"Content-Type":"application/json"},body:JSON.stringify(b)});};
var _deleteUser=function(id){return fetch((typeof API_BASE!=="undefined"?API_BASE:"")+"/api/users/"+id,{method:"DELETE",headers:{Authorization:"Bearer "+((typeof sessionStorage!=="undefined"&&sessionStorage.getItem("bench_bearer_token"))||"")}});};
exports.UserHandlers={list:_listUsers,get:_getUser,create:_createUser,update:_updateUser,delete:_deleteUser};
//# sourceMappingURL=api-users.js.map
