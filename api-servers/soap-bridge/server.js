'use strict';

/**
 * SPABench SOAP Bridge — port 4004
 *
 * Bridges the legacy LegacyHRService WSDL as REST POST endpoints for App D
 * (vue-portal). Serves the WSDL itself so the Vue portal can fetch and parse
 * it at request time — that runtime parse is what makes the three bridge
 * endpoints exclusively discoverable via dynamic interception.
 *
 * ── Why routes are NOT hardcoded ─────────────────────────────────────────────
 *
 * EP-D-002, EP-D-003, EP-D-004 are all:
 *   exclusive: true
 *   technique: soap_bridge_dynamic
 *   source_file: null
 *   minified_location: null
 *
 * This means the bridge paths (/api/legacy/bridge/getEmployeeRecord etc.)
 * must NEVER appear as string literals anywhere in a static-analysable source.
 * If they were hardcoded here, a tool that scans this server's source would
 * find them via string matching — invalidating the exclusive/dynamic claim.
 *
 * Instead, this server:
 *   1. Reads the WSDL file at startup (readFileSync)
 *   2. Parses it with xml2js to extract <operation name="..."> elements
 *   3. Registers Express routes for each operation name at runtime
 *
 * The vue-portal does the same thing server-side: it fetches
 * http://soap-bridge:4004/wsdl/legacy-service.wsdl, parses the portType
 * operations, and constructs the bridge POST URLs dynamically. That fetch and
 * parse is what Phase 3 dynamic interception captures — it is the only moment
 * these URLs exist in observable form.
 *
 * ── Endpoints ────────────────────────────────────────────────────────────────
 *
 *   GET  /health
 *     Docker health check. Returns { status, operations, uptime }.
 *
 *   GET  /wsdl/legacy-service.wsdl
 *     Serves the raw WSDL XML. The vue-portal fetches this at runtime.
 *     Also the starting point for any dynamic tool that intercepts XHR/Fetch.
 *
 *   GET  /api/legacy/bridge
 *     Bridge discovery index. Returns JSON listing all registered operations
 *     and the WSDL location. Useful for manual inspection and sanity_check.py.
 *
 *   POST /api/legacy/bridge/:operation    (routes registered at startup)
 *     One route per WSDL portType operation:
 *       getEmployeeRecord  (EP-D-002)
 *       updatePayroll      (EP-D-003)
 *       generateReport     (EP-D-004)
 *     Auth: form (JWT or express-session cookie).
 *     Accepts JSON body. Responds with XML SOAP envelope (legacy fidelity) AND
 *     a JSON shadow under the same path via content negotiation.
 *
 * ── Auth ─────────────────────────────────────────────────────────────────────
 *
 * App D uses form auth (auth_method: "form") — same as App A.
 * Accepts:
 *   1. Authorization: Bearer <jwt>         — issued by rest-backend /api/auth/login
 *   2. Cookie: connect.sid (express-session) — for browser-based flows
 * Static BENCH_BEARER_TOKEN NOT accepted here — App D uses form auth only.
 *
 * ── Response format ───────────────────────────────────────────────────────────
 *
 * Returns XML SOAP envelope by default (Content-Type: text/xml).
 * If Accept: application/json is present, returns JSON instead.
 * This matches the legacy bridge pattern: the SOAP service itself speaks XML,
 * but the bridge adapter can translate to JSON for modern clients.
 *
 * ── Environment variables ─────────────────────────────────────────────────────
 *
 *   PORT                4004
 *   BENCH_AUTH_SECRET   JWT signing secret
 */

const express    = require('express');
const cors       = require('cors');
const jwt        = require('jsonwebtoken');
const fs         = require('fs');
const path       = require('path');
const xml2js     = require('xml2js');

const PORT        = parseInt(process.env.PORT || '4004', 10);
const AUTH_SECRET = process.env.BENCH_AUTH_SECRET || 'spabench-dev-secret-do-not-use-in-production';

const WSDL_PATH = path.join(__dirname, 'wsdl', 'legacy-service.wsdl');

