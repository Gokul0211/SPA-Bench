# SPABench REST backend (Express, port 4001).

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --ignore-scripts

FROM node:20-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY server.js         ./server.js
COPY lib/              ./lib/
COPY middleware/       ./middleware/
COPY routes/           ./routes/
COPY openapi-spec.json ./openapi-spec.json

RUN addgroup -S spabench && adduser -S spabench -G spabench
USER spabench

EXPOSE 4001
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4001/health || exit 1

CMD ["node", "server.js"]
