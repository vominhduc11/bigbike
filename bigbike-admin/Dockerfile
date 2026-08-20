# syntax=docker/dockerfile:1.7
# ---- Build stage ----
FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit --no-fund
COPY . .

# Vite bakes env vars into the bundle at build time, not runtime.
# Pass them as build args so the bundle always targets the real API.
ARG VITE_ADMIN_API_BASE=/api/v1
ARG VITE_MINIO_INTERNAL_ORIGIN=http://minio:9000
ARG VITE_MINIO_EXTRA_ORIGINS=
ARG VITE_STOREFRONT_BASE_URL=https://bigbike.vn
ENV VITE_ADMIN_API_BASE=${VITE_ADMIN_API_BASE}
ENV VITE_MINIO_INTERNAL_ORIGIN=${VITE_MINIO_INTERNAL_ORIGIN}
ENV VITE_MINIO_EXTRA_ORIGINS=${VITE_MINIO_EXTRA_ORIGINS}
ENV VITE_STOREFRONT_BASE_URL=${VITE_STOREFRONT_BASE_URL}

RUN npm run build
# Keep each original artifact for clients without gzip, while adding an immutable
# gzip sidecar that nginx can serve without compressing again for every request.
RUN find dist -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.json' -o -name '*.svg' \) \
    -exec sh -c 'gzip -9 -c "$1" > "$1.gz"' _ {} \;

# ---- Serve stage ----
FROM nginx:alpine AS runner
ARG VITE_STOREFRONT_BASE_URL=https://bigbike.vn
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf.template
RUN VITE_STOREFRONT_BASE_URL=${VITE_STOREFRONT_BASE_URL} \
    envsubst '${VITE_STOREFRONT_BASE_URL}' \
    < /etc/nginx/conf.d/default.conf.template \
    > /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1