// ── Auth middleware ───────────────────────────────────────────────────────────
/**
 * Form auth: accepts JWT from Authorization header or session cookie.
 * App D does NOT accept the static BENCH_BEARER_TOKEN — it uses form auth only.
 */
function requireFormAuth(req, res, next) {
  // 1. Bearer JWT in Authorization header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    try {
      const payload = jwt.verify(token, AUTH_SECRET);
      req.benchUser = { username: payload.sub, role: payload.role };
      return next();
    } catch {
      return res.status(401).json({ error: 'Unauthorized', detail: 'Invalid or expired JWT' });
    }
  }

  // 2. Session cookie (express-session set by rest-backend /api/auth/login)
  // In Docker, both servers share the same BENCH_AUTH_SECRET. The vue-portal
  // server-side code attaches the session token as a custom header when
  // proxying to the SOAP bridge.
  const sessionToken = req.headers['x-session-token'];
  if (sessionToken) {
    try {
      const payload = jwt.verify(sessionToken, AUTH_SECRET);
      req.benchUser = { username: payload.sub, role: payload.role };
      return next();
    } catch {
      return res.status(401).json({ error: 'Unauthorized', detail: 'Invalid session token' });
    }
  }

  return res.status(401).json({
    error:  'Unauthorized',
    detail: 'App D uses form auth. Provide Authorization: Bearer <jwt> or X-Session-Token header.',
  });
}

// ── XML helpers ───────────────────────────────────────────────────────────────
function soapEnvelope(operationName, bodyContent) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:tns="urn:spabench:legacy:hr">
  <soap:Header>
    <tns:BridgeMetadata>
      <tns:operation>${operationName}</tns:operation>
      <tns:processedAt>${new Date().toISOString()}</tns:processedAt>
      <tns:bridgeVersion>spabench-soap-bridge/1.0</tns:bridgeVersion>
    </tns:BridgeMetadata>
  </soap:Header>
  <soap:Body>
${bodyContent}
  </soap:Body>
