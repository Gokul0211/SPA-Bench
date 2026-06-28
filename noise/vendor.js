/**
 * SPABench — Vendor Noise Fixture Bundle
 *
 * This file simulates the vendor noise that gets bundled into real SPA builds.
 * It is used by evaluate.py to compute the Vendor Noise Rate metric:
 *
 *   Vendor Noise Rate = FPs attributable to bundled libraries / Total FPs
 *
 * Any URL-like string in a tool's output that matches a pattern in this file
 * is classified as a vendor noise false positive, not a real API endpoint.
 *
 * TC-NOISE-001: noise_momentjs
 * TC-NOISE-002: noise_exceljs
 * TC-NOISE-003: noise_angular_compiler
 * TC-NOISE-004: noise_pdfjs
 * TC-NOISE-005: noise_nodejs_streams
 * TC-NOISE-006: noise_template_literal_artifacts
 * TC-NOISE-007: noise_react_component_names
 * TC-NOISE-008: noise_router_navigation
 */

// ─────────────────────────────────────────────────────────────────────────────
// TC-NOISE-001: Moment.js locale strings
// These appear as paths in Moment.js bundles. LinkFinder extracted 127 of these
// as "endpoints" from Target-B, accounting for 34% of its false positive mass.
// FP detection method: path indicator matching (node_modules/moment)
// ─────────────────────────────────────────────────────────────────────────────
var momentLocales = {
  "en-gb": { months: "January_February_March_April_May_June_July_August_September_October_November_December".split("_") },
  "zh-cn": { months: "一月_二月_三月_四月_五月_六月_七月_八月_九月_十月_十一月_十二月".split("_") },
  "de": { months: "Januar_Februar_März_April_Mai_Juni_Juli_August_September_Oktober_November_Dezember".split("_") },
  "fr": { months: "janvier_février_mars_avril_mai_juin_juillet_août_septembre_octobre_novembre_décembre".split("_") },
  "ja": { months: "1月_2月_3月_4月_5月_6月_7月_8月_9月_10月_11月_12月".split("_") },
  "ko": { months: "1월_2월_3월_4월_5월_6월_7월_8월_9월_10월_11월_12월".split("_") },
  "es": { months: "enero_febrero_marzo_abril_mayo_junio_julio_agosto_septiembre_octubre_noviembre_diciembre".split("_") },
};
// Paths that appear in the bundle and look like URL fragments to naive regex tools:
// node_modules/moment/locale/en-gb.js
// node_modules/moment/locale/zh-cn.js
// node_modules/moment/locale/de.js
var momentPaths = [
  "node_modules/moment/locale/en-gb",
  "node_modules/moment/locale/zh-cn",
  "node_modules/moment/locale/de",
  "node_modules/moment/locale/fr",
  "node_modules/moment/locale/ja",
  "node_modules/moment/locale/ko",
  "node_modules/moment/locale/es",
  "node_modules/moment/moment.js",
  "node_modules/moment/min/moment.min.js",
];

// ─────────────────────────────────────────────────────────────────────────────
// TC-NOISE-002: ExcelJS XML module paths
// ExcelJS embeds Open XML spreadsheet paths. LinkFinder extracted 89 of these
// from Target-B, treating them as API endpoint candidates.
// FP detection method: library name signature (exceljs)
// ─────────────────────────────────────────────────────────────────────────────
var exceljsPaths = {
  worksheets:    "/xl/worksheets/sheet1.xml",
  sharedStrings: "/xl/sharedStrings.xml",
  styles:        "/xl/styles.xml",
  workbook:      "/xl/workbook.xml",
  relationships: "/xl/_rels/workbook.xml.rels",
  contentTypes:  "/[Content_Types].xml",
  coreProps:     "/docProps/core.xml",
  appProps:      "/docProps/app.xml",
  theme:         "/xl/theme/theme1.xml",
  drawings:      "/xl/drawings/drawing1.xml",
};
var exceljsModulePaths = [
  "node_modules/exceljs/lib/xlsx/xform/sheet/worksheet-xform.js",
  "node_modules/exceljs/lib/xlsx/xform/shared-strings-xform.js",
  "node_modules/exceljs/lib/xlsx/xform/style/styles-xform.js",
];

