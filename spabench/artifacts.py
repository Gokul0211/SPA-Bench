"""
What each app serves, and where a URL path appears in it.

SERVED mirrors the app Dockerfiles (COPY lines) and docker-compose port
mappings; `audit/bench_audit.py consistency` checks that the two agree.

Evidence vocabulary (strongest/easiest first):
  html       the path is in the served HTML (attribute value or inline script string)
  bundle     every literal run of the path is inside one string literal of served JS
  sourcemap  same test against the sourcesContent of served source maps
A path whose literal runs are only spread over several literals (base URL +
"getPermitType", string arrays, template pieces) is *composed*; whether a
composition really yields the path can't be decided by string matching, so the
ground truth records it by annotation and build_manifest.py cross-checks that
every segment is at least present in the claimed artifact.
"""

import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# app → origin → [(url prefix, repo path)]; a repo path may be a file or a directory
SERVED = {
    'angular-permit': {'http://localhost:3001': [('/', 'apps/angular-permit/dist')]},
    'angular-erp': dict(
        [('http://localhost:3002', [('/mfe-admin/', 'apps/angular-erp/dist/mfe-admin'), ('/', 'apps/angular-erp/dist/shell')])]
        + [(f'http://localhost:{3011 + i}', [('/', f'apps/angular-erp/dist/mfe-{m}')])
           for i, m in enumerate(['inventory', 'orders', 'users', 'reports', 'finance', 'hr', 'crm', 'analytics'])]),
    'react-ecommerce': {'http://localhost:3003': [('/', 'apps/react-ecommerce/dist')]},
    'vue-portal': {'http://localhost:3004': [('/', 'apps/vue-portal/dist')]},
    'nextjs-saas': {'http://localhost:3005': [('/_next/static/', 'apps/nextjs-saas/.next/static'),
                                              ('/dist/', 'apps/nextjs-saas/dist'),
                                              ('/index.html', 'apps/nextjs-saas/.next/index.html')]},
}
MAPS_BLOCKED = {'vue-portal'}           # nginx answers 404 for every *.map
TEXT_EXT = ('.js', '.mjs', '.html', '.map', '.json', '.wsdl', '.xml', '.txt', '.css')


def rp(*parts):
    return os.path.join(ROOT, *parts)


def served_files(app):
    """[(url, repo_path)] for every file the app's web server returns with 200."""
    out = []
    for origin, mounts in SERVED[app].items():
        for prefix, repo in mounts:
            full = rp(repo)
            if os.path.isfile(full):
                out.append((origin + prefix, full))
                continue
            for r, _, fs in os.walk(full):
                for f in sorted(fs):
                    p = os.path.join(r, f)
                    rel = os.path.relpath(p, full).replace(os.sep, '/')
                    if app in MAPS_BLOCKED and f.endswith('.map'):
                        continue
                    out.append((origin + prefix + rel, p))
    # a directory URL serves its index.html
    out += [(url[:-len('index.html')], p) for url, p in out if url.endswith('/index.html')]
    return out


def url_to_file(app, url):
    """Repo file served at `url` (exact static file), or None."""
    for u, p in served_files(app):
        if u == url:
            return p
    return None


# ── JavaScript lexing ────────────────────────────────────────────────────────

REGEX_PRECEDERS = set('(,=:[!&|?{};+-*%<>~^')


def js_tokens(s):
    """Yield (kind, text, offset): kind in code|str|tmpl|regex|comment."""
    i, n, start = 0, len(s), 0
    last = ''
    while i < n:
        c = s[i]
        if c in '\'"':
            j = i + 1
            while j < n and s[j] != c and s[j] != '\n':
                j += 2 if s[j] == '\\' else 1
            yield ('str', s[i + 1:j], i + 1)
            i = j + 1; last = 'x'; continue
        if c == '`':
            j, depth, seg = i + 1, 0, i + 1
            while j < n:
                if s[j] == '\\':
                    j += 2; continue
                if not depth and s.startswith('${', j):
                    yield ('tmpl', s[seg:j], seg)
                    depth = 1; j += 2; continue
                if depth:
                    if s[j] == '{':
                        depth += 1
                    elif s[j] == '}':
                        depth -= 1
                        if not depth:
                            seg = j + 1
                    j += 1; continue
                if s[j] == '`':
                    break
                j += 1
            yield ('tmpl', s[seg:j], seg)
            i = j + 1; last = 'x'; continue
        if s.startswith('//', i) or s.startswith('/*', i):
            j = (s.find('\n', i) if s[i + 1] == '/' else s.find('*/', i + 2) + 2)
            j = n if j < (1 if s[i + 1] == '/' else 2) else j
            yield ('comment', s[i:j], i)
            i = j; continue
        if c == '/' and (last in REGEX_PRECEDERS or last == ''):
            j, cls = i + 1, False
            while j < n and s[j] != '\n':
                if s[j] == '\\':
                    j += 2; continue
                if s[j] == '[':
                    cls = True
                elif s[j] == ']':
                    cls = False
                elif s[j] == '/' and not cls:
                    break
                j += 1
            yield ('regex', s[i:j + 1], i)
            i = j + 1; last = 'x'; continue
        if not c.isspace():
            last = 'x' if (c.isalnum() or c in '_$)]') else c
        i += 1


