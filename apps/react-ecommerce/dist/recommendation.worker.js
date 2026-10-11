self.addEventListener("message",function(e){if(!e.data||e.data.type!=="RECOMMEND"||!e.data.token)return;
fetch("http://localhost:3003/api/v2/recommendations",{headers:{Authorization:"Bearer "+e.data.token}})
.then(function(r){return r.json()}).then(function(d){self.postMessage({type:"RECOMMENDATIONS",data:d})}).catch(function(){})});
