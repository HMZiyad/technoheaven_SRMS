# ── base ──────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY package*.json ./
COPY prisma/ ./prisma/
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
RUN npx prisma generate

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
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi
COPY --from=build /app/dist ./dist
COPY --from=base /app/node_modules/.prisma ./node_modules/.prisma
USER node
CMD ["node", "dist/server.js"]
