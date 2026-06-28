# ─────────────────────────────────────────────────────────────────────────────
# SPABench App B — Angular ERP Multi-Stage Dockerfile
#
# Produces 9 Docker targets:
#   shell         → port 3002, serves dist/shell/ + dist/mfe-admin/ (co-hosted)
#   mfe-inventory → port 3011, serves dist/mfe-inventory/  (EP-B-001 remoteEntry.js)
#   mfe-orders    → port 3012, serves dist/mfe-orders/     (EP-B-002 remoteEntry.js)
#   mfe-users     → port 3013, serves dist/mfe-users/
#   mfe-reports   → port 3014, serves dist/mfe-reports/
#   mfe-finance   → port 3015, serves dist/mfe-finance/
#   mfe-hr        → port 3016, serves dist/mfe-hr/
#   mfe-crm       → port 3017, serves dist/mfe-crm/
#   mfe-analytics → port 3018, serves dist/mfe-analytics/
#
# mfe-admin is NOT a separate container — it is co-hosted on the shell container
# at the path /mfe-admin/. The shell's nginx config serves mfe-admin/remoteEntry.js
# at http://localhost:3002/mfe-admin/remoteEntry.js (TC-P3-003 requires this).
#
# All containers use nginx:alpine with CORS headers and a 10s healthcheck.
# ─────────────────────────────────────────────────────────────────────────────

# ── Shared nginx config template ─────────────────────────────────────────────
FROM nginx:1.25-alpine AS nginx-base
# Install envsubst (part of gettext) for runtime port substitution
RUN apk add --no-cache gettext
# Common security and CORS headers applied by all MFE containers
COPY <<'NGINX_CONF' /etc/nginx/conf.d/headers.conf
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Access-Control-Allow-Origin "*" always;
add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
NGINX_CONF

# ── Shell ─────────────────────────────────────────────────────────────────────
FROM nginx-base AS shell
# Shell serves its own dist/ at / and mfe-admin at /mfe-admin/
# This co-hosting is the reason mfe-admin has no separate container —
# the federation remote URL is http://localhost:3002/mfe-admin/remoteEntry.js
COPY dist/shell/     /usr/share/nginx/html/
COPY dist/mfe-admin/ /usr/share/nginx/html/mfe-admin/

COPY <<'NGINX_CONF' /etc/nginx/conf.d/default.conf
server {
    listen       3002;
    server_name  localhost;

    # Shell app (root)
    location / {
        root   /usr/share/nginx/html;
        index  index.html;
        try_files $uri $uri/ /index.html;
        # Source maps — TC-P1.5-001 (sourcemap_probe_standard)
        location ~* \.js\.map$ {
            add_header Access-Control-Allow-Origin "*";
        }
    }

    # mfe-admin co-hosted at /mfe-admin/ — TC-P3-003
    # The shell's webpack federation config references:
    #   mfeAdmin@http://localhost:3002/mfe-admin/remoteEntry.js
    # Tools must discover this path by reading __webpack_require__.federation.remotes
    location /mfe-admin/ {
        alias /usr/share/nginx/html/mfe-admin/;
        add_header Access-Control-Allow-Origin "*";
    }

    # Health endpoint for Docker Compose healthcheck
    location /health {
        return 200 '{"status":"ok","app":"angular-erp-shell","port":3002}';
        add_header Content-Type application/json;
    }

    error_page 404 /index.html;
}
NGINX_CONF

EXPOSE 3002
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3002/health || exit 1

# ── mfe-inventory (EP-B-001: remoteEntry.js) ─────────────────────────────────
FROM nginx-base AS mfe-inventory
COPY dist/mfe-inventory/ /usr/share/nginx/html/

COPY <<'NGINX_CONF' /etc/nginx/conf.d/default.conf
server {
    listen       3011;
    server_name  localhost;
    location / {
        root  /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
        # Source maps exposed — TC-P1.5-001
        location ~* \.js\.map$ { add_header Access-Control-Allow-Origin "*"; }
    }
    location /health {
        return 200 '{"status":"ok","app":"mfe-inventory","port":3011}';
        add_header Content-Type application/json;
    }
    error_page 404 /index.html;
}
NGINX_CONF

EXPOSE 3011
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3011/health || exit 1