// ─────────────────────────────────────────────────────────────────────────────
// TC-NOISE-003: Angular compiler artifacts
// Angular's build output includes internal compiler paths that look like URLs.
// LinkFinder extracted 74 of these from Target-B.
// FP detection method: filename hash pattern, @angular prefix
// ─────────────────────────────────────────────────────────────────────────────
var angularCompilerPaths = [
  "/@angular/core",
  "/@angular/core/esm2022/core.mjs",
  "/@angular/common",
  "/@angular/common/http",
  "/node_modules/@angular/common/http",
  "/@angular/router",
  "/@angular/platform-browser",
  "/@angular/forms",
  "/@angular/animations",
  "/@angular/compiler",
  "/@angular/core/index.js",
  "/node_modules/@angular/core/fesm2022/core.mjs",
  "/@angular/cdk/platform",
  "/@angular/material/core",
];
var angularInternalSymbols = [
  "ɵɵdefineComponent",
  "ɵɵdefineNgModule",
  "ɵɵdirectiveInject",
  "ɵɵelementStart",
  "ɵɵtext",
  "ɵɵelementEnd",
];

// ─────────────────────────────────────────────────────────────────────────────
// TC-NOISE-004: PDF.js spec keywords
// PDF.js bundles PDF spec keywords that look like API paths to regex tools.
// LinkFinder extracted 51 of these from Target-B.
// FP detection method: known library artifact list
// ─────────────────────────────────────────────────────────────────────────────
var pdfjsSpecKeywords = [
  "/Type /Page",
  "/MediaBox",
  "/Resources",
  "/Contents",
  "/Parent",
  "/Kids",
  "/Count",
  "/Type /Catalog",
  "/Pages",
  "/Type /Font",
  "/Subtype /Type1",
  "/BaseFont",
  "/Encoding",
  "/Type /XObject",
  "/Subtype /Image",
];
var pdfjsPaths = [
  "node_modules/pdfjs-dist/build/pdf.js",
  "node_modules/pdfjs-dist/build/pdf.worker.js",
  "node_modules/pdfjs-dist/web/pdf_viewer.js",
];

// ─────────────────────────────────────────────────────────────────────────────
// TC-NOISE-005: Node.js stream paths
// Node.js stream module internals bundled via browserify/webpack shims.
// FP detection method: vendor source heuristic (stream/ prefix)
// ─────────────────────────────────────────────────────────────────────────────
var nodejsStreamPaths = [
  "stream/passthrough",
  "stream/transform",
  "stream/readable",
  "stream/writable",
  "stream/duplex",
  "node_modules/readable-stream/lib/_stream_passthrough.js",
  "node_modules/readable-stream/lib/_stream_transform.js",
  "node_modules/readable-stream/lib/_stream_readable.js",
  "node_modules/stream-browserify/index.js",
  "node_modules/util/util.js",
  "node_modules/buffer/index.js",
  "node_modules/events/events.js",
  "node_modules/path-browserify/index.js",
];

// ─────────────────────────────────────────────────────────────────────────────
// TC-NOISE-006: Template literal bundler artifacts
// Bundlers generate synthetic path tokens during code splitting.
// These look like URL patterns to naive tools.
// FP detection method: structural analysis (variable-looking segments)
// ─────────────────────────────────────────────────────────────────────────────
(function templateLiteralNoise() {
  var prefix = "component";
  var hash = Math.random().toString(36).slice(2, 8);
  // Bundler-generated: ${prefix}/component-${hash}
  // These are NOT real API paths — they are internal chunk identifiers
  var chunkId = prefix + "/component-" + hash;
  var moduleId = prefix + "/module-" + hash;
  var lazyChunk = "/static/js/" + prefix + "." + hash + ".chunk.js";
  // react-loadable, Next.js, and similar bundlers emit these patterns
  var nextChunk = "/_next/static/chunks/" + prefix + "-" + hash + ".js";
  var webpackChunk = "/webpack-" + hash + "/chunk/" + prefix;
  return { chunkId, moduleId, lazyChunk, nextChunk, webpackChunk };
})();

