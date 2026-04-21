# PHASE 0 BASELINE REPORT

**Date:** 2026-04-21  
**Branch:** main  
**Scope:** Foundation Stabilization — no business features implemented

---

## A. Summary

Phase 0 establishes a clean, reproducible baseline before any Phase 1 work begins.

**What was done:**
- Created `docs/legacy/SEO_REDIRECT_MAP.csv` (header-only) — unblocks `next.config.ts` which reads this file at build time
- Updated root `.env.example` and created per-app `.env.example` files that match real env var usage
- Wrote `docker-compose.yaml` with infra services (postgres, redis, minio) with healthchecks and persistent volumes
- Ran and confirmed baseline builds/tests for all three apps

**Why needed:**
- `docker-compose.yaml` was empty (1 line)
- Root `.env.example` only had backend DB vars; web/admin had no `.env.example` at all
- `docs/legacy/` directory and CSV did not exist; `next.config.ts` reads it at build time
- No baseline build result documented anywhere

---

## B. Files Changed

| File | Action | Reason |
|---|---|---|
| `docs/legacy/SEO_REDIRECT_MAP.csv` | Created (new dir + file) | `next.config.ts` references this path; file not present caused silent zero-redirect build |
| `.env.example` | Updated | Was backend-only; expanded to full infra vars |
| `bigbike-web/.env.example` | Created | Missing; matches `BIGBIKE_API_BASE_URL`, `NEXT_PUBLIC_API_BASE_URL`, `BIGBIKE_SITE_URL`, `BIGBIKE_DISABLE_DEV_FALLBACK` |
| `bigbike-admin/.env.example` | Created | Missing; matches `VITE_ADMIN_API_BASE`, `VITE_USE_ADMIN_MOCK`, `VITE_ADMIN_ROLE` |
| `bigbike-backend/.env.example` | Created | Missing; matches `BIGBIKE_DB_URL`, `BIGBIKE_DB_USERNAME`, `BIGBIKE_DB_PASSWORD`, `SPRING_PROFILES_ACTIVE`; stubs for JWT/storage/SMTP |
| `docker-compose.yaml` | Rewritten | Was 1 empty line; now has postgres:16-alpine, redis:7-alpine, minio with healthchecks and named volumes |

---

## C. Stack Reality Check

### bigbike-web

| Component | Docs (TECH_STACK.md) | Actual (package.json) | Match? |
|---|---|---|---|
| Framework | Next.js ≥ 14 App Router | Next.js **16.2.4** App Router | ✅ (newer) |
| React | React 18 | React **19.2.4** | ⚠️ mismatch — newer |
| Styling | Tailwind CSS **3.x** | Tailwind CSS **4.x** (breaking API) | ❌ mismatch |
| Language | TypeScript 5.x strict | TypeScript 5.x | ✅ |
| Package manager | pnpm | npm (package-lock.json) | ⚠️ mismatch |
| Router | App Router | App Router (`app/` dir) | ✅ |

**Notes:**
- Tailwind CSS 4 uses `@tailwindcss/postcss` — this is a major breaking change from v3 (no `tailwind.config.js`, no `@apply` in component CSS without config). Code is already written for v4 — do not downgrade.
- React 19 includes React Compiler support and concurrent features. Do not downgrade.

### bigbike-admin

| Component | Docs (TECH_STACK.md) | Actual (package.json + vite.config.js) | Match? |
|---|---|---|---|
| Framework | **Next.js 14 App Router** | **Vite 8.0.4** + React SPA | ❌ major mismatch |
| Language | TypeScript strict | **JavaScript** (no `.ts` source files) | ❌ mismatch |
| React | React 18 | React **19.2.4** | ⚠️ mismatch — newer |
| React Compiler | not mentioned | babel-plugin-react-compiler 1.0.0 | — |
| Preview port | 4000 (default) | 4173 (`vite preview` default) | — |

**Decision:** Keep Vite + JS as-is. Migrating admin to Next.js + TypeScript during Phase 0 would be high-risk scope creep. Document as P1 tech-debt item.

### bigbike-backend

| Component | Docs (TECH_STACK.md §3.2) | Actual (pom.xml) | Match? |
|---|---|---|---|
| Framework | Spring Boot **3.2+** | Spring Boot **4.0.5** | ❌ mismatch — actual is newer |
| Java | Java **21** | Java **17** | ❌ mismatch |
| Build | **Gradle 8** | **Maven** | ❌ mismatch |
| ORM | Spring Data JPA | Spring Data JPA | ✅ |
| Migration | Flyway | Flyway | ✅ |
| Security | Spring Security + JWT | Spring Security (JWT **not yet implemented**) | ⚠️ partial |
| Cache | Redis | spring-boot-starter-data-redis | ✅ |

**Decision:** Keep Spring Boot 4.0.5 + Java 17 + Maven. The app runs and 16 tests pass. Downgrading to Boot 3.2 would require dependency changes with real breakage risk for zero benefit. Update docs instead.

**Recommendation:** Update `docs/TECH_STACK.md` §3.2 in a follow-up task to reflect Boot 4.0.5 + Java 17 + Maven.

---

## D. Commands Executed

| Command | Result | Notes |
|---|---|---|
| `npm install` (bigbike-web) | PASS | 359 packages, 0 vulnerabilities |
| `npm run build` (bigbike-web) | PASS | Next.js 16.2.4 Turbopack, 9 routes, all ƒ Dynamic |
| `npm run lint` (bigbike-web) | PASS | 0 errors |
| `npm run build` (bigbike-admin) | PASS | Vite 8.0.8, 292KB bundle |
| `npm run lint` (bigbike-admin) | PASS | 0 errors |
| `./mvnw test` (bigbike-backend) | PASS | 16 tests, 0 failures, 0 errors |
| `docker compose config` | PASS | Valid YAML, named network `bigbike-dev`, 3 named volumes |

