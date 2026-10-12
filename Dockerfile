FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY src ./src
COPY public ./public
COPY demos ./demos
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production PORT=3000 DEMOS_DIR=/app/data/demos
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force \
    && mkdir -p /app/data && chown node:node /app/data
COPY --from=build /app/dist ./dist
COPY server.js ./
COPY src/archive.js src/catalog.js src/markdown.js src/seo.js ./src/
COPY demos ./demos
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server.js"]
