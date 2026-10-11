"""
Route oracle: what the benchmark's servers actually answer, read from source.

  * Express routers  (api-servers/rest-backend/server.js + routes/*.js)
  * SOAP bridge      (POST /api/legacy/bridge/<op> for every WSDL portType operation)
  * GraphQL backend  (/graphql + the Query/Mutation/Subscription fields of schema.graphql)
  * WebSocket server (ENDPOINT_CHANNELS keys)
  * nginx            (apps/*/nginx/*.conf: proxies, static rules, map blocking, SPA fallback)

`resolve(url, method)` follows a request exactly as nginx + the backend would and
returns (served: bool, how: str). No network access.
"""

import os
import re
from urllib.parse import urlparse

from .artifacts import ROOT, SERVED, MAPS_BLOCKED, rp

BACKENDS = {'localhost:4001': 'rest', 'localhost:4002': 'graphql', 'localhost:4003': 'ws', 'localhost:4004': 'soap'}
SERVICE_BACKEND = {'rest-backend:4001': 'rest', 'graphql-backend:4002': 'graphql',
                   'websocket-backend:4003': 'ws', 'soap-bridge:4004': 'soap'}
# app container → nginx conf (mirrors the Dockerfiles; checked by bench_audit consistency)
NGINX_CONF = {
    'localhost:3001': 'apps/angular-permit/nginx/default.conf',
    'localhost:3002': 'apps/angular-erp/nginx/shell.conf',
    **{f'localhost:{p}': 'apps/angular-erp/nginx/mfe.conf' for p in range(3011, 3019)},
    'localhost:3003': 'apps/react-ecommerce/nginx/default.conf',
    'localhost:3004': 'apps/vue-portal/nginx/default.conf',
    'localhost:3005': 'apps/nextjs-saas/nginx/default.conf',
}
ORIGIN_APP = {urlparse(o).netloc: app for app, origins in SERVED.items() for o in origins}


def _read(p):
    with open(rp(p), encoding='utf-8') as f:
        return f.read()


# ── backends ────────────────────────────────────────────────────────────────

def express_routes():
    """[(METHOD, path_regex, path_pattern, auth, file)]"""
    files = ['api-servers/rest-backend/server.js'] + sorted(
        'api-servers/rest-backend/routes/' + f for f in os.listdir(rp('api-servers/rest-backend/routes')) if f.endswith('.js'))
    out = []
    for f in files:
        text = _read(f)
        aliases = set(re.findall(r'const\s+(\w+)\s*=\s*require(?:Role|Auth)\b', text))
        for m in re.finditer(r'\b(?:router|app)\.(get|post|put|patch|delete|options|all)\(\s*([\'"`])([^\'"`]+)\2\s*,([^\n]*)', text):
            method, path, rest = m.group(1).upper(), m.group(3), m.group(4)
            before_handler = re.split(r'\(\s*_?req\b|\(\s*\)\s*=>', rest)[0]
            auth = bool(re.search(r'\brequire(Auth|Role)\b', before_handler)) or any(
                re.search(r'\b' + a + r'\b', before_handler) for a in aliases)
            rx = '^' + re.sub(r':\w+', '[^/]+', re.escape(path).replace('\\:', ':')) + '/?$'
            out.append((method, re.compile(rx), path, auth, f))
    # app.use('/api-docs', swaggerUi…) serves the Swagger UI under that prefix
    out.append(('GET', re.compile(r'^/api-docs(/.*)?$'), '/api-docs', False, 'api-servers/rest-backend/server.js'))
    return out


def soap_operations():
    w = _read('api-servers/soap-bridge/wsdl/legacy-service.wsdl')
    pt = re.search(r'<portType\b.*?</portType>', w, re.S)
    return re.findall(r'<operation\s+name="(\w+)"', pt.group(0)) if pt else []


def graphql_operations():
    s = _read('api-servers/graphql-backend/schema.graphql')
    s = re.sub(r'"""[\s\S]*?"""', '', s)
    ops = {}
    for typ in ('Query', 'Mutation', 'Subscription'):
        m = re.search(r'type\s+' + typ + r'\s*\{(.*?)\n\}', s, re.S)
        if m:
            for f in re.findall(r'^\s*(\w+)\s*[(:]', m.group(1), re.M):
                ops[f] = typ.lower()
    return ops


def ws_paths():
    s = _read('api-servers/websocket-backend/server.js')
    m = re.search(r'ENDPOINT_CHANNELS\s*=\s*\{(.*?)\n\};', s, re.S)
    return set(re.findall(r'[\'"](/ws/[\w-]+)[\'"]\s*:', m.group(1))) if m else set()


class Backends:
    def __init__(self):
        self.rest = express_routes()
        self.soap_ops = soap_operations()
        self.gql_ops = graphql_operations()
        self.ws = ws_paths()

    def answers(self, kind, method, path):
        """(served, how) for a request that reached backend `kind`."""
        if kind == 'rest':
            for m, rx, pat, auth, f in self.rest:
                if m in (method, 'ALL') and rx.match(path):
                    return True, f'rest {m} {pat}' + (' [auth]' if auth else '')
            return False, f'rest: no {method} route for {path}'
        if kind == 'soap':
            if method == 'GET' and path in ('/api/legacy/bridge', '/wsdl/legacy-service.wsdl', '/health'):
                return True, 'soap index'
            m = re.match(r'^/api/legacy/bridge/(\w+)$', path)
            if method == 'POST' and m and m.group(1) in self.soap_ops:
                return True, f'soap op {m.group(1)}'
            return False, f'soap: no {method} {path}'
        if kind == 'graphql':
            if path == '/graphql' and method in ('GET', 'POST', 'WS'):
                return True, 'graphql endpoint'
            return False, f'graphql: no {path}'
        if kind == 'ws':
            if method == 'WS' and path in self.ws:
                return True, f'ws {path}'
            if method == 'GET' and path == '/health':
                return True, 'ws health'
            return False, f'ws: no {path}'
        return False, f'unknown backend {kind}'


