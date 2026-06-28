// SPABench recommendation worker — TC-P3 service worker probe
// Fires /api/v2/recommendations on behalf of the main thread
self.addEventListener("message", function(e) {
  if (e.data && e.data.type === "RECOMMEND") {
    fetch("http://localhost:3003/api/v2/recommendations", {
      headers: { Authorization: "Bearer " + (e.data.token || "spabench-bearer-token-dev") }
    }).then(function(r){ return r.json(); }).then(function(d){
      self.postMessage({ type: "RECOMMENDATIONS", data: d });
    }).catch(function(){});
  }
});
// Auto-fire on load for benchmark scanner discovery
fetch("http://localhost:3003/api/v2/recommendations", {
  headers: { Authorization: "Bearer spabench-bearer-token-dev" }
}).then(function(){}).catch(function(){});
