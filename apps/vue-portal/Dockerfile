# SPABench App D — Vue Government Portal (Nuxt)
# CRITICAL: Source maps are intentionally BLOCKED — all .map requests return 404.
# This implements TC-P1.5-006 (sourcemap_restricted): tools must degrade gracefully.
# Port 3004
FROM nginx:1.25-alpine
COPY dist/ /usr/share/nginx/html/
COPY <<'NGINX_CONF' /etc/nginx/conf.d/default.conf
server {
    listen       3004;
    server_name  localhost;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # TC-P1.5-006 (sourcemap_restricted):
    # ALL source map requests return 404. This mimics a government security policy
    # of stripping source maps from production deployments. Tools must not crash
    # when probing *.map files — they must degrade and continue with AST analysis.
    location ~* \.map$ {
        return 404;
    }

    # CORS for JS assets
    location ~* \.js$ {
        add_header Access-Control-Allow-Origin "*";
    }

    location /health {
        return 200 '{"status":"ok","app":"vue-portal","port":3004}';
        add_header Content-Type application/json;
    }

    error_page 404 /index.html;
}
NGINX_CONF

EXPOSE 3004
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3004/health || exit 1
