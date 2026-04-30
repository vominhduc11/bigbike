# BigBike

> BigBike is a motorcycle gear retail / D2C commerce platform.
>
> The project includes a public SEO-first sales website, an internal admin dashboard, and a backend service for product, order, content and operational data.

---

## 1. Project Overview

BigBike is built for selling motorcycle gear and biker accessories to end customers.

Main business domain:

- Motorcycle helmets.
- Riding jackets and pants.
- Riding gloves.
- Riding shoes.
- Protection gear.
- Motorcycle bags / luggage.
- Helmet intercom / Bluetooth accessories.
- Other biker accessories.

Repository structure:

```text
bigbike/
├── AGENTS.md                       # AI agent operating instructions
├── BIGBIKE_BRANDGUIDELINE.pdf      # Brand identity guide (PDF, 23 pages)
├── README.md                       # This file
├── .env.example                    # Root environment template (Docker Compose)
├── docker-compose.yaml             # Full stack infrastructure
├── docs/                           # Architecture decision records
│   └── DECISIONS.md                # Recorded architecture / product decisions (what was rejected and why)
├── bigbike-web/                    # Public SEO + sales website (Next.js)
│   └── docs/                       # SEO redirect map data
├── bigbike-admin/                  # Internal admin dashboard (Vite + React)
├── bigbike-backend/                # Spring Boot backend
│   └── docs/                       # Phase implementation reports
├── Bigbike Design System/          # Complete design system (brand, tokens, fonts, assets, UI kit)
└── bigbike_vn__2026_04_17/         # Local-only legacy WordPress export (do not commit)
```

### Technology Stack

| App | Runtime | Framework | Language | Notes |
|-----|---------|-----------|----------|-------|
| `bigbike-web` | Node.js | Next.js 16.2.4 + App Router | TypeScript | React 19.2.4, Tailwind CSS 4 |
| `bigbike-admin` | Node.js | Vite 8.0.4 | JavaScript | React 19.2.4, babel-plugin-react-compiler |
| `bigbike-backend` | Java 17 | Spring Boot 4.0.5 | Java | Maven, JPA, Flyway, Spring Security |

Infrastructure (via `docker-compose.yaml`):

| Service | Image | Port |
|---------|-------|------|
| PostgreSQL | postgres:16-alpine | 5432 |
| MinIO | minio/minio:latest | 9000 (API), 9001 (console) |

---

## 2. Applications

### 2.1 `bigbike-web`

Public-facing website for customers. Next.js 16.2.4 + App Router, TypeScript, Tailwind CSS 4.

Primary goals:

- SEO.
- Product discovery.
- Category browsing.
- Product detail pages (PDP).
- Cart and checkout.
- Customer trust.
- Content / blog / policy pages.
- Mobile-first commerce UX.

Key directories:

```text
app/          # Next.js App Router routes (Vietnamese slugs: gio-hang, thanh-toan, san-pham, ...)
components/   # React components (analytics, cart, catalog, content, home, layout, ui)
lib/          # API clients, contracts, SEO utilities, route helpers
public/       # Static assets
docs/         # SEO redirect map data (consumed by next.config.ts)
AGENTS.md     # Next.js version-specific agent rules
STYLEGUIDE.md # Condensed brand + UI rules for bigbike-web
```

### 2.2 `bigbike-admin`

Internal admin dashboard for operations. Vite 8.0.4 + React SPA. Runs on port **4000** (Docker) / **5173** (local dev), served behind an **nginx** reverse proxy.

Primary goals:

- Product management.
- Category / brand management.
- Order handling.
- Customer / contact / support management.
- Content and campaign management.
- Settings and operational workflows.
- Permission-based access control.

Key directories:

```text
src/
  assets/      # Images, icons
  components/  # Reusable UI components
  hooks/       # React custom hooks
  lib/         # Utilities, API clients
  screens/     # Page-level components
  styles/      # CSS / styling
```

### 2.3 `bigbike-backend`

Backend service. Spring Boot 4.0.5, Java 17, Maven.

Primary goals:

- REST API.
- Business validation.
- Data persistence (PostgreSQL via JPA + Flyway migrations V1–V25).
- Authentication and authorization (JWT + Argon2id password hashing via BouncyCastle).
- Product / order / content state management.
- Admin permissions.
- Media storage (MinIO, S3-compatible).
- Per-IP rate limiting (bucket4j).
- Structured JSON logging for production (logstash-logback).

Key directories:

