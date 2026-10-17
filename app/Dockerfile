# syntax=docker/dockerfile:1
# Eternal — obraz produkcyjny (Node.js 22 LTS, SQLite wbudowany w Node, bez kompilacji natywnej)

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# wykaz składników oprogramowania (A18.9) z zależności produkcyjnych — w obrazie: dist/sbom.cdx.json
RUN npm run build && npm run sbom && mv sbom.cdx.json dist/ && npm prune --omit=dev

FROM node:22-bookworm-slim
# Chromium do raportów PDF (raport faktów, notatka Scribe, potwierdzenia) + czcionki z polskimi znakami
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-dejavu-core fonts-liberation \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data \
    TRUST_PROXY=true \
    CHROMIUM_PATH=/usr/bin/chromium
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--disable-warning=ExperimentalWarning", "dist/server/index.js"]
