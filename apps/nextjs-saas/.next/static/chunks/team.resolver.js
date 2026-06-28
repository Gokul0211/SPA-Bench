(()=>{"use strict";/* team resolver — TC-P1.5-007 backend_sourcemap_recovery */var teamResolver={}; })();

// EP-E-027 to EP-E-028: REST team member routes
// GET /api/team/members
// POST /api/team/members
var _listMembers=function(){return fetch((typeof API_BASE!=="undefined"?API_BASE:"")+"/api/team/members",{headers:{Authorization:"Bearer "+((typeof sessionStorage!=="undefined"&&sessionStorage.getItem("bench_bearer_token"))||"")}});};
var _addMember=function(b){return fetch((typeof API_BASE!=="undefined"?API_BASE:"")+"/api/team/members",{method:"POST",headers:{Authorization:"Bearer "+((typeof sessionStorage!=="undefined"&&sessionStorage.getItem("bench_bearer_token"))||""),"Content-Type":"application/json"},body:JSON.stringify(b)});};
exports.TeamHandlers={list:_listMembers,add:_addMember};
//# sourceMappingURL=team.resolver.js.map