def js_strings(text):
    """[(value, offset)] of string and template-literal pieces in JS/TS source."""
    return [(t, off) for kind, t, off in js_tokens(text) if kind in ('str', 'tmpl')]


def html_strings(text):
    """Attribute values and inline-script string literals of an HTML document."""
    out = [(m.group(2), m.start(2)) for m in re.finditer(r'\s[\w:-]+\s*=\s*(["\'])(.*?)\1', text, re.S)]
    for m in re.finditer(r'<script\b[^>]*>(.*?)</script>', text, re.S | re.I):
        out += [(v, m.start(1) + off) for v, off in js_strings(m.group(1))]
    for m in re.finditer(r'<!--(.*?)-->', text, re.S):           # commented-out tags are still in the page
        out += [(mm.group(2), m.start(1) + mm.start(2)) for mm in re.finditer(r'\s[\w:-]+\s*=\s*(["\'])(.*?)\1', m.group(1))]
    return out


def line_col(text, offset):
    line = text.count('\n', 0, offset) + 1
    col = offset - (text.rfind('\n', 0, offset) + 1) + 1
    return line, col


class Corpus:
    """String literals of one app's served artifacts, split by artifact class."""

    def __init__(self, app):
        self.app = app
        self.html, self.bundle, self.sourcemap, self.data = [], [], [], []   # (value, where, text, offset)
        self.files = served_files(app)
        for url, path in self.files:
            if not path.endswith(TEXT_EXT):
                continue
            with open(path, encoding='utf-8', errors='replace') as f:
                text = f.read()
            rel = os.path.relpath(path, ROOT).replace(os.sep, '/')
            if path.endswith('.html'):
                self.html += [(v, rel, text, o) for v, o in html_strings(text)]
            elif path.endswith(('.js', '.mjs')):
                self.bundle += [(v, rel, text, o) for v, o in js_strings(text)]
            elif path.endswith('.map'):
                try:
                    m = json.loads(text)
                except ValueError:
                    continue
                for src, content in zip(m.get('sources', []), m.get('sourcesContent') or []):
                    if content:
                        self.sourcemap += [(v, f'{rel}::{src}', content, o) for v, o in js_strings(content)]
            else:
                self.data.append((text, rel, text, 0))

    def find(self, artifact, needle):
        """First (where, text, offset) whose string literal contains needle."""
        for v, where, text, off in getattr(self, artifact):
            k = v.find(needle)
            if k >= 0:
                return where, text, off + k
        return None

    def contains_all(self, artifact, needles):
        return all(self.find(artifact, x) for x in needles)

    def identifier(self, artifact, name):
        """For GraphQL operations: name appears as a word in a string literal (bundle/html) or anywhere (map source)."""
        pat = re.compile(r'\b' + re.escape(name) + r'\b')
        if artifact == 'sourcemap':
            seen = set()
            for _, where, text, _ in self.sourcemap:
                if where in seen:
                    continue
                seen.add(where)
                m = pat.search(text)
                if m:
                    return where, text, m.start()
            return None
        for v, where, text, off in getattr(self, artifact):
            m = pat.search(v)
            if m:
                return where, text, off + m.start()
        return None


def literal_runs(path):
    """'/api/admin/users/{id}/role' → ['/api/admin/users/', '/role'] (literal text between params)."""
    runs = [r for r in re.split(r'\{[^}]+\}', path) if r.strip('/')]
    return runs or [path]


def segments(path):
    return [s for s in path.split('/') if s and not s.startswith('{')]
