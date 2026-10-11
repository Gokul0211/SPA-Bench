# SPABench angular-permit — static SPA served by nginx.
#
# dist/ is checked in (hand-built, see README "Limitations"); there is no build
# step. Source maps are served. Routing rules live in nginx/default.conf.
# Published on host port 3001 (docker-compose maps 3001:80).

FROM nginx:1.27-alpine

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html/

EXPOSE 80
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=5 \
    CMD wget -qO- http://127.0.0.1/health || exit 1