</soap:Envelope>`;
}

function soapFault(code, message) {
  return soapEnvelope('Fault', `    <soap:Fault>
      <faultcode>${code}</faultcode>
      <faultstring>${message}</faultstring>
    </soap:Fault>`);
}

function sendResponse(req, res, operationName, xmlBody, jsonPayload) {
  const wantsJson = (req.headers['accept'] || '').includes('application/json');
  if (wantsJson) {
    return res.json({ operation: operationName, result: jsonPayload, timestamp: new Date().toISOString() });
  }
  res.set('Content-Type', 'text/xml; charset=utf-8');
  res.send(soapEnvelope(operationName, xmlBody));
}

// ── Seed data — 40 synthetic government employees (matches rest-backend App D) ─
const EMPLOYEES = Array.from({ length: 40 }, (_, i) => {
  const n = i + 1;
  const depts = ['HR', 'Finance', 'Engineering', 'Operations', 'Legal', 'Compliance', 'IT', 'Procurement'];
  const grades = ['G1', 'G2', 'G3', 'G4', 'G5', 'SES-1'];
  return {
    employeeId:  `EMP-${String(n).padStart(4, '0')}`,
    fullName:    `Employee ${n} Name`,
    department:  depts[n % depts.length],
    grade:       grades[n % grades.length],
    hireDate:    `${2005 + (n % 18)}-${String((n % 12) + 1).padStart(2, '0')}-01`,
    salary:      45000 + (n * 1250),
    managerId:   n > 5 ? `EMP-${String(Math.ceil(n / 5)).padStart(4, '0')}` : null,
  };
});
const EMPLOYEE_MAP = Object.fromEntries(EMPLOYEES.map(e => [e.employeeId, e]));

// ── Operation handlers ────────────────────────────────────────────────────────
// Keyed by WSDL operation name — populated at startup after WSDL parse.
// Each handler: (req, res) → void
const HANDLERS = {};

HANDLERS['getEmployeeRecord'] = function(req, res) {
  const { employeeId } = req.body;
  if (!employeeId) {
    res.set('Content-Type', 'text/xml; charset=utf-8');
    return res.status(400).send(soapFault('Client', 'employeeId is required'));
  }
  const emp = EMPLOYEE_MAP[employeeId] || EMPLOYEE_MAP['EMP-0001'];
  const xmlBody = `    <tns:GetEmployeeRecordResponse>
      <tns:employeeId>${emp.employeeId}</tns:employeeId>
      <tns:fullName>${emp.fullName}</tns:fullName>
      <tns:department>${emp.department}</tns:department>
      <tns:grade>${emp.grade}</tns:grade>
      <tns:hireDate>${emp.hireDate}</tns:hireDate>
      <tns:salary>${emp.salary}</tns:salary>
      ${emp.managerId ? `<tns:managerId>${emp.managerId}</tns:managerId>` : ''}
    </tns:GetEmployeeRecordResponse>`;
  sendResponse(req, res, 'getEmployeeRecord', xmlBody, emp);
};

HANDLERS['updatePayroll'] = function(req, res) {
  const { employeeId, salary } = req.body;
  if (!employeeId || salary == null) {
    res.set('Content-Type', 'text/xml; charset=utf-8');
    return res.status(400).send(soapFault('Client', 'employeeId and salary are required'));
  }
  if (req.benchUser.role !== 'admin') {
    res.set('Content-Type', 'text/xml; charset=utf-8');
    return res.status(403).send(soapFault('Server', 'Insufficient privileges — admin role required'));
  }
  const emp = EMPLOYEE_MAP[employeeId] || EMPLOYEE_MAP['EMP-0001'];
  const oldSalary = emp.salary;
  emp.salary = parseFloat(salary);
  const result = {
    employeeId:    emp.employeeId,
    newSalary:     emp.salary,
    effectiveDate: new Date().toISOString().slice(0, 10),
    approvedBy:    req.benchUser.username,
    status:        'APPROVED',
  };
  const xmlBody = `    <tns:UpdatePayrollResponse>
      <tns:employeeId>${result.employeeId}</tns:employeeId>
      <tns:newSalary>${result.newSalary}</tns:newSalary>
      <tns:effectiveDate>${result.effectiveDate}</tns:effectiveDate>
      <tns:approvedBy>${result.approvedBy}</tns:approvedBy>
      <tns:status>${result.status}</tns:status>
    </tns:UpdatePayrollResponse>`;
  sendResponse(req, res, 'updatePayroll', xmlBody, result);
};

HANDLERS['generateReport'] = function(req, res) {
  const { reportType, dateRange } = req.body;
  if (!reportType || !dateRange || !dateRange.from || !dateRange.to) {
    res.set('Content-Type', 'text/xml; charset=utf-8');
    return res.status(400).send(soapFault('Client', 'reportType and dateRange.{from,to} are required'));
  }
  const validTypes = ['PAYROLL_SUMMARY', 'COMPLIANCE_AUDIT', 'HEADCOUNT', 'SALARY_BAND', 'TURNOVER'];
  if (!validTypes.includes(reportType)) {
    res.set('Content-Type', 'text/xml; charset=utf-8');
    return res.status(400).send(soapFault('Client', `Invalid reportType. Valid: ${validTypes.join(', ')}`));
  }
  const result = {
    reportId:      `RPT-${Date.now()}`,
    reportType,
    generatedAt:   new Date().toISOString(),
    recordCount:   Math.floor(10 + Math.random() * 200),
    downloadUrl:   `http://localhost:4004/reports/RPT-${Date.now()}.pdf`,
  };
  const xmlBody = `    <tns:GenerateReportResponse>
      <tns:reportId>${result.reportId}</tns:reportId>
      <tns:reportType>${result.reportType}</tns:reportType>
      <tns:generatedAt>${result.generatedAt}</tns:generatedAt>
      <tns:recordCount>${result.recordCount}</tns:recordCount>
      <tns:downloadUrl>${result.downloadUrl}</tns:downloadUrl>
    </tns:GenerateReportResponse>`;
  sendResponse(req, res, 'generateReport', xmlBody, result);
};