```text
src/main/java/com/bigbike/bigbike_backend/
  api/            # REST controllers — admin/ and public endpoints
  config/         # Spring configuration beans
  domain/         # Entity / domain models
  migration/      # WordPress migration logic
  persistence/    # Data access layer
  repository/     # Spring Data JPA repositories
  service/        # Business logic services
src/main/resources/
  db/migration/                       # Flyway migrations V1–V16
  db/migration-dev/                   # Dev seed data V1000–V1001
  openapi/bigbike-openapi.json        # OpenAPI specification
  application.properties              # Base config
  application-dev.properties          # Dev profile (Flyway seeds enabled)
  application-mock.properties         # Mock profile (in-memory, no DB)
  application-prod.properties         # Production profile
docs/
  PHASE_1D_CUSTOMER_AUTH_REPORT.md
  PHASE_1F_CHECKOUT_API_REPORT.md
  PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md
```

Spring profiles (`SPRING_PROFILES_ACTIVE`):

- `dev` — Flyway dev seed data enabled.
- `mock` — Datasource / JPA / Flyway disabled, uses in-memory read repositories.
- `prod` — Production settings.

Auth note:

- `GET /api/v1/auth/me` uses a dev/mock placeholder user.
- Placeholder auth is available only for `dev` / `mock` profiles.
- Production auth provider is not fully implemented in this phase.

### 2.4 `Bigbike Design System/`

The complete BigBike design system — brand assets, fonts, CSS tokens, design previews, and UI kit. Built as a Claude Design skill. Source of truth for all visual implementation decisions.

| Path | What it contains |
|------|-----------------|
| `README.md` | Brand context, copy rules, visual foundations, iconography — **read this first** |
| `SKILL.md` | Claude Code skill front matter |
| `colors_and_type.css` | All CSS variables + base type/color classes (drop-in stylesheet) |
| `fonts/` | Bungee (display) + Exo (body, 9 weights). SIL OFL. |
| `assets/logo/` | Primary mascot logo, wordmarks, slogan lockups (PNG) |
| `assets/favicon/` | 8 SVG favicon variants |
| `assets/icons/` | 48-icon proprietary set (SVG) — categories + utility icons |
| `assets/signage/` | Physical signage templates — use as hero texture reference |
| `assets/social/` | Social media composition samples — reference for visual tone |
| `preview/` | Design system preview cards (HTML — open in browser) |
| `ui_kits/website/` | Bigbike.vn click-through prototype (3 screens + shared components) |
| `uploads/` | Raw brand uploads (logos, icons, fonts, social media, brand guideline PDF) |

`ui_kits/website/` screens:

| File | Screen |
|------|--------|
| `HomePage.jsx` | Homepage — hero slider, category grid, featured products, brand strip |
| `CatalogPage.jsx` | Product listing — filter sidebar, sort, breadcrumb |
| `ProductDetailPage.jsx` | Product detail — gallery, variant chips, add-to-cart |
| `CartPage.jsx` | Shopping cart |
| `CheckoutPage.jsx` | Checkout |
| `AccountPage.jsx` | Customer account |
| `SharedComponents.jsx` | SiteHeader, SiteFooter, ProductCard, Toast, FloatingChat |

Not production code — API calls are mocked, cart is in-memory. When building or modifying `bigbike-web` UI, reference this kit to maintain fidelity with the original design.

---

## 3. Brand Direction

BigBike brand identity:

- Bold.
- Fast.
- Sporty.
- Mechanical.
- Biker-focused.
- Red / black visual system (`#F90606` is the single brand accent).
- Product-first.
- Commercially clear.

Brand references:

```text
BIGBIKE_BRANDGUIDELINE.pdf              # 23-page brand identity guide (PDF — not readable by code tools)
Bigbike Design System/README.md         # Machine-readable brand context, copy rules, visual foundations
Bigbike Design System/colors_and_type.css  # CSS variables — use this as the implementation source of truth
Bigbike Design System/assets/           # Logos, icons, favicons, signage, social
```

Do not randomly change brand colors, typography, logo usage, or visual language.

---

## 4. Documentation

### 4.1 Agent / repo-level instructions

```text
AGENTS.md
```

Read before using AI agents or making broad code changes.

### 4.2 Design system

```text
Bigbike Design System/README.md          # Brand context, visual foundations, copy rules, iconography
Bigbike Design System/colors_and_type.css  # CSS token source of truth
Bigbike Design System/preview/           # Visual preview cards (open in browser)
Bigbike Design System/ui_kits/website/   # Click-through prototype
BIGBIKE_BRANDGUIDELINE.pdf               # Original brand guideline PDF (23 pages)
```

### 4.3 Backend — Phase implementation reports

