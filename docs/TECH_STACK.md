# TECH_STACK.md — Hệ thống mới

Đề xuất stack kỹ thuật cho 3 app: main-fe, admin-fe, backend/API + hạ tầng phụ trợ.

Phạm vi: đủ để một AI coding agent bắt đầu code có kiểm soát. Không bàn design / UI.

---

## 1. main-fe (Next.js public site)

| Thành phần | Chọn | Lý do |
|---|---|---|
| Runtime | Node.js ≥ 20 LTS | ISR + edge API routes |
| Framework | **Next.js ≥ 14** App Router | SSR/SSG/ISR trộn lẫn, edge runtime, partial prerender |
| Ngôn ngữ | TypeScript 5.x strict | Safety |
| UI lib | React 18 | Default Next |
| Styling | Tailwind CSS 3.x + `@tailwindcss/typography` | Không bàn design chi tiết; đủ utilities |
| Form | `react-hook-form` + `zod` | Validation thống nhất FE + API schema |
| Data fetch client | `@tanstack/react-query` v5 | Cart, variation lookup, optimistic update |
| Data fetch server | `fetch` native trong server components + `cache()` | Built-in Next caching |
| Auth session | HttpOnly cookie, server-side session table | Xem [AUTH_RBAC.md](AUTH_RBAC.md) |
| i18n | `next-intl` (khuyến nghị) | Hỗ trợ Polylang migrate; đa route locale |
| Image | `next/image` + `remotePatterns` cho CDN media | AVIF/WebP auto, lazy |
| Icons | `lucide-react` | Nhẹ |
| Date | `dayjs` + `dayjs/plugin/customParseFormat` | `date_format='j F, Y'`; locale vi |
| HTML sanitize | `isomorphic-dompurify` | Render content từ WordPress migrate |
| SEO/meta | Next.js metadata API | Built-in |
| Sitemap | `app/sitemap.ts` + `app/robots.ts` | |
| Analytics | GTM tag (snippet inline) | `view_item`, `view_cart`, `purchase` |
| Test | Vitest + React Testing Library + Playwright | |
| Lint | ESLint + Prettier + TypeScript ESLint | |
| Package manager | pnpm ≥ 9 | Workspaces cho monorepo |

---

## 2. admin-fe (admin site)

| Thành phần | Chọn | Lý do |
|---|---|---|
| Framework | **Next.js 14 App Router** (hoặc Vite + React nếu muốn tách CI) | Consistency với main-fe; routing + auth middleware |
| Ngôn ngữ | TypeScript strict | |
| UI lib | React 18 | |
| Component kit | `shadcn/ui` + Tailwind (tự clone, không rebrand) | Admin kits đủ nhanh |
| Data grid | `tanstack/react-table` | List filter/sort/pagination |
| Form | `react-hook-form` + `zod` | |
| Rich text editor | `TipTap` (ProseMirror) | Editor blog/page, không phải page builder |
| Drag-drop tree (menu) | `@hello-pangea/dnd` hoặc `dnd-kit` | |
| Date picker | `react-day-picker` | |
| Charts | `recharts` | Dashboard KPI |
| Auth | JWT access + refresh cookie | Xem AUTH_RBAC |
| Upload | `tus-js-client` (resumable) hoặc `@uppy/*` | Upload file lớn |
| Test | Vitest + Playwright | |

---

## 3. Backend / API

### 3.1 Lựa chọn

| Option | Khi dùng |
|---|---|
| **Spring Boot 3 (Java 21)** | Team Java; ecosystem mạnh; Spring Batch cho migration scripts |
| **NestJS (Node.js 20)** | Team JS; thống nhất ngôn ngữ với FE; Prisma ORM |
| Node.js Express thuần | Nhỏ gọn nhưng cần tự build auth/rbac; không khuyến nghị cho production |

**Khuyến nghị:** Spring Boot nếu team có 1+ Java dev senior. Nếu không, NestJS.

### 3.2 Stack Spring Boot

| Layer | Công nghệ |
|---|---|
| Language | Java 21 |
| Framework | Spring Boot 3.2+ |
| Web | Spring Web (RESTful) |
| Security | Spring Security + JWT (jjwt) |
| ORM | Spring Data JPA + Hibernate |
| Validation | Jakarta Bean Validation |
| Migration DB | Flyway |
| Serialization | Jackson |
| DTO mapper | MapStruct |
| PDF | OpenPDF (invoice) |
| Email | Spring Mail + Handlebars/Freemarker templates |
| Batch | Spring Batch cho migration + scheduled jobs |
| Job queue | Quartz hoặc Redisson |
| Testing | JUnit 5 + Mockito + Testcontainers |
| API docs | springdoc-openapi (Swagger) |
| Observability | Micrometer + Prometheus |
| Build | Gradle 8 |

### 3.3 Stack NestJS

