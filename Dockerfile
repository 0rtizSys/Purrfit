# syntax=docker/dockerfile:1

# ---- Build: compile TypeScript, then drop dev dependencies ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---- Runtime ----
FROM node:22-bookworm-slim
# Fonts for the crypto price charts (rendered with @napi-rs/canvas)
RUN apt-get update \
    && apt-get install -y --no-install-recommends fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY migrations ./migrations
USER node
# Apply pending migrations, then start the bot. `exec` replaces the shell with
# node, so node receives SIGTERM directly and shuts down cleanly.
CMD ["sh", "-c", "node dist/scripts/migrate.js && exec node dist/bot/index.js"]