# ── nginx ───────────────────────────────────────────────────────────────────

class Nginx:
    def __init__(self, conf_path):
        text = _read(conf_path)
        text = re.sub(r'#[^\n]*', '', text)
        self.vars = dict(re.findall(r'\bset\s+\$(\w+)\s+(\S+);', text))
        self.locations = []          # (modifier, pattern, body)
        for m in re.finditer(r'location\s+(=|\^~|~\*|~)?\s*(\S+)\s*\{', text):
            depth, i = 1, m.end()
            while depth and i < len(text):
                depth += {'{': 1, '}': -1}.get(text[i], 0)
                i += 1
            self.locations.append((m.group(1) or '', m.group(2), text[m.end():i - 1]))

    def match(self, path):
        exact = [l for l in self.locations if l[0] == '=' and l[1] == path]
        if exact:
            return exact[0]
        prefixes = [l for l in self.locations if l[0] in ('', '^~') and path.startswith(l[1])]
        best = max(prefixes, key=lambda l: len(l[1])) if prefixes else None
        if best and best[0] == '^~':
            return best
        for l in self.locations:
            if l[0] in ('~', '~*') and re.search(l[1], path, re.I if l[0] == '~*' else 0):
                return l
        return best

    def upstream(self, body):
        m = re.search(r'proxy_pass\s+(\S+);', body)
        if not m:
            return None
        target = m.group(1)
        if target.startswith('$'):
            target = self.vars.get(target[1:], target)
        return urlparse(target).netloc


class Oracle:
    def __init__(self):
        self.backends = Backends()
        self.nginx = {host: Nginx(conf) for host, conf in NGINX_CONF.items()}
        self._static = {}

    def static_files(self, host):
        if host not in self._static:
            app = ORIGIN_APP.get(host)
            from .artifacts import served_files
            self._static[host] = {urlparse(u).path for u, _ in served_files(app) if urlparse(u).netloc == host} if app else set()
        return self._static[host]

    def resolve(self, url, method='GET'):
        """(served, how) for one request. method may be WS or GRAPHQL (= POST /graphql)."""
        u = urlparse(url)
        host, path = u.netloc, u.path or '/'
        method = 'POST' if method == 'GRAPHQL' else method.upper()
        if host in BACKENDS:
            return self.backends.answers(BACKENDS[host], method, path)
        if host not in self.nginx:
            return False, f'host {host} is not served by the benchmark'
        loc = self.nginx[host].match(path)
        if loc is None:
            return False, f'nginx {host}: no location for {path}'
        mod, pat, body = loc
        if re.search(r'\breturn\s+404\b', body):
            return False, f'nginx {host}: {pat} returns 404'
        if 'proxy_pass' in body:
            up = self.nginx[host].upstream(body)
            kind = SERVICE_BACKEND.get(up)
            if not kind:
                return False, f'nginx {host}: proxies to unknown upstream {up}'
            if method == 'WS' and 'Upgrade' not in body:
                return False, f'nginx {host}: {pat} does not forward WebSocket upgrades'
            ok, how = self.backends.answers(kind, method, path)
            return ok, f'nginx {host} {mod}{pat} → {up}: {how}'
        if method not in ('GET', 'HEAD'):
            return False, f'nginx {host}: {method} on a static location'
        if path in self.static_files(host):
            return True, f'static file {path}'
        return False, f'nginx {host}: {path} is not a file (SPA fallback or 404)'

    def emit(self):
        """Every served (method, url-pattern) — the oracle file used by evaluate.py."""
        routes = []
        for m, _, pat, auth, f in self.backends.rest:
            routes.append({'backend': 'rest', 'method': m, 'path': re.sub(r':(\w+)', r'{\1}', pat), 'auth': auth})
        for op in self.backends.soap_ops:
            routes.append({'backend': 'soap', 'method': 'POST', 'path': f'/api/legacy/bridge/{op}', 'auth': True})
        routes.append({'backend': 'soap', 'method': 'GET', 'path': '/api/legacy/bridge', 'auth': False})
        routes.append({'backend': 'graphql', 'method': 'POST', 'path': '/graphql', 'auth': False})
        for op, typ in sorted(self.backends.gql_ops.items()):
            routes.append({'backend': 'graphql', 'method': 'GRAPHQL', 'path': f'/graphql#{op}', 'operation_type': typ})
        for p in sorted(self.backends.ws):
            routes.append({'backend': 'ws', 'method': 'WS', 'path': p, 'auth': True})
        proxies = {}
        for host, ng in self.nginx.items():
            proxies[host] = [{'location': l[0] + l[1], 'upstream': ng.upstream(l[2])} for l in ng.locations if 'proxy_pass' in l[2]]
        return {'backends': BACKENDS, 'routes': routes, 'frontend_proxies': proxies,
                'static': {h: sorted(self.static_files(h)) for h in self.nginx},
                'maps_blocked': sorted(MAPS_BLOCKED)}