| Layer | Công nghệ |
|---|---|
| Language | TypeScript 5 strict |
| Framework | NestJS 10 |
| ORM | Prisma hoặc TypeORM |
| Validation | class-validator + class-transformer + zod (optional DTO) |
| Auth | Passport JWT strategy + custom CSRF middleware |
| Queue | BullMQ (Redis) |
| Email | Nodemailer + MJML hoặc Handlebars |
| Testing | Jest + Supertest |
| API docs | Nest Swagger |
| Observability | OpenTelemetry + Prometheus |

---

## 4. Database

| Thành phần | Chọn |
|---|---|
| **Primary DB** | **PostgreSQL 16** |
| Lý do | JSONB cho extras metadata, FTS cho search, reliable, mở rộng |
| Search | PostgreSQL FTS phase 1. Phase 2 đổi sang **Meilisearch** hoặc **Elastic** nếu cần advanced search |
| Migration tool | Flyway (Java) hoặc Prisma Migrate (Node) |
| Backup | `pg_dump` daily → S3; point-in-time recovery qua WAL shipping nếu dùng managed |
| Character set | UTF8 |
| Timezone | UTC trong DB, convert sang `Asia/Ho_Chi_Minh` ở app layer |

Alternative: MySQL 8 nếu stakeholder muốn giữ gần WordPress. Ít khuyến nghị vì mất lợi thế JSONB.

---

## 5. Cache

| Thành phần | Chọn |
|---|---|
| **In-memory cache** | Redis 7 |
| Use cases | Session (session token, CSRF), Rate limit, Product data hot cache, Queue (BullMQ hoặc Redisson), Cart session guest |
| Deployment | Redis single instance phase 1; Redis Cluster khi cần HA |
| Edge cache | Cloudflare CDN trước main-fe |
| Next.js ISR cache | Default (in-memory + file); có thể dùng Vercel hoặc self-host với `next.config.js` cacheHandler để Redis |

---

## 6. Storage / Media

| Thành phần | Chọn |
|---|---|
| **Object storage** | S3-compatible: AWS S3, DigitalOcean Spaces, hoặc **MinIO** self-host |
| Lý do | Chi phí thấp, signed URL cho private, CDN dễ kết hợp |
| CDN | Cloudflare hoặc Bunny.net phía trước S3/MinIO |
| Path giữ nguyên | `/wp-content/uploads/YYYY/MM/*` — xem [MEDIA_ASSET_INVENTORY.md](MEDIA_ASSET_INVENTORY.md) |
| Image resize | `next/image` tại edge; phase 2 dùng Cloudflare Image Resizing nếu traffic lớn |
| Video | Không tự host — giữ YouTube embed |

---

## 7. Deployment runtime

| Thành phần | Chọn |
|---|---|
| Containerization | Docker + Docker Compose phase 1; Kubernetes khi quy mô cần |
| Reverse proxy | Nginx trên bare VPS; Cloudflare front-end |
| SSL | Let's Encrypt với Certbot; Cloudflare Full Strict |
| main-fe hosting | VPS self-host hoặc **Vercel** (nếu budget cho phép — SSR/ISR tốt sẵn) |
| admin-fe hosting | VPS self-host (vì không cần edge CDN) |
| backend hosting | VPS self-host 2 instance + load balancer |
| DB hosting | Managed PostgreSQL (DigitalOcean, Neon, RDS) hoặc self-host với backup tốt |
| Redis | Managed Redis (Upstash, ElastiCache) hoặc self-host |
| S3 | Cloudflare R2 (free egress) khuyến nghị |

---

## 8. Package manager

- Node apps: **pnpm** ≥ 9 với workspaces. Monorepo structure:

```
bigbike/
├── apps/
│   ├── main-fe/
│   ├── admin-fe/
│   └── api/              (nếu chọn NestJS)
├── packages/
│   ├── ui/               (shared admin/main components, chỉ primitives; không design)
│   ├── types/            (TS type shared với API)
│   ├── utils/
│   └── sdk/              (API client shared)
├── migration/            (scripts migration WP → new DB)
├── docker-compose.yml
├── .env.example
├── package.json
└── pnpm-workspace.yaml
```

- Java app (nếu Spring): Gradle, repository riêng hoặc submodule.

---

## 9. Coding conventions