```text
bigbike-backend/docs/PHASE_1D_CUSTOMER_AUTH_REPORT.md
bigbike-backend/docs/PHASE_1F_CHECKOUT_API_REPORT.md
bigbike-backend/docs/PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md
```

Describes implemented API behavior, auth flows, checkout logic, and admin settings per phase.

### 4.4 OpenAPI specification

```text
bigbike-backend/src/main/resources/openapi/bigbike-openapi.json
```

Machine-readable API contract for the backend REST API.

### 4.5 SEO redirect data

```text
bigbike-web/docs/
```

SEO redirect map data consumed by `bigbike-web/next.config.ts` for legacy URL handling.

### 4.6 Architecture decisions

```text
docs/DECISIONS.md
```

Records architecture and product decisions that are not obvious from the code — what was considered, what was rejected, and why. Read before implementing features that touch the same domain.

### 4.7 Legacy WordPress migration reference

```text
bigbike_vn__2026_04_17/             # Local-only — do not commit
bigbike_vn__2026_04_17/sqldump.sql  # 133 MB SQL dump — schema reference only
bigbike_vn__2026_04_17/meta.json    # Dump metadata
```

Raw WordPress export used for migration reference. See section 18.1 for handling rules.

---

## 5. Recommended Reading by Task

### Working on `bigbike-web`

```text
AGENTS.md
bigbike-web/AGENTS.md
bigbike-web/STYLEGUIDE.md
Bigbike Design System/README.md
Bigbike Design System/colors_and_type.css
Bigbike Design System/ui_kits/website/
bigbike-backend/src/main/resources/openapi/bigbike-openapi.json
bigbike-backend/docs/PHASE_1F_CHECKOUT_API_REPORT.md
docs/DECISIONS.md
```

### Working on `bigbike-admin`

```text
AGENTS.md
Bigbike Design System/README.md
bigbike-backend/src/main/resources/openapi/bigbike-openapi.json
bigbike-backend/docs/PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md
```

### Working on `bigbike-backend`

```text
AGENTS.md
bigbike-backend/docs/PHASE_1D_CUSTOMER_AUTH_REPORT.md
bigbike-backend/docs/PHASE_1F_CHECKOUT_API_REPORT.md
bigbike-backend/docs/PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md
bigbike-backend/src/main/resources/openapi/bigbike-openapi.json
docs/DECISIONS.md
```

### Working on legacy migration

```text
bigbike_vn__2026_04_17/
bigbike_vn__2026_04_17/sqldump.sql  # schema reference only — read-only
```

### Working on documentation

Read the relevant phase reports and OpenAPI spec first. Do not create contradictions between documents.

---

## 6. Development Setup

> Check each app folder before running commands.

### 6.1 Public website

```bash
cd bigbike-web
npm install
npm run dev
```

Build:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

### 6.2 Admin dashboard

`bigbike-admin` is a **Vite 8 + React SPA** (not Next.js). Dev server runs on port **5173** by default.

```bash
cd bigbike-admin
npm install
npm run dev
```

Build:

```bash
npm run build
```

Preview production build (port 4173):

```bash
npm run preview
```

Lint:

```bash
npm run lint
```

### 6.3 Backend

```bash
cd bigbike-backend
./mvnw spring-boot:run
```

Test / package:

```bash
./mvnw test
./mvnw package
```

### 6.4 Infrastructure (Docker Compose)

Start infrastructure services only (recommended for local dev):

```bash
docker compose up postgres minio -d
```

Start full stack (all services including apps):

```bash
docker compose up -d
```

Stop all:

```bash
docker compose down
```

Port summary when using Docker:

| Service | Local port |
|---------|-----------|
| `bigbike-backend` | 8080 |
| `bigbike-web` | 3000 |
| `bigbike-admin` | 4000 |
| PostgreSQL | 5432 |
| MinIO API | 9000 |
| MinIO console | 9001 |

---

## 7. Environment Variables

Do not commit secrets.

Copy example files to get started:

```bash
cp .env.example .env                              # root (Docker Compose)
cp bigbike-web/.env.example    bigbike-web/.env.local
cp bigbike-admin/.env.example  bigbike-admin/.env.local
cp bigbike-backend/.env.example bigbike-backend/.env
```

### 7.1 Root `.env` (Docker Compose)

```text
POSTGRES_DB / POSTGRES_USER / POSTGRES_PASSWORD
MINIO_ROOT_USER / MINIO_ROOT_PASSWORD / MINIO_BUCKET / MINIO_ENDPOINT
BIGBIKE_DB_URL / BIGBIKE_DB_USERNAME / BIGBIKE_DB_PASSWORD
BIGBIKE_JWT_SECRET          # must be >= 32 chars in production
CORS_ALLOWED_ORIGINS
NEXT_PUBLIC_API_BASE_URL / NEXT_PUBLIC_SITE_URL
SPRING_PROFILES_ACTIVE
```