// ─────────────────────────────────────────────────────────────────────────────
// TC-NOISE-007: React component names in error boundaries
// React dev tools and error boundaries embed component display names.
// These match broad URL patterns (CamelCase = potential endpoint segment).
// FP detection method: frontend_route_nav LR penalty (0.05)
// Expected FP count: 0 (tools with penalty signal suppress these)
// ─────────────────────────────────────────────────────────────────────────────
var reactComponentNames = {
  // These look like path segments to naive regex: /ProductCard, /CheckoutForm, etc.
  "ProductCard":         { displayName: "ProductCard", type: "Component" },
  "CheckoutForm":        { displayName: "CheckoutForm", type: "Component" },
  "UserProfile":         { displayName: "UserProfile", type: "Component" },
  "OrderHistory":        { displayName: "OrderHistory", type: "Component" },
  "PaymentGateway":      { displayName: "PaymentGateway", type: "Component" },
  "AdminDashboard":      { displayName: "AdminDashboard", type: "Component" },
  "InventoryTable":      { displayName: "InventoryTable", type: "Component" },
  "ReportGenerator":     { displayName: "ReportGenerator", type: "Component" },
  "NotificationCenter":  { displayName: "NotificationCenter", type: "Component" },
};
// Error boundary wraps — component names appear as strings here
function ErrorBoundary(props) {
  try { return props.children; }
  catch(e) {
    console.error("Error in " + (props.componentName || "UnknownComponent") + ":", e);
    return null;
  }
}
function withErrorBoundary(Component, componentName) {
  return function WrappedComponent(props) {
    return ErrorBoundary({ children: Component(props), componentName: componentName });
  };
}
var BoundedProductCard     = withErrorBoundary(function ProductCard(p) { return null; }, "ProductCard");
var BoundedCheckoutForm    = withErrorBoundary(function CheckoutForm(p) { return null; }, "CheckoutForm");
var BoundedUserProfile     = withErrorBoundary(function UserProfile(p) { return null; }, "UserProfile");
var BoundedAdminDashboard  = withErrorBoundary(function AdminDashboard(p) { return null; }, "AdminDashboard");

// ─────────────────────────────────────────────────────────────────────────────
// TC-NOISE-008: Angular router navigation calls
// Angular's router.navigate() calls contain path arrays that regex tools
// extract as API endpoint candidates.
// FP detection method: frontend_route_nav LR penalty (0.05)
// Expected FP count: 0
// ─────────────────────────────────────────────────────────────────────────────
var mockRouter = {
  navigate: function(commands, extras) { return Promise.resolve(true); },
  navigateByUrl: function(url) { return Promise.resolve(true); },
};
// These navigation paths look like API endpoints to naive regex tools:
function navigateToDashboard() { mockRouter.navigate(["/dashboard/reports"]); }
function navigateToAdmin()     { mockRouter.navigate(["/admin/users"]); }
function navigateToProfile()   { mockRouter.navigate(["/user/profile/settings"]); }
function navigateToOrders()    { mockRouter.navigate(["/orders/history"]); }
function navigateToCheckout()  { mockRouter.navigate(["/checkout/payment"]); }
function navigateToInventory() { mockRouter.navigate(["/inventory/warehouse/items"]); }
function navigateToReports()   { mockRouter.navigate(["/reports/analytics/dashboard"]); }
function navigateToSettings()  { mockRouter.navigateByUrl("/settings/notifications/preferences"); }
// routerLink directives also produce these patterns in Angular templates:
var routerLinks = [
  "/dashboard/reports",
  "/admin/users",
  "/user/profile/settings",
  "/orders/history",
  "/checkout/payment",
  "/inventory/warehouse/items",
  "/reports/analytics/dashboard",
  "/settings/notifications/preferences",
  "/team/members/invite",
  "/billing/plans/upgrade",
];

// Export noise patterns for evaluate.py reference
if (typeof module !== "undefined") {
  module.exports = {
    momentPaths,
    exceljsPaths: Object.values(exceljsPaths),
    exceljsModulePaths,
    angularCompilerPaths,
    pdfjsSpecKeywords,
    pdfjsPaths,
    nodejsStreamPaths,
    routerLinks,
    reactComponentNames: Object.keys(reactComponentNames),
  };
}
