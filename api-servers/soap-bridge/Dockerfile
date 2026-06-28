# ── SPABench SOAP Bridge ──────────────────────────────────────────────────────
# Multi-stage build — deps stage installs prod dependencies only.

FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --ignore-scripts

# ── Final runtime stage ───────────────────────────────────────────────────────
FROM node:20-alpine AS final

RUN apk add --no-cache wget

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY server.js ./server.js

# WSDL must be present at startup — server.js reads it synchronously to
# derive all bridge route paths. Missing file = immediate crash.
COPY wsdl/ ./wsdl/

RUN addgroup -S spabench && adduser -S spabench -G spabench
USER spabench

EXPOSE 4004

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget -qO- http://localhost:4004/health || exit 1

CMD ["node", "server.js"]