// ── Bootstrap — parse WSDL then register routes ───────────────────────────────
async function main() {
  const app = express();

  app.use(cors({ origin: (o, cb) => cb(null, true), credentials: true }));
  app.use(express.json());
  app.use(express.text({ type: 'text/xml' }));   // accept raw SOAP XML bodies too

  // ── Health ──────────────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({
      status:     'ok',
      service:    'spabench-soap-bridge',
      operations: Object.keys(HANDLERS),
      wsdl:       `/wsdl/legacy-service.wsdl`,
      uptime:     process.uptime(),
    });
  });

  // ── Serve WSDL ───────────────────────────────────────────────────────────────
  // This is the WSDL the vue-portal fetches at runtime to compute bridge URLs.
  // Exposed here so dynamic interception tools can also observe the fetch.
  app.get('/wsdl/legacy-service.wsdl', (_req, res) => {
    res.set('Content-Type', 'text/xml; charset=utf-8');
    res.sendFile(WSDL_PATH);
  });

  // ── Parse WSDL → register bridge routes ──────────────────────────────────────
  //
  // DESIGN INVARIANT: bridge route paths are constructed at runtime only.
  // The string "/api/legacy/bridge/" + operationName is assembled here from
  // data parsed out of the WSDL — it is never a string literal in this file.
  // This preserves EP-D-002/003/004 as exclusively runtime-discoverable.
  //
  const wsdlXml     = fs.readFileSync(WSDL_PATH, 'utf8');
  const parsed      = await xml2js.parseStringPromise(wsdlXml, { explicitArray: true });
  const definitions = parsed['definitions'] || parsed['wsdl:definitions'];

  // Navigate the WSDL structure to find portType operations.
  // xml2js key names depend on whether the WSDL uses namespace prefixes.
  // Try both "portType" and "wsdl:portType".
  const portTypes = definitions['portType'] || definitions['wsdl:portType'] || [];
  const operations = [];

  for (const pt of portTypes) {
    const ops = pt['operation'] || pt['wsdl:operation'] || [];
    for (const op of ops) {
      const name = op['$'] && op['$']['name'];
      if (name) operations.push(name);
    }
  }

  if (operations.length === 0) {
    throw new Error('WSDL parse failed — no operations found in portType. Check wsdl/legacy-service.wsdl.');
  }

  // Bridge discovery index
  const bridgeBase = '/api/legacy/bridge';
  app.get(bridgeBase, (_req, res) => {
    res.json({
      description: 'SPABench SOAP bridge — REST adapter for LegacyHRService',
      wsdl:        `http://localhost:${PORT}/wsdl/legacy-service.wsdl`,
      operations:  operations.map(name => ({
        name,
        method:   'POST',
        path:     `${bridgeBase}/${name}`,
        auth:     'form (Authorization: Bearer <jwt> or X-Session-Token header)',
        security: 'legacy_attack_surface',
      })),
    });
  });

  // Register one POST route per WSDL operation
  for (const operationName of operations) {
    const routePath = `${bridgeBase}/${operationName}`;
    const handler   = HANDLERS[operationName];

    if (!handler) {
      console.warn(`[soap-bridge] Warning: no handler for operation "${operationName}" — skipping route`);
      continue;
    }

    app.post(routePath, requireFormAuth, handler);
    console.log(`[soap-bridge] Registered: POST ${routePath}  (${operationName})`);
  }

  // ── 404 fallthrough ─────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[soap-bridge] Listening on port ${PORT}`);
    console.log(`[soap-bridge] WSDL: http://localhost:${PORT}/wsdl/legacy-service.wsdl`);
    console.log(`[soap-bridge] Operations parsed from WSDL: ${operations.join(', ')}`);
    console.log(`[soap-bridge] Health: http://localhost:${PORT}/health`);
  });
}

main().catch(err => {
  console.error('[soap-bridge] startup error:', err);
  process.exit(1);
});