### 7.2 `bigbike-web` (`.env.local`)

```text
BIGBIKE_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
BIGBIKE_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
BIGBIKE_REDIRECT_CACHE_TTL_SECONDS=300
BIGBIKE_LEGACY_UPLOADS_BASE=                    # MinIO proxy for /wp-content/uploads/*
NEXT_PUBLIC_GTM_ID=GTM-5BKZL3K
```

### 7.3 `bigbike-admin` (`.env.local`)

```text
VITE_ADMIN_API_BASE=http://localhost:8080/api/v1
VITE_USE_ADMIN_MOCK=true                        # false to hit real API
VITE_ADMIN_ROLE=ADMIN                           # default role in mock/dev
```

### 7.4 `bigbike-backend` (`.env`)

```text
SPRING_PROFILES_ACTIVE=dev
BIGBIKE_DB_URL=jdbc:postgresql://localhost:5432/bigbike
BIGBIKE_DB_USERNAME=bigbike
BIGBIKE_DB_PASSWORD=bigbike
BIGBIKE_JWT_SECRET=dev-change-me-in-production-needs-32chars!!
MINIO_ENDPOINT=http://localhost:9000
MINIO_ROOT_USER=minio_admin
MINIO_ROOT_PASSWORD=minio_dev_only
MINIO_BUCKET=bigbike-media
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:4000
```

Never commit: database passwords, JWT secrets, payment secrets, SMTP credentials, cloud storage credentials, admin passwords, or private API keys.

---

## 8. Data and API Contract Rules

Rules:

- API JSON uses `camelCase`.
- Money uses integer VND amount, not float.
- Backend validates final price and total — never trust frontend totals.
- Orders preserve product / customer / address snapshots.
- Public API must not expose internal fields.
- Admin API must enforce permissions server-side.
- Error responses must use standard error shape.
- Status values must match defined state machine transitions.

Canonical product media fields:

```text
image.url
gallery[]
videos[]
```

Avoid reintroducing legacy drift:

```text
imageUrl
images
videoUrl
```

Full API contract: `bigbike-backend/src/main/resources/openapi/bigbike-openapi.json`

---

## 9. Business Rules

Agents and developers must not invent:

- Order statuses.
- Payment statuses.
- Stock states.
- Warranty rules.
- Return rules.
- Shipping fee rules.
- Promotion logic.
- Permission rules.

If a rule is missing, mark it as `TBD` and clarify before implementing.

---

## 10. State Machines

Backend must reject invalid state transitions. Frontend may hide / disable invalid actions, but backend enforcement is mandatory.

State-machine domains:

- Product publish status.
- Product stock state.
- Order status.
- Payment status.
- Fulfillment status.
- Content publish status.
- Campaign status.
- Contact / support status.

Examples of invalid transitions:

```text
COMPLETED → PENDING_CONFIRMATION
CANCELLED → SHIPPING
PENDING_CONFIRMATION → COMPLETED
```

---

## 11. Permissions

Rules:

- Admin routes need permission mapping.
- Admin API endpoints need backend permission checks.
- Frontend hiding is not security — backend enforcement is mandatory.
- Dangerous actions require confirmation.
- Sensitive data export requires export permission.
- User / role / settings changes require restricted permissions.

Examples:

```text
/admin/products       → products.read
/admin/products/new   → products.create
/admin/orders         → orders.read
/admin/settings       → settings.read
```

---

## 12. UI and Design Rules

### 12.1 Shared UI

All UI must include:

- Clear hierarchy.
- Clear action priority.
- Consistent states.
- Loading / empty / error / success states.
- Accessible focus.
- Responsive behavior.
- No raw `null` / `undefined` rendering.

### 12.2 Web UI

Reference:

```text
Bigbike Design System/README.md          # Brand rules, copy, visual foundations
Bigbike Design System/colors_and_type.css  # CSS tokens — use these, do not hardcode values
Bigbike Design System/ui_kits/website/   # Click-through prototype
Bigbike Design System/preview/           # Visual reference cards (open in browser)
```

Priorities:

- SEO.
- Mobile-first.
- Product discovery.
- Conversion.
- Product image clarity.
- Price and stock clarity.
- Cart / checkout trust.

### 12.3 Admin UI

Use admin token system — not web campaign styling.

Reference:

```text
Bigbike Design System/README.md          # Brand context and token guidance
Bigbike Design System/colors_and_type.css
```