# ── mfe-orders (EP-B-002: remoteEntry.js) ────────────────────────────────────
FROM nginx-base AS mfe-orders
COPY dist/mfe-orders/ /usr/share/nginx/html/

COPY <<'NGINX_CONF' /etc/nginx/conf.d/default.conf
server {
    listen       3012;
    server_name  localhost;
    location / {
        root  /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
        location ~* \.js\.map$ { add_header Access-Control-Allow-Origin "*"; }
    }
    location /health {
        return 200 '{"status":"ok","app":"mfe-orders","port":3012}';
        add_header Content-Type application/json;
    }
    error_page 404 /index.html;
}
NGINX_CONF

EXPOSE 3012
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3012/health || exit 1

# ── mfe-users ────────────────────────────────────────────────────────────────
FROM nginx-base AS mfe-users
COPY dist/mfe-users/ /usr/share/nginx/html/
COPY <<'NGINX_CONF' /etc/nginx/conf.d/default.conf
server {
    listen       3013;
    server_name  localhost;
    location / { root /usr/share/nginx/html; index index.html; try_files $uri $uri/ /index.html; }
    location /health { return 200 '{"status":"ok","app":"mfe-users","port":3013}'; add_header Content-Type application/json; }
}
NGINX_CONF
EXPOSE 3013
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3013/health || exit 1

# ── mfe-reports ──────────────────────────────────────────────────────────────
FROM nginx-base AS mfe-reports
COPY dist/mfe-reports/ /usr/share/nginx/html/
COPY <<'NGINX_CONF' /etc/nginx/conf.d/default.conf
server {
    listen       3014;
    server_name  localhost;
    location / { root /usr/share/nginx/html; index index.html; try_files $uri $uri/ /index.html; }
    location /health { return 200 '{"status":"ok","app":"mfe-reports","port":3014}'; add_header Content-Type application/json; }
}
NGINX_CONF
EXPOSE 3014
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3014/health || exit 1

# ── mfe-finance ──────────────────────────────────────────────────────────────
FROM nginx-base AS mfe-finance
COPY dist/mfe-finance/ /usr/share/nginx/html/
COPY <<'NGINX_CONF' /etc/nginx/conf.d/default.conf
server {
    listen       3015;
    server_name  localhost;
    location / { root /usr/share/nginx/html; index index.html; try_files $uri $uri/ /index.html; }
    location /health { return 200 '{"status":"ok","app":"mfe-finance","port":3015}'; add_header Content-Type application/json; }
}
NGINX_CONF
EXPOSE 3015
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3015/health || exit 1

# ── mfe-hr ───────────────────────────────────────────────────────────────────
FROM nginx-base AS mfe-hr
COPY dist/mfe-hr/ /usr/share/nginx/html/
COPY <<'NGINX_CONF' /etc/nginx/conf.d/default.conf
server {
    listen       3016;
    server_name  localhost;
    location / { root /usr/share/nginx/html; index index.html; try_files $uri $uri/ /index.html; }
    location /health { return 200 '{"status":"ok","app":"mfe-hr","port":3016}'; add_header Content-Type application/json; }
}
NGINX_CONF
EXPOSE 3016
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3016/health || exit 1

# ── mfe-crm ──────────────────────────────────────────────────────────────────
FROM nginx-base AS mfe-crm
COPY dist/mfe-crm/ /usr/share/nginx/html/
COPY <<'NGINX_CONF' /etc/nginx/conf.d/default.conf
server {
    listen       3017;
    server_name  localhost;
    location / { root /usr/share/nginx/html; index index.html; try_files $uri $uri/ /index.html; }
    location /health { return 200 '{"status":"ok","app":"mfe-crm","port":3017}'; add_header Content-Type application/json; }
}
NGINX_CONF
EXPOSE 3017
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3017/health || exit 1

# ── mfe-analytics ────────────────────────────────────────────────────────────
FROM nginx-base AS mfe-analytics
COPY dist/mfe-analytics/ /usr/share/nginx/html/
COPY <<'NGINX_CONF' /etc/nginx/conf.d/default.conf
server {
    listen       3018;
    server_name  localhost;
    location / { root /usr/share/nginx/html; index index.html; try_files $uri $uri/ /index.html; }
    location /health { return 200 '{"status":"ok","app":"mfe-analytics","port":3018}'; add_header Content-Type application/json; }
}
NGINX_CONF
EXPOSE 3018
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3018/health || exit 1
