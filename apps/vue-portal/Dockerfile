# SPABench vue-portal — static SPA served by nginx, source maps blocked.
#
# dist/ is checked in (hand-built, see README "Limitations"). nginx returns 404
# for every *.map request (the restricted-source-map case) and forwards the
# SOAP bridge and REST APIs. Routing rules live in nginx/default.conf.
# Published on host port 3004 (docker-compose maps 3004:80).

FROM nginx:1.27-alpine

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html/

EXPOSE 80
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=5 \
    CMD wget -qO- http://127.0.0.1/health || exit 1
