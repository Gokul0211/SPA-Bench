# ── SPABench WebSocket Backend ───────────────────────────────────────────────
# Multi-stage build — deps stage installs prod dependencies only.

FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --ignore-scripts

# ── Final runtime stage ───────────────────────────────────────────────────────
FROM node:20-alpine AS final

# wget for health checks (used by sanity_check.py and manual inspection)
RUN apk add --no-cache wget

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY server.js ./server.js

RUN addgroup -S spabench && adduser -S spabench -G spabench
USER spabench

# HTTP (health) + WebSocket on same port
EXPOSE 4003

# docker-compose uses condition: service_started for this container,
# but the healthcheck is useful for manual inspection and sanity_check.py.
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget -qO- http://localhost:4003/health || exit 1

CMD ["node", "server.js"]
