# Deployment Guide

## Docker Compose Defaults

| Service | Current default | Status | Evidence |
|---|---|---|---|
| Postgres | `postgres:16-alpine`, bound to `127.0.0.1:5432` | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml` |
| MinIO | `minio/minio:RELEASE.2025-04-22T22-12-26Z`, bound to `127.0.0.1:9000/9001` | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml` |
| Backend | profile defaults to `prod`, bound to `127.0.0.1:8080` | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml` |
| Web | bound to `3000`, backend API base injected via env/build args | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml` |
| Admin | built with `VITE_USE_ADMIN_MOCK=false`, exposed on `4000` | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml` |

## Deployment Notes

- Backend healthcheck uses `GET /actuator/health`. `CONFIRMED_FROM_CONFIG`
- Web and admin have container healthchecks. `CONFIRMED_FROM_CONFIG`
- Compose includes a `bigbike-web-init` one-shot container that calls the web revalidation endpoint after startup. `CONFIRMED_FROM_CONFIG`
- Backend mail sending is optional when SMTP env vars are empty. `CONFIRMED_FROM_CONFIG`
- CORS must be set explicitly through `BIGBIKE_CORS_ALLOWED_ORIGINS`. `CONFIRMED_FROM_CONFIG`

## Schema And Migration Notes

- Active Flyway migrations run through `V73`. `CONFIRMED_FROM_CONFIG`
- Receipt tables exist from `V52/V53/V55`; serial movement table exists from `V57`; POS order snapshot columns were added in `V71`. `CONFIRMED_FROM_CONFIG`

## Deployment Caveats

- Internal redirect endpoints rely on infra restriction outside Spring Security. `CONFIRMED_FROM_CONFIG`
- No confirmed external payment webhook or shipping carrier deployment contract exists in repo. `NOT_FOUND_IN_REPO`
