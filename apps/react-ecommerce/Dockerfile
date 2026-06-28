# SPABench App C — React E-Commerce (Vite)
# Serves pre-built dist/ — source maps exposed (TC-P1.5-001, TC-P1.5-005)
# Port 3003
FROM nginx:1.25-alpine
COPY dist/ /usr/share/nginx/html/
COPY <<'NGINX_CONF' /etc/nginx/conf.d/default.conf
server {
    listen       3003;
    server_name  localhost;

    root /usr/share/nginx/html;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Expose source maps — TC-P1.5-001 (sourcemap_probe_standard)
    # TC-P1.5-005 (jsx_source_recovery): .tsx sources embedded in .js.map files
    location ~* \.js\.map$ {
        add_header Access-Control-Allow-Origin "*";
        add_header Cache-Control "no-store";
    }

    # CORS for all assets — benchmark tools run on different ports
    location /assets/ {
        add_header Access-Control-Allow-Origin "*";
        # TC-P1-005 (link_preload): checkout.chunk.js served from here
    }

    location /health {
        return 200 '{"status":"ok","app":"react-ecommerce","port":3003}';
        add_header Content-Type application/json;
    }

    error_page 404 /index.html;
}
NGINX_CONF

EXPOSE 3003
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3003/health || exit 1
