# ── base ──────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY prisma/ ./prisma/
RUN npm ci

# ── dev ───────────────────────────────────────────────────────────────────────
FROM base AS dev
COPY tsconfig.json ./
COPY src/ ./src/
EXPOSE 4000
CMD ["npx", "tsx", "watch", "src/server.ts"]

# ── build ─────────────────────────────────────────────────────────────────────
FROM base AS build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

# ── prod ──────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS prod
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=base /app/node_modules/.prisma ./node_modules/.prisma
USER node
CMD ["node", "dist/server.js"]
