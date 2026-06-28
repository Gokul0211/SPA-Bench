# SPABench App E — Next.js SaaS Dashboard
# Serves pre-built .next/static/ output
# Source maps EXPOSED (Vercel default — 41 maps) — TC-P1.5-001
# TC-P1.5-007: dist/server.js.map accessible at /dist/server.js.map
# Port 3005
FROM nginx:1.25-alpine
COPY .next/        /usr/share/nginx/html/.next/
COPY dist/         /usr/share/nginx/html/dist/
COPY <<'NGINX_CONF' /etc/nginx/conf.d/default.conf
server {
    listen       3005;
    server_name  localhost;

    root /usr/share/nginx/html;

    location /_next/static/ {
        alias /usr/share/nginx/html/.next/static/;
        add_header Access-Control-Allow-Origin "*";
        location ~* \.js\.map$ {
            add_header Access-Control-Allow-Origin "*";
            add_header Cache-Control "no-store";
        }
    }

    location /dist/ {
        alias /usr/share/nginx/html/dist/;
        add_header Access-Control-Allow-Origin "*";
    }

    location /health {
        return 200 '{"status":"ok","app":"nextjs-saas","port":3005}';
        add_header Content-Type application/json;
    }

    location / {
        root /usr/share/nginx/html/.next;
        try_files $uri $uri/ /index.html;
        add_header Access-Control-Allow-Origin "*";
    }

    error_page 404 /index.html;
}
NGINX_CONF

EXPOSE 3005
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3005/health || exit 1
