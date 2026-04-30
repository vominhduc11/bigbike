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
# Bake media origin into CSP img-src at build time.
# Browser accesses MinIO via the host-mapped port (http://localhost:9000).
ARG BIGBIKE_LEGACY_UPLOADS_BASE=http://localhost:9000/bigbike-media/wp-uploads
ENV BIGBIKE_LEGACY_UPLOADS_BASE=${BIGBIKE_LEGACY_UPLOADS_BASE}
# Server-side rewrite destination: when running inside Docker the Next.js server
# must reach MinIO via the internal Docker network name (minio:9000), not localhost.
ARG BIGBIKE_MEDIA_INTERNAL_URL=http://localhost:9000/bigbike-media/wp-uploads
ENV BIGBIKE_MEDIA_INTERNAL_URL=${BIGBIKE_MEDIA_INTERNAL_URL}
# NEXT_PUBLIC_ vars are baked into the client bundle at build time — must be ARGs, not runtime env.
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
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
