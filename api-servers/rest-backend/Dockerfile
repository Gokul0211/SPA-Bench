# ── SPABench REST Backend ────────────────────────────────────────────────────
# Multi-stage build:
#   stage 1 (deps)  — install production dependencies only
#   stage 2 (final) — minimal runtime image

FROM node:20-alpine AS deps

WORKDIR /app

# Copy package manifests first for layer cache efficiency
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm install --omit=dev --ignore-scripts

# ── Final runtime stage ───────────────────────────────────────────────────────
FROM node:20-alpine AS final

# Install wget for Docker healthcheck
RUN apk add --no-cache wget

WORKDIR /app

# Copy installed modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY server.js      ./server.js
COPY middleware/    ./middleware/
COPY routes/        ./routes/
COPY openapi-spec.json ./openapi-spec.json

# Non-root user for security
RUN addgroup -S spabench && adduser -S spabench -G spabench
USER spabench

EXPOSE 4001

# Docker healthcheck (also used by depends_on in docker-compose.yml)
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget -qO- http://localhost:4001/health || exit 1

CMD ["node", "server.js"]
