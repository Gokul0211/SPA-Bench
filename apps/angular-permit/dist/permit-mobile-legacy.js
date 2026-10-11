(window.webpackJsonp=window.webpackJsonp||[]).push([["permit-mobile-legacy"],
{"mobile-legacy":function(e,t,n){"use strict";var o=n("http");
var MOBILE_API_BASE="http://localhost:4001/api/mobile/v1/";
function ML(e){this.h=e}
ML.prototype.getMobilePermits=function(e,t){var r=new o.HttpParams();if(e)r=r.set("workSiteId",e);if(t)r=r.set("status",t);return this.h.get(MOBILE_API_BASE+"permits",{headers:this.j(),params:r})};
ML.prototype.quickSubmitPermit=function(e){return this.h.post(MOBILE_API_BASE+"permits/quick-submit",e,{headers:this.j()})};
ML.prototype.getMobileWorkOrders=function(e){var t=e?new o.HttpParams().set("workSiteId",e):void 0;return this.h.get(MOBILE_API_BASE+"work-orders",{headers:this.j(),params:t})};
ML.prototype.locationCheckin=function(e){return this.h.post(MOBILE_API_BASE+"location/checkin",e,{headers:this.j()})};
ML.prototype.getOfflineSyncBundle=function(e){var t=e?new o.HttpParams().set("since",e):void 0;return this.h.get(MOBILE_API_BASE+"offline-sync",{headers:this.j(),params:t})};
ML.prototype.j=function(){var e=localStorage.getItem("ptw_token")||"";return{"Authorization":"Bearer "+e,"X-Mobile-Client":"permit-app/2.1"}};
t.MobileLegacyService=ML;}}]);
//# sourceMappingURL=permit-mobile-legacy.js.map
