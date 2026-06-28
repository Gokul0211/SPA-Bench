# ── SPABench App A — Angular Permit-to-Work SPA ──────────────────────────────
# Multi-stage build:
#   stage 1 (deps): installs wget for the health check binary
#   stage 2 (final): nginx-alpine serves dist/ on port 3001
#
# WHY NGINX (not Node):
# App A is a compiled SPA — dist/ contains only static files (JS, HTML, CSS,
# source maps). There is no server-side rendering and no Node.js process needed
# at runtime. nginx-alpine is smaller (~10 MB vs ~180 MB for node:20-alpine)
# and more representative of how Angular SPAs are actually deployed in production.
#
# SOURCE MAP EXPOSURE:
# The nginx config serves all .map files with status 200 and correct
# Content-Type: application/json headers. This is required for:
#   TC-P1.5-001 (sourcemap_probe_standard): tools probe .js.map → must get 200
#   TC-P1.5-002 (sourcemap_url_directive): bundle.js ends with //# sourceMappingURL=
# If source maps returned 404, all Phase 1.5 test cases would fail silently.
#
# HEALTH CHECK:
# Docker Compose app containers use `depends_on: condition: service_healthy`
# on the REST backend. App A itself needs a health endpoint so any container
# depending on it can use the same pattern. We expose GET /health via nginx
# returning a static JSON file.
#
# PORTS:
# App A runs on port 3001 (matches docker-compose.yml port mapping 3001:80).
# nginx listens on 80 inside the container; Docker maps 3001:80 externally.
#
# NON-ROOT:
# nginx runs as the `nginx` user (uid 101) by default in nginx-alpine.
# No additional user creation needed — consistent with other SPABench containers.

# ── Stage 1: build tooling (currently a passthrough — kept for extensibility) ─
# If App A ever needs a build step (e.g. actual Angular CLI compilation),
# this stage would run: npm ci && ng build --prod
# For now the dist/ directory is pre-generated and copied directly.
FROM nginx:1.27-alpine AS final

# Install wget for HEALTHCHECK (not in nginx-alpine by default)
RUN apk add --no-cache wget

# ── Copy pre-built dist/ ─────────────────────────────────────────────────────
# dist/ contains: index.html, bundle.js, admin-module.js, reports-module.js,
# permit-mobile-legacy.js, vendor.js, runtime.js, polyfills.js, styles.css,
# and all 26 .map files.
COPY dist/ /usr/share/nginx/html/

# ── Health endpoint ───────────────────────────────────────────────────────────
# Writes a static /health JSON file that nginx serves.
# Returns: { "status": "ok", "app": "angular-permit", "port": 3001 }
RUN echo '{"status":"ok","app":"angular-permit","port":3001,"source_maps":26,"chunks":["bundle.js","admin-module.js","reports-module.js","permit-mobile-legacy.js","vendor.js"]}' \
    > /usr/share/nginx/html/health

# ── nginx configuration ───────────────────────────────────────────────────────
# Key behaviours:
#   1. Serve all .map files as application/json (required for TC-P1.5-001)
#   2. Return index.html for all unknown paths (Angular router SPA fallback)
#   3. No caching headers — ensures tools always get fresh source maps
#   4. CORS: Allow-Origin: * so benchmark tools on any port can fetch maps
RUN printf 'server {\n\
    listen 3001;\n\
    server_name localhost;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    # ── Source map exposure (TC-P1.5-001, TC-P1.5-002) ──────────────────────\n\
    # .map files served as application/json with CORS headers.\n\
    # Tools probe <bundle>.js.map — must get 200 with valid JSON.\n\
    location ~* \\.map$ {\n\
        add_header Content-Type "application/json; charset=utf-8";\n\
        add_header Access-Control-Allow-Origin "*";\n\
        add_header Cache-Control "no-store, no-cache";\n\
        try_files $uri =404;\n\
    }\n\
\n\
    # ── JavaScript bundles ───────────────────────────────────────────────────\n\
    location ~* \\.js$ {\n\
        add_header Content-Type "application/javascript; charset=utf-8";\n\
        add_header Access-Control-Allow-Origin "*";\n\
        add_header Cache-Control "no-store, no-cache";\n\
        try_files $uri =404;\n\
    }\n\
\n\
    # ── Health endpoint ──────────────────────────────────────────────────────\n\
    location = /health {\n\
        add_header Content-Type "application/json; charset=utf-8";\n\
        try_files /health =404;\n\
    }\n\
\n\
    # ── SPA fallback — Angular router ────────────────────────────────────────\n\
    # All unknown paths return index.html so Angular router handles navigation.\n\
    # This is what allows /admin, /reports, /permits etc. to work in the browser.\n\
    location / {\n\
        add_header Access-Control-Allow-Origin "*";\n\
        add_header Cache-Control "no-store, no-cache";\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

# Health check — verifies nginx is up and serving the app
# Uses /health endpoint (static JSON file) rather than / to avoid
# triggering Angular router logic in the health check response
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
    CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
