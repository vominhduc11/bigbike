# ---- Deps stage ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

# ---- Builder stage ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Runner stage ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S bigbike && adduser -S bigbike -G bigbike

COPY --from=builder /app/public ./public
COPY --from=builder --chown=bigbike:bigbike /app/.next/standalone ./
COPY --from=builder --chown=bigbike:bigbike /app/.next/static ./.next/static

USER bigbike
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

ENV HOSTNAME="0.0.0.0"
ENV PORT=3000
CMD ["node", "server.js"]
