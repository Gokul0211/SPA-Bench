# SPABench nextjs-saas — exported Next.js client served by nginx.
#
# .next/ is checked in (hand-built, see README "Limitations"):
#   .next/index.html  → /
#   .next/static/**   → /_next/static/**   (chunks, build manifest, source maps)
#   dist/**           → /dist/**           (server bundle + map, exposed by mistake)
# API, GraphQL and WebSocket traffic is proxied same-origin (nginx/default.conf).
# Published on host port 3005 (docker-compose maps 3005:80).

FROM nginx:1.27-alpine

COPY nginx/default.conf  /etc/nginx/conf.d/default.conf
COPY .next/index.html    /usr/share/nginx/html/index.html
COPY .next/static/       /usr/share/nginx/html/_next/static/
COPY dist/               /usr/share/nginx/html/dist/

EXPOSE 80
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=5 \
    CMD wget -qO- http://127.0.0.1/health || exit 1
