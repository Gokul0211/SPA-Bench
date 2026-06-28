// SPABench App A — Legacy Mobile API Module
// Disabled in index.html via commented script tag (TC-P1-010)
// Code is still live — all endpoints callable
(window.webpackJsonp=window.webpackJsonp||[]).push([["permit-mobile-legacy"],
{"mobile-legacy":function(e,t,n){"use strict";
var MOBILE_API_BASE="http://localhost:4001/api/mobile/v1/";
function ML(e){this.h=e}
ML.prototype.getMobilePermits=function(e,t){var n=new n.HttpParams();if(e)n=n.set("workSiteId",e);if(t)n=n.set("status",t);return this.h.get(MOBILE_API_BASE+"permits",{headers:this.j(),params:n})};
ML.prototype.quickSubmitPermit=function(e){return this.h.post(MOBILE_API_BASE+"permits/quick-submit",e,{headers:this.j()})};
ML.prototype.getMobileWorkOrders=function(e){var t=e?new n.HttpParams().set("workSiteId",e):void 0;return this.h.get(MOBILE_API_BASE+"work-orders",{headers:this.j(),params:t})};
ML.prototype.locationCheckin=function(e){return this.h.post(MOBILE_API_BASE+"location/checkin",e,{headers:this.j()})};
ML.prototype.getOfflineSyncBundle=function(e){var t=e?new n.HttpParams().set("since",e):void 0;return this.h.get(MOBILE_API_BASE+"offline-sync",{headers:this.j(),params:t})};
ML.prototype.j=function(){var e=localStorage.getItem("spabench_permit_token")||"";return{"Authorization":"Bearer "+e,"X-Mobile-Client":"permit-app/2.1"}};
t.MobileLegacyService=ML;}}]);
//# sourceMappingURL=permit-mobile-legacy.js.map
