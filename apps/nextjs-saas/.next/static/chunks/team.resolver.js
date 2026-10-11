(()=>{"use strict";var teamResolver={}; })();
var _listMembers=function(){return fetch((typeof API_BASE!=="undefined"?API_BASE:"")+"/api/team/members",{headers:{Authorization:"Bearer "+((typeof sessionStorage!=="undefined"&&sessionStorage.getItem("saas_token"))||"")}});};
var _addMember=function(b){return fetch((typeof API_BASE!=="undefined"?API_BASE:"")+"/api/team/members",{method:"POST",headers:{Authorization:"Bearer "+((typeof sessionStorage!=="undefined"&&sessionStorage.getItem("saas_token"))||""),"Content-Type":"application/json"},body:JSON.stringify(b)});};
(self.__saas=self.__saas||{}).TeamHandlers={list:_listMembers,add:_addMember};
//# sourceMappingURL=team.resolver.js.map
