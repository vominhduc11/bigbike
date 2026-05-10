# ---- Build stage ----
FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline
COPY . .

# Vite bakes env vars into the bundle at build time, not runtime.
# Pass them as build args so the bundle always targets the real API.
ARG VITE_ADMIN_API_BASE=/api/v1
ARG VITE_USE_ADMIN_MOCK=false
ARG VITE_ADMIN_ROLE=ADMIN
ARG VITE_MINIO_INTERNAL_ORIGIN=http://minio:9000
ENV VITE_ADMIN_API_BASE=${VITE_ADMIN_API_BASE}
ENV VITE_USE_ADMIN_MOCK=${VITE_USE_ADMIN_MOCK}
ENV VITE_ADMIN_ROLE=${VITE_ADMIN_ROLE}
ENV VITE_MINIO_INTERNAL_ORIGIN=${VITE_MINIO_INTERNAL_ORIGIN}

RUN npm run build

# ---- Serve stage ----
FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1