Priorities:

- Data readability.
- Fast operations.
- Tables.
- Forms.
- Filters.
- Permission-aware actions.
- Safe destructive actions.

---

## 13. SEO Rules for `bigbike-web`

Public pages must preserve SEO quality:

- One clear H1.
- Semantic heading hierarchy.
- Crawlable content.
- Metadata.
- Canonical URL if needed.
- Stable product / category / article URLs.
- Internal links.
- Optimized images with alt text.
- Fast loading.
- Mobile-first layout.

If changing slugs or URL structure: update `bigbike-web/docs/` redirect map and `next.config.ts`. Do not break indexed URLs.

---

## 14. Cart and Checkout Rules

- Backend verifies price, stock, and quantity.
- Backend validates the full checkout payload.
- Submit button blocks double-submit.
- Errors preserve form data when possible.
- Price / stock changes are communicated to the user.
- Order success page explains next step.
- COD / manual confirmation copy must be clear if used.

---

## 15. Admin Operation Rules

Admin screens must handle:

- Loading state.
- Empty state.
- Error state.
- Permission denied state.
- Search / filter / sort.
- Pagination where relevant.
- Row actions.
- Bulk actions where relevant.
- Confirmation for dangerous actions.
- Field validation.
- Submit / update loading.

Do not build admin screens that only work on happy-path demo data.

---

## 16. Testing

Run available checks before committing.

Frontend:

```bash
npm run lint
npm run test
npm run build
```

Backend:

```bash
./mvnw test
./mvnw package
```

Do not claim tests passed if they were not run.

---

## 17. Smoke Test Checklist

### 17.1 `bigbike-web`

- Homepage loads.
- Category / listing page loads.
- Product detail page loads.
- Search works if implemented.
- Cart can add / update / remove item.
- Checkout validates required fields.
- Order success page renders.
- Mobile layout is usable.
- SEO H1 / title exists.

### 17.2 `bigbike-admin`

- Login / session behavior.
- Dashboard loads.
- Product list loads.
- Product create / edit validation.
- Order list / detail loads.
- Status update handles success / error.
- Permission denied state works.
- Dangerous actions require confirmation.
- Table loading / empty / error states exist.

### 17.3 `bigbike-backend`

- App starts.
- API endpoints match OpenAPI spec.
- Error shape is consistent.
- Permissions are enforced.
- Invalid state transitions are rejected.
- No secrets are exposed.
- Order snapshots are preserved.

---

## 18. AI Agent Workflow

Before changing code:

1. Read `AGENTS.md`.
2. Identify affected app.
3. For UI work: read `Bigbike Design System/README.md` and `colors_and_type.css`.
4. For API work: read relevant phase reports in `bigbike-backend/docs/` and the OpenAPI spec.
5. Inspect current implementation.
6. Make focused changes.
7. Run available checks.
8. Report what changed and what was not run.

Do not do broad rewrites unless explicitly requested.

### 18.1 Legacy migration workflow

Before implementing product, order, content, auth, customer, media, category, brand, search, cart, checkout, or public route behavior derived from the legacy WordPress site:

1. Inspect `bigbike_vn__2026_04_17/` as local-only reference.
2. Read `sqldump.sql` in read-only mode — for schema and sanitized aggregate facts only.
3. Update `bigbike-web/docs/` before changing route, slug, permalink, trailing slash, or blog `.html` redirect behavior.
4. Produce only sanitized artifacts — do not commit raw source data.

Do not build new features ahead of legacy discovery for the affected domain.

Do not commit: raw WordPress source, `sqldump.sql`, `wp-config.php` secret values, user data, order data, customer emails, phone numbers, addresses, password hashes, session values, API keys, tokens, or webhook secrets.

---

## 19. Forbidden Without Explicit Request

Do not do these without explicit approval:

- Replace framework.
- Rewrite architecture.
- Rename major routes.
- Change API versioning.
- Change brand colors.
- Change business statuses.
- Change permission model.
- Change database schema.
- Add payment provider.
- Add auth provider.
- Remove SEO routes.
- Hard-delete business data.
- Remove compatibility fallback for existing data.

---

## 20. Pull Request / Change Summary Format

```text
Summary:
- ...

Files changed:
- ...

Checks:
- ...

Notes:
- ...
```

If checks were not run:

```text
Checks:
- Not run: reason
```

---

## 21. Final Rule

BigBike changes must keep these four layers aligned:

```text
Business rules
API / data contracts
Design system
Implementation
```

If one layer changes and the others are left stale, the project will still compile, probably, and then quietly punish everyone later. Avoid that.
