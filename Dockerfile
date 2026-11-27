# IPS YEP 2026: Node.js server (check-in page + voting + lucky draw + dashboard). No npm dependencies.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATA_DIR=/app/data
COPY package.json ./
COPY . .
RUN chmod -R a+rX /app && mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 3000
# health check follows PORT, so it still passes when the host runs the app on another port
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/api/status" >/dev/null || exit 1
CMD ["node", "index.js"]