| Mục | Quy ước |
|---|---|
| Code style | Prettier (print width 100) + ESLint airbnb-typescript |
| Java style | Google Java Style |
| Commit | Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`...) |
| Branch | `main` (prod), `develop` (integration), `feat/xyz`, `fix/xyz`, `hotfix/xyz` |
| Pull request | Bắt buộc ≥ 1 reviewer; CI phải pass; không force-push `main` |
| File naming | kebab-case cho file TS/TSX; PascalCase cho class Java |
| Env file | `.env.example` committed; `.env.local` gitignored |
| Secrets | KHÔNG commit; dùng `.env` hoặc secret manager (Doppler, AWS SM) |
| Testing bar | Min 60% coverage phase 1; 80% phase 2 (không tính scripts migration) |
| API schema | Generated từ Zod (Nest) hoặc springdoc (Java). FE import types. |
| Log format | JSON (Pino/Logback JSON encoder), log level theo env |
| Date format API | ISO 8601 UTC; FE convert |
| Error format API | RFC 7807 Problem Details: `{ "type", "title", "status", "detail", "instance" }` |

---

## 10. Environment variables strategy

Phân theo app, khai báo trong `.env.example`. KHÔNG hardcode secret.

### 10.1 main-fe
```
NEXT_PUBLIC_SITE_URL=https://bigbike.vn
NEXT_PUBLIC_API_BASE_URL=https://api.bigbike.vn
NEXT_PUBLIC_CDN_URL=https://cdn.bigbike.vn
NEXT_PUBLIC_GTM_ID=GTM-XXXXX
NEXT_PUBLIC_TURNSTILE_SITE_KEY=xxx
API_INTERNAL_TOKEN=xxx           # server-to-server only, không expose
REVALIDATE_SECRET=xxx
SESSION_SECRET=xxx
REDIS_URL=redis://...
```

### 10.2 admin-fe
```
NEXT_PUBLIC_API_BASE_URL=https://api.bigbike.vn
NEXT_PUBLIC_ADMIN_URL=https://admin.bigbike.vn
API_INTERNAL_TOKEN=xxx
SESSION_SECRET=xxx
```

### 10.3 backend/api
```
APP_ENV=production
APP_PORT=3000
DB_URL=postgresql://...
REDIS_URL=redis://...
S3_ENDPOINT=
S3_BUCKET=bigbike-media
S3_ACCESS_KEY=
S3_SECRET_KEY=
JWT_SECRET=
JWT_ACCESS_TTL=900
JWT_REFRESH_TTL=604800
SMTP_HOST=
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Bigbike.vn <no-reply@bigbike.vn>"
TURNSTILE_SECRET=
WOO_LEGACY_DB_URL=mysql://...   # chỉ trong phase migration
MIGRATION_BATCH_SIZE=1000
SENTRY_DSN=
LOG_LEVEL=info
```

---

## 11. Logging / monitoring

| Layer | Tool |
|---|---|
| App logs | JSON structured (Pino/Logback); ship Loki hoặc CloudWatch |
| Error tracking | Sentry (both FE + backend) |
| Metrics | Prometheus + Grafana; dashboards: request rate, latency, error rate, DB pool, Redis hit rate |
| Tracing | OpenTelemetry → Tempo/Jaeger (phase 2) |
| Uptime | UptimeRobot hoặc BetterStack; SLO 99.9% |
| Alert | Grafana Alerts → email/Slack/Zalo |
| Audit log (business) | Separate DB table (xem ADMIN_REQUIREMENTS §9) |

---

## 12. CI/CD tooling

| Stage | Tool |
|---|---|
| CI | GitHub Actions (hoặc GitLab CI) |
| Lint + Typecheck | `pnpm lint`, `pnpm typecheck` |
| Test | `pnpm test`, `mvn test` |
| Build image | Docker buildx multi-arch |
| Push registry | GHCR hoặc Docker Hub |
| Deploy | Ansible playbook (VPS) hoặc GitOps (ArgoCD) cho K8s |
| Migration trigger | Manual approval step trong pipeline |

---

## 13. Không trong phạm vi

- Không dùng GraphQL phase 1 (REST đủ).
- Không triển khai service mesh (Istio/Linkerd).
- Không chạy multiple microservice phase 1 — monolith backend trước.
- Không tự host observability stack nếu có budget cloud.
- Không dùng serverless function cho business logic — Next.js routes OK cho main-fe; backend dùng container.

---

## 14. Tóm tắt quyết định

| # | Quyết định | Lý do |
|---|---|---|
| 1 | main-fe = Next.js 14 App Router + TypeScript | SEO + perf |
| 2 | admin-fe = Next.js (tái dùng hạ tầng) | Đồng bộ toolchain |
| 3 | backend = Spring Boot 3 (ưu tiên) hoặc NestJS | Stability vs velocity |
| 4 | DB = PostgreSQL 16 | JSONB + FTS |
| 5 | Cache = Redis | Session + queue + rate limit |
| 6 | Storage = S3-compatible với CDN front | Chi phí + perf |
| 7 | Monorepo pnpm workspaces | DRY types + shared SDK |
| 8 | Docker Compose phase 1 | Đơn giản; K8s khi cần |
| 9 | Auth = JWT (admin) + session cookie (customer) | Hợp với pattern SSR |
| 10 | i18n = `next-intl` | Compatible Polylang migrate |
| 11 | Sentry + Prometheus + Grafana | Baseline observability |
| 12 | Conventional Commits + GitHub Actions | Process chuẩn |