---

## E. URL Strategy Baseline

### Current next.js routes vs legacy WordPress URLs

| Page type | Legacy URL (WordPress) | New route (Next.js) | SEO risk |
|---|---|---|---|
| Product detail | `/sp/{slug}.html` | `/product/{slug}/` | 🔴 CRITICAL — must 301 |
| Brand archive | `/brand/{slug}.html` | `/brands/{slug}/` | 🔴 CRITICAL — must 301 |
| Category archive | `/{cat}.html` | `/danh-muc-san-pham/{slug}/` | 🔴 CRITICAL — must 301 |
| Blog/article | `/tin-tuc/{slug}.html` | `/tin-tuc/[slug].html` | ✅ MATCHES |

### SEO risks if redirects are missing

- Loss of organic traffic to Google-indexed URLs (products, brands, categories)
- Google re-crawl takes 4–12 weeks even with correct sitemaps
- Broken backlinks from external sites
- Redirect chains if CSV map is wrong or has typos
- Sitemap/canonical drift if new URLs go live before legacy map is populated

### Recommendation

**Keep legacy `.html` patterns as 301 redirect sources mapped to new URLs.**

Priority: Populate `docs/legacy/SEO_REDIRECT_MAP.csv` with data extracted from the legacy `kd_rank_math_redirections` table (40 rows) before any route goes live in production. The CSV header is already correct for `next.config.ts` parsing:

```
sourcePattern,targetPattern,redirectType,status,notes
```

---

## F. Remaining Blockers

### P0 — Blocks Phase 1 start

| ID | Description | File | Impact |
|---|---|---|---|
| B01 | Security stub: all `/api/v1/**` is public, CSRF disabled, no JWT | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java` | Admin endpoints fully exposed in dev and staging |
| B02 | Flyway only has V1 (catalog/content tables). No users, sessions, media, redirects, settings, audit tables. | `bigbike-backend/src/main/resources/db/migration/` | Backend cannot support auth, uploads, or admin CRUD at all |
| B03 | SEO_REDIRECT_MAP.csv is header-only — zero redirect rules | `docs/legacy/SEO_REDIRECT_MAP.csv` | All legacy product/brand/category URLs will 404 when new site goes live |

### P1 — Blocks production launch

| ID | Description |
|---|---|
| P1-01 | No Dockerfiles for any app — compose can only run infra services |
| P1-02 | bigbike-admin is JavaScript, docs say TypeScript — static type safety gap |
| P1-03 | `docs/TECH_STACK.md` documents wrong Java version, Spring Boot version, build tool, and admin framework |
| P1-04 | Redis and MinIO not yet wired into Spring Boot application.properties |
| P1-05 | `next.config.ts` has `trailingSlash: true` but no `output: standalone` — Next.js cannot be containerized yet |

### Nice-to-have

- Add `pnpm-workspace.yaml` and migrate to pnpm (TECH_STACK.md recommends it)
- Add `springdoc-openapi` dependency for auto-generated API docs
- Add Sentry DSN placeholders to `.env.example` files

---

## G. Recommended Next Tasks (priority order)

### 1. Backend Security/Auth Foundation (P0 → Phase 1 prerequisite)
Fix `SecurityConfig.java`: implement JWT access token (15 min TTL) + refresh token (7 days), protect `/api/v1/admin/**` with `ROLE_ADMIN`, keep `/api/v1/**` public for read operations.  
Reference: `docs/AUTH_RBAC.md`

### 2. Backend Schema V2–V6 (P0 → Phase 1 prerequisite)
Flyway migrations for:
- V2: users + sessions + roles
- V3: media_assets
- V4: redirects (for serving SEO_REDIRECT_MAP via API if needed)
- V5: settings / audit_log
- V6: (seed admin user in dev profile)

Reference: `docs/DATABASE_MIGRATION_PLAN.md`

### 3. URL Strategy Decision + CSV Population (P0 → SEO critical)
Extract 40 rows from `kd_rank_math_redirections` in legacy MySQL, convert to CSV format, populate `docs/legacy/SEO_REDIRECT_MAP.csv`.

### 4. Dockerfiles for 3 apps (P1)
- `bigbike-backend/Dockerfile`: multi-stage Maven + eclipse-temurin:17-jre-alpine
- `bigbike-web/Dockerfile`: node:20-alpine + `output: standalone`
- `bigbike-admin/Dockerfile`: node:20-alpine + vite build → nginx:alpine

### 5. TECH_STACK.md Update
Correct Spring Boot 3.2 → 4.0.5, Java 21 → 17, Gradle → Maven, admin from Next.js → Vite/React.

---

## H. Safety Checklist

- ✅ No secrets committed — all `.env.example` files use placeholder values
- ✅ No URL production routes changed en masse
- ✅ No business features implemented (no auth, no cart, no order, no payment)
- ✅ No legacy docs deleted
- ✅ No framework version changes
- ✅ Mock fallback system in bigbike-web preserved (`BIGBIKE_DISABLE_DEV_FALLBACK`)
- ✅ Mock system in bigbike-admin preserved (`VITE_USE_ADMIN_MOCK=true` default in `.env.example`)
- ✅ `SecurityConfig.java` not touched — current stub is intentional for Phase 0
