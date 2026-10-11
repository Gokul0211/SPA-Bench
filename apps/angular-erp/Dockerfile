# SPABench angular-erp — Module Federation shell + 8 remotes, one image target each.
#
#   shell          → host port 3002: dist/shell/ at /, dist/mfe-admin/ at /mfe-admin/
#   mfe-inventory  → 3011    mfe-orders  → 3012    mfe-users     → 3013
#   mfe-reports    → 3014    mfe-finance → 3015    mfe-hr        → 3016
#   mfe-crm        → 3017    mfe-analytics → 3018
#
# Every container listens on 80; docker-compose publishes the host port.
# dist/ is checked in (hand-built, see README "Limitations").

FROM nginx:1.27-alpine AS remote-base
COPY nginx/mfe.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/health || exit 1

FROM nginx:1.27-alpine AS shell
COPY nginx/shell.conf /etc/nginx/conf.d/default.conf
COPY dist/shell/     /usr/share/nginx/html/
COPY dist/mfe-admin/ /usr/share/nginx/html/mfe-admin/
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/health || exit 1

FROM remote-base AS mfe-inventory
COPY dist/mfe-inventory/ /usr/share/nginx/html/

FROM remote-base AS mfe-orders
COPY dist/mfe-orders/ /usr/share/nginx/html/

FROM remote-base AS mfe-users
COPY dist/mfe-users/ /usr/share/nginx/html/

FROM remote-base AS mfe-reports
COPY dist/mfe-reports/ /usr/share/nginx/html/

FROM remote-base AS mfe-finance
COPY dist/mfe-finance/ /usr/share/nginx/html/

FROM remote-base AS mfe-hr
COPY dist/mfe-hr/ /usr/share/nginx/html/

FROM remote-base AS mfe-crm
COPY dist/mfe-crm/ /usr/share/nginx/html/

FROM remote-base AS mfe-analytics
COPY dist/mfe-analytics/ /usr/share/nginx/html/
