# AGENTS.md

> Operating instructions for AI coding agents working on the BigBike monorepo.
> This is the first document an AI agent reads before modifying code, configs, or tests.
>
> Repository scope:
> - `bigbike-web`: public website / SEO commerce website for end customers (Next.js)
> - `bigbike-admin`: internal admin dashboard (Vite + React)
> - `bigbike-backend`: Spring Boot backend (Java 17)
> - `bigbike_mobile`: Flutter mobile companion app (production scope: `NEEDS_VERIFICATION` — see [docs/business/PROJECT_OVERVIEW.md](docs/business/PROJECT_OVERVIEW.md))
> - `docs/`: business + engineering documentation (source of truth — see Section 2 Docs-First Contract)

---

## 1. Repository Structure

```text
bigbike/
├── AGENTS.md                       # This file — AI agent operating instructions
├── CLAUDE.md                       # Claude Code auto-loaded summary; mirrors key rules from this file
├── docker-compose.yaml             # Full stack infrastructure
├── .env                            # ⚡ Biến môi trường toàn stack — KHÔNG commit, KHÔNG sửa không cần thiết
├── .env.example                    # Template công khai; copy sang .env để dùng local
├── docs/                           # ⚡ Source of truth (see Docs-First Contract)
│   ├── business/                   # Canonical business docs
│   ├── engineering/                # Canonical engineering docs
│   ├── audits/                     # Historical module audits (not canonical)
├── bigbike-web/                    # Public SEO + sales website (Next.js)
│   ├── STYLEGUIDE.md               # Web brand/UI rules
│   ├── styles/brand-tokens.css     # Web CSS token source
│   └── public/brand/               # Web brand assets
├── bigbike-admin/                  # Internal admin dashboard (Vite + React)
│   ├── src/styles/admin-tokens.css # Admin token source
│   └── public/brand/               # Admin brand assets
├── bigbike-backend/                # Spring Boot backend
├── bigbike_mobile/                 # Flutter mobile companion app
└── bigbike_vn__2026_04_17/         # Local-only legacy WordPress export (do not commit)
```

Domain context (products, brand identity, actors): xem [docs/business/PROJECT_OVERVIEW.md](docs/business/PROJECT_OVERVIEW.md). Không lặp lại ở đây để file này không bị stale.

---

## 2. Docs-First Contract — READ THIS BEFORE ANY CODE CHANGE

> Tài liệu trong [docs/business/](docs/business/) và [docs/engineering/](docs/engineering/) là **source of truth** của BigBike. Code dựng từ docs, không phải ngược lại.

### Bắt buộc

1. **Đọc docs liên quan trước khi sửa code.** Trước khi đụng vào bất kỳ file source nào trong [bigbike-backend/](bigbike-backend/), [bigbike-web/](bigbike-web/), [bigbike-admin/](bigbike-admin/) hoặc [bigbike_mobile/](bigbike_mobile/), tra Section 3 mapping và chỉ đọc đúng doc/section liên quan đến phần đang sửa.
2. **Cite evidence khi mô tả thay đổi.** Trong PR summary / final response, cite path docs cụ thể (ví dụ `docs/business/BUSINESS_RULES.md` rule `ORDER_RULE_003`, hoặc `docs/engineering/API_CONTRACT.md` Section 8.3) làm căn cứ.
3. **Không bịa rule.** Nếu rule / contract / permission / state cần thiết không có trong docs hoặc đang `NEEDS_VERIFICATION` / `NOT_FOUND_IN_REPO` / `CONFLICTING_EVIDENCE`, **dừng và hỏi user**.
4. **Docs đi trước code khi có lệch.** Nếu thay đổi ảnh hưởng business rule, API contract, data shape, permission, state machine, workflow hoặc deployment env: update docs trước, rồi mới sửa code, **trong cùng một PR**.
5. **Bug fix vẫn phải cite docs.** Bug = code đang lệch docs. Ghi rõ docs/spec nào bị code làm sai, sau đó fix code về đúng docs. Nếu docs cũng sai, xem điều 4.
6. **Audit/report là context, canonical docs vẫn thắng.** Report trong `docs/audits/` dùng để đọc mismatch/risk context. Nếu report stale hoặc đã ghi historical, ưu tiên current code + canonical docs.

### Khi docs mâu thuẫn

- `docs/business/` mâu thuẫn `docs/engineering/` → **business docs thắng**, engineering cần sửa.
- `docs/engineering/` mâu thuẫn code → check report trong `docs/audits/`; mặc định docs là source of truth nếu chưa có verdict.

### "Refactor nội tại" — ranh giới rõ ràng

Điều kiện miễn doc-update: refactor **không ảnh hưởng** bất kỳ thứ nào sau đây từ góc nhìn bên ngoài service.

| IS "nội tại" (miễn đọc/update docs) | NOT "nội tại" (phải đọc docs và update nếu cần) |
|---|---|
| Rename private method / biến local | Rename public API endpoint, path param, query param |
| Extract private helper trong cùng class/file | Rename field trong DTO / Response / entity |
| Tối ưu query (same result set) | Rename enum value (ảnh hưởng data contract) |
| Refactor logic thuần computational (không đổi output) | Thêm / bỏ / đổi type field entity hoặc DTO |
| Improve logging / error message nội bộ | Thêm / bỏ / đổi HTTP method, status code |
| Clean up dead code không có caller ngoài service | Thêm / bỏ permission check hoặc role |
| Move class sang package nội bộ (không đổi interface) | Thêm / bỏ validation constraint trên DTO public |
| | Thay đổi state transition logic |
| | Thay đổi deployment config / env / secret |

Nếu không chắc → **treat as "not nội tại"** và đọc docs liên quan trước.

### Cấm

- ❌ Sửa code mà không đọc docs liên quan.
- ❌ Đẩy code mà docs không phản ánh thay đổi (trừ refactor nội tại — xem bảng ranh giới trên).
- ❌ Tự suy diễn rule khi docs ghi `NEEDS_VERIFICATION` / `NOT_FOUND_IN_REPO` / `CONFLICTING_EVIDENCE`.
- ❌ "Code-first, doc-fix-later" trừ khi user explicitly cho phép.
- ❌ Tự "fix" cái đã được report/audit flag là code bug — đó là task riêng có ngữ cảnh riêng.

---

## 3. Required Reading Order — đọc lazy theo nhu cầu

**Nguyên tắc: đọc tài liệu theo nhu cầu — không đọc toàn bộ khi chỉ cần một phần.**

Trước khi mở bất kỳ doc nào:

1. **Phân loại input** — câu hỏi/giải thích, hay thay đổi code thật sự?
2. **Xác định scope** — thay đổi đụng đến phần nào (web? admin? backend? deployment?)?
3. **Tra bảng mapping** — chỉ đọc mục 3.2–3.5 tương ứng scope đó; trong mỗi file, chỉ đọc section liên quan.

**Không cần mở docs khi:**
- Câu hỏi giải thích / Q&A không liên quan business rule, API contract, permission, hay state machine.
- Thay đổi thuần style (spacing, token reference, font) — quy tắc đã đủ trong AGENTS.md/CLAUDE.md.
- Refactor nội tại không ảnh hưởng API / data contract / permission / state / deployment.

**Cần đọc docs (và chỉ section liên quan) khi:**
- Thay đổi business logic → đọc section liên quan trong `BUSINESS_RULES.md` hoặc `STATE_MACHINES.md`.
- Thay đổi API shape / endpoint → đọc section endpoint đó trong `API_CONTRACT.md`.
- Thay đổi permission → đọc role liên quan trong `PERMISSION_MATRIX.md`.
- Thay đổi data shape / entity → đọc entity đó trong `DATA_CONTRACT.md`.

### 3.1 Ngữ cảnh nền — chỉ khi task cần hiểu toàn cảnh hệ thống

AGENTS.md đã được load. Chỉ mở thêm nếu task thật sự cần biết actor map hoặc tech stack:

```text
docs/business/PROJECT_OVERVIEW.md        # Actor map / scope hệ thống
docs/engineering/ARCHITECTURE.md         # Tech stack / layer / runtime boundary
docs/audits/                             # Chỉ nếu task liên quan mismatch/lỗi đã flag
```

Task thông thường (fix bug, thêm feature nhỏ, giải thích code, style fix): bỏ qua, đi thẳng 3.2–3.5.

### 3.2 Khi thay đổi `bigbike-web`

| Bạn đang sửa | Đọc (chỉ section liên quan) |
|---|---|
| Gọi API / xử lý response | `docs/engineering/API_CONTRACT.md` section endpoint đó; `docs/engineering/DATA_CONTRACT.md` section field liên quan |
| Flow màn hình → API | `docs/engineering/API_FLOW_MAP.md` section flow đó |
| Workflow end-to-end | `docs/business/WORKFLOW_OVERVIEW.md` section liên quan |
| Module / feature ownership | `docs/business/MODULE_CATALOG.md` |
| UI / style / component | `bigbike-web/STYLEGUIDE.md`; `bigbike-web/styles/brand-tokens.css` + Section 6 |
| Next.js config / routing | `bigbike-web/AGENTS.md` |
| Brand assets | `bigbike-web/public/brand/` |
| Audit / known mismatch | `docs/audits/` (chỉ nếu liên quan) |

Dùng cho: Homepage, Category/listing, PDP, Search, Cart, Checkout, SEO content, Public pages, Responsive/mobile.

### 3.3 Khi thay đổi `bigbike-admin`

| Bạn đang sửa | Đọc (chỉ section liên quan) |
|---|---|
| Gọi API admin / xử lý response | `docs/engineering/API_CONTRACT.md` section endpoint đó |
| Permission / route guard | `docs/engineering/PERMISSION_MATRIX.md` section role liên quan |
| Data shape / normalizer | `docs/engineering/DATA_CONTRACT.md` section field liên quan |
| Role / user type | `docs/business/USER_ROLES.md` |
| Module / feature scope | `docs/business/MODULE_CATALOG.md` |
| State transition (đơn hàng, trả hàng, sản phẩm) | `docs/business/STATE_MACHINES.md` section entity đó |
| Design token / style | `bigbike-admin/src/styles/admin-tokens.css` + Section 6 |
| Brand assets | `bigbike-admin/public/brand/` |
| OpenAPI raw schema | `bigbike-backend/src/main/resources/openapi/bigbike-openapi.json` |

Dùng cho: Dashboard, Product management, Order management, Content management, Settings, CRUD screens, Role/permission behavior.

### 3.4 Khi thay đổi `bigbike-backend`

| Bạn đang sửa | Đọc (chỉ section liên quan) |
|---|---|
| API endpoint contract | `docs/engineering/API_CONTRACT.md` section controller/endpoint đó |
| Entity / DTO / enum | `docs/engineering/DATA_CONTRACT.md` section entity đó; **Section 7** (Lombok/MapStruct/Validation) |
| Permission / role | `docs/engineering/PERMISSION_MATRIX.md` section role liên quan |
| Integration (DB, MinIO, Mail, WS, migration) | `docs/engineering/INTEGRATION_GUIDE.md` section service đó |
| Business rule (giá, tồn kho, transition) | `docs/business/BUSINESS_RULES.md` section rule liên quan |
| State transition | `docs/business/STATE_MACHINES.md` section entity đó |
| End-to-end workflow context | `docs/business/WORKFLOW_OVERVIEW.md` section liên quan |
| Phase report (historical) | `bigbike-backend/docs/PHASE_*.md` (chỉ phase liên quan) |

Dùng cho: API endpoints, Request/response shapes, Validation, Order/payment/product state transitions, Permissions, Business enforcement, Data model alignment.

### 3.5 Khi thay đổi legacy migration

Trước khi implement product, order, content, auth, customer, media, category, brand, search, cart, checkout, hoặc public route behavior derive từ legacy WordPress, inspect:

```text
bigbike_vn__2026_04_17/             # Local-only legacy WordPress export
bigbike_vn__2026_04_17/sqldump.sql  # Schema-only reference
```

**Không commit** raw WordPress source, raw SQL dump data, `wp-config.php` secret values, user data, order data, customer email/phone/address, password hash, session, token, API key, webhook secret, hoặc order key values.

### 3.6 Khi thay đổi `bigbike_mobile`

> **Production scope**: `NEEDS_VERIFICATION` — xem [docs/business/PROJECT_OVERVIEW.md](docs/business/PROJECT_OVERVIEW.md) để confirm scope trước khi implement feature lớn.

| Bạn đang sửa | Đọc (chỉ section liên quan) |
|---|---|
| Gọi API / response shape | `docs/engineering/API_CONTRACT.md` section endpoint đó; `docs/engineering/DATA_CONTRACT.md` section field liên quan |
| Auth / session | `docs/engineering/API_CONTRACT.md` section auth; `docs/engineering/PERMISSION_MATRIX.md` |
| Business flow | `docs/business/WORKFLOW_OVERVIEW.md` section liên quan |
| Business rule | `docs/business/BUSINESS_RULES.md` section rule liên quan |
| Feature / module scope | `docs/business/MODULE_CATALOG.md` |

Dùng cho: Flutter mobile companion app — screens, API calls, state management, navigation.

**Lưu ý**: `bigbike_mobile` dùng Flutter/Dart. Section 6 (React/Tailwind/shadcn) và Section 7 (Spring Boot/Lombok/MapStruct) không áp dụng cho mobile code. Docs-First Contract (Section 2) và global rules (Section 5) áp dụng bình thường.

---

## 4. Source of Truth Map

| Concern | Source of truth |
|---|---|
| **Business overview / actors / modules / workflows / rules / states** | [docs/business/](docs/business/) — `PROJECT_OVERVIEW.md`, `MODULE_CATALOG.md`, `USER_ROLES.md`, `BUSINESS_PROCESS.md`, `BUSINESS_RULES.md`, `WORKFLOW_OVERVIEW.md`, `STATE_MACHINES.md`, `ACCEPTANCE_CRITERIA.md`, `GLOSSARY.md` |
| **Technical architecture / API contract / data contract / permission / deployment** | [docs/engineering/](docs/engineering/) — `ARCHITECTURE.md`, `API_CONTRACT.md`, `DATA_CONTRACT.md`, `API_FLOW_MAP.md`, `PERMISSION_MATRIX.md`, `TESTING_GUIDE.md`, `DEPLOYMENT_GUIDE.md`, `INTEGRATION_GUIDE.md`, `TRACEABILITY_MATRIX.md` |
| **Docs governance / agent operating rules** | This `AGENTS.md` + canonical docs under `docs/` |
| **Latest docs↔code audit / known mismatches** | `docs/audits/` (historical; canonical docs still win) |
| **Brand identity, logo, colors, typography, copy** | `bigbike-web/STYLEGUIDE.md`, `bigbike-web/styles/brand-tokens.css`, `bigbike-admin/src/styles/admin-tokens.css` |
| **Brand assets (logos, icons, fonts, favicons)** | `bigbike-web/public/brand/` + `bigbike-admin/public/brand/` |
| **Backend OpenAPI raw schema** (machine-readable companion to `API_CONTRACT.md`) | `bigbike-backend/src/main/resources/openapi/bigbike-openapi.json` |
| **Backend phase implementation reports** (historical) | `bigbike-backend/docs/` |
| **SEO redirect map** | `bigbike-web/docs/` |
| **Legacy WordPress data and migration reference** | `bigbike_vn__2026_04_17/` (local-only) |

Quy tắc khi docs mâu thuẫn nhau: xem Section 2.

---

## 5. Global Agent Rules

### 5.1 Không bịa, không tự suy diễn

Do not invent:
- Order statuses, payment statuses, product stock states.
- Warranty / return / exchange / promotion / shipping fee rules.
- Permission rules, API fields, database columns.

Nếu rule thiếu, mark `TBD` hoặc giải thích gap. Không "fill the gap with confident nonsense" — đó là ngôn ngữ chính thức của nhiều hệ thống đã hỏng.

### 5.2 Backend enforces business logic

Frontend may validate for UX, nhưng backend **phải** enforce: price, quantity, stock, product availability, order/payment status transition, permissions, checkout validity, admin actions. Never trust frontend totals.

### 5.3 All screens need designed states

Mọi screen/component phải handle:

- Loading.
- Empty.
- Error.
- Success.
- Disabled.
- Permission denied (khi relevant).
- Updating/submitting.
- Partial data (khi relevant).
- Unknown status fallback.
- Network failure (khi relevant).

Never render raw `null`, `undefined`, `NaN`, `[object Object]`. Dùng fallback designed.

### 5.4 Legacy migration guardrails

Không implement product, order, content, auth, customer, media, category, brand, search, cart, checkout, hoặc public route behavior **from memory**. Inspect `bigbike_vn__2026_04_17/` trước (xem Section 3.5).

Never commit raw legacy source, `sqldump.sql`, `wp-config.php` values, user/order/customer PII, password hashes, sessions, tokens, API keys, webhook secrets, hoặc raw redirect exports.

Không build new feature **ahead of** legacy discovery cho affected domain.

### 5.5 File `.env` — biến môi trường toàn stack

**`.env` ở root repo là file cấu hình chính của toàn bộ BigBike stack** khi chạy local với Docker Compose. File này được Docker Compose load tự động và truyền vào tất cả service (backend, web, admin, db, redis, minio).

**Các nhóm biến quan trọng trong `.env`:**

| Nhóm | Biến tiêu biểu | Ảnh hưởng |
|---|---|---|
| Database | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Kết nối PostgreSQL |
| Spring Boot profile | `SPRING_PROFILES_ACTIVE` | `dev` cho local, `prod` cho staging/prod |
| JWT | `BIGBIKE_JWT_SECRET` | Ký session token — phải ≥ 32 chars trên prod |
| SMTP / Email | `BIGBIKE_MAIL_HOST`, `BIGBIKE_MAIL_USERNAME`, `BIGBIKE_MAIL_PASSWORD` | Gửi email xác minh, đặt lại mật khẩu, thông báo đơn hàng |
| URL email | `BIGBIKE_MAIL_VERIFY_BASE_URL`, `BIGBIKE_MAIL_RESET_BASE_URL` | Domain trong link gửi về hộp thư — phải là `http://localhost:3000/...` trên local |
| URL site | `BIGBIKE_SITE_BASE_URL`, `BIGBIKE_ADMIN_BASE_URL` | URL xuất hiện trong email template và sitemap |
| CORS | `BIGBIKE_CORS_ALLOWED_ORIGINS` | Danh sách origin frontend được phép gọi API |
| MinIO | `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_BUCKET` | Object storage cho media |
| Frontend | `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SITE_URL` | URL API và site dùng trong Next.js |

**Quy tắc bắt buộc:**
- **KHÔNG commit `.env`** — file đã có trong `.gitignore`. Chỉ commit `.env.example`.
- Khi gặp URL sai môi trường (ví dụ link email trỏ về production khi đang ở localhost) → **kiểm tra `.env` trước**, không sửa code.
- Khi thêm biến môi trường mới vào code → **cập nhật `.env.example`** đồng thời.
- `SPRING_PROFILES_ACTIVE=dev` là bắt buộc cho local để backend load `application-dev.properties` đúng cách.

**Cấm:**
- ❌ Hardcode giá trị từ `.env` (URL, secret, password) vào source code.
- ❌ Commit `.env` với credentials thật lên git.
- ❌ Sửa URL hoặc endpoint trong code khi vấn đề thực ra nằm ở `.env`.

### 5.6 Docker server access khi fix bug / vận hành hệ thống

Khi cần fix lỗi runtime, debug, kiểm tra log, query DB thật, verify migration, hoặc làm task vận hành cần dữ liệu/trạng thái runtime:

- **Được phép vào trực tiếp container Docker đang chạy** (backend, db, redis, web, admin…) qua `docker ps`, `docker logs`, `docker exec`, `docker compose exec`.
- **Luôn `docker ps` (hoặc `docker compose ps`) trước** để xác nhận stack đang chạy.
- Container cần dùng **chưa chạy / stopped / exited** → **DỪNG và yêu cầu user khởi động** (`docker compose up -d <service>`). Không tự ý `up`, `start`, `restart`, `down`, `rm`, `prune` — đó là shared state.
- Trong container, mặc định chỉ **thao tác đọc** (logs, `SELECT`, `SHOW`, `EXPLAIN`, `cat`, `ls`). Thao tác ghi/destructive (`UPDATE`, `DELETE`, `DROP`, `TRUNCATE`, sửa file config, kill/restart service…) phải hỏi user trước.
- Khi report kết quả, cite rõ container/service và command đã chạy để user verify được.

**Cấm:**
- ❌ Giả định container đang chạy mà không check `docker ps`.
- ❌ Tự ý `docker compose up/down/restart/rm`, xoá volume/network, prune image.
- ❌ Destructive command trong container đang chạy khi user chưa duyệt.
- ❌ Mock dữ liệu khi container thật đang chạy và có thể query — luôn ưu tiên data thật để chẩn đoán root cause.

---

## 6. Frontend Stack — React + Tailwind CSS + Radix UI + shadcn/ui

Áp dụng cho **toàn bộ** code UI trong `bigbike-web` và `bigbike-admin`.

### 6.1 Stack mandate

Khi code bất kỳ UI component hoặc layout nào:

| Việc cần làm | Dùng |
|---|---|
| Component UI (button, input, select, dialog, checkbox, tabs…) | **shadcn/ui** từ `components/ui/` |
| Styling, spacing, color, layout | **Tailwind CSS** utility classes viết **trực tiếp vào `className`** |
| Interactive primitive (dropdown, tooltip, popover, radio…) | **Radix UI** qua shadcn wrapper |
| Variant / override | `cn()` + `cva()` / `buttonVariants()` |
| Color / token reference | `@theme inline` trong `globals.css` (`text-primary`, `bg-brand`, `border-border`…) |

**globals.css** chỉ được chứa:
1. Design tokens (`@theme inline { ... }`).
2. Base/reset styles (`body`, `*`, `html`).
3. shadcn/ui component overrides.
4. Rule CSS mà Tailwind thật sự không làm được (complex `@keyframes`, multi-step pseudo-selector, `@supports`, third-party widget overrides).

Không thêm class mới vào `globals.css` chỉ vì muốn đặt tên ngắn — đó là lý do của Tailwind utility + `cn()`.

**Cấm:**
- ❌ Native `<select>`, `<input type="checkbox">`, `<dialog>`, `<button>` khi shadcn `Select`, `Checkbox`, `Dialog`, `Button` đã có sẵn.
- ❌ Xóa hoặc bypass shadcn component để thay bằng raw HTML + class legacy.
- ❌ Tạo component UI từ đầu khi Radix UI / shadcn đã có primitive phù hợp.
- ❌ Hardcode hex màu, spacing px, font string trực tiếp — dùng token.
- ❌ `styled-components`, `emotion`, hoặc CSS-in-JS nào khác.

### 6.2 Design System Unity — toàn bộ web và admin phải nhất quán

Mọi trang, route, component phải có visual appearance bắt nguồn từ **cùng một design system của BigBike**. Hai app dùng chung brand palette nhưng có **font system riêng** — không trộn lẫn.

#### bigbike-web — token cascade

```
bigbike-web/STYLEGUIDE.md            ← brand rules (source of truth)
  ↓ mapped into
bigbike-web/styles/brand-tokens.css  ← CSS custom properties
  ↓ exposed via
bigbike-web/app/globals.css          ← @theme inline → Tailwind tokens
  ↓ used as
Tailwind utility classes in JSX      ← text-primary, bg-brand, border-border, …
```

**Quy tắc:**
- **Màu**: chỉ palette `STYLEGUIDE.md` (`#FF0C09` brand red, `#007BFF` blue, `#00BFFF` chat cyan, neutral tokens). Tham chiếu qua CSS variable / Tailwind token. Không hardcode hex.
- **Font**: `Barlow` (body/UI/content), `Oswald` (heading/CTA/badge/nav), `Barlow Condensed` (display/hero/campaign). Heading/nav/CTA/badge → uppercase; body → sentence case.
- **Scale**: Tailwind `text-xs`–`text-5xl` hoặc size explicit từ `STYLEGUIDE.md`. Không arbitrary `text-[13px]`.
- **Spacing**: thang 4px (`p-4`=16px, `gap-6`=24px, `mt-8`=32px). Container `max-w-[1200px]`. Section spacing desktop 72px / tablet 52px / mobile 32px. Touch target ≥ 44px.
- **Border radius**: `rounded-none` mặc định; `rounded-full` chỉ cho avatar / badge dot / chat button.

#### bigbike-admin — token cascade

```
bigbike-admin/src/styles/admin-tokens.css   ← admin palette + type scale (source of truth)
  ↓ imported via
bigbike-admin/src/index.css                  ← admin CSS entry point
  ↓ exposed via
Tailwind utility classes / CSS variables     ← text-primary, bg-brand, var(--admin-...), …
```

**Quy tắc:**
- **Màu**: BigBike admin palette (red/black identity) từ `admin-tokens.css`. Tham chiếu qua CSS variable / Tailwind token.
- **Font**: `Bungee` (display/headline, uppercase only), `Exo` (body/UI/content, 9 weights). **Không dùng Barlow/Oswald/Barlow Condensed** trong admin.
- **Scale / spacing / radius**: cùng quy tắc như web.
- **Visual style**: operational/data-first — dense, readable, table/form/filter centric. Không hero/campaign visuals trong operational screens (trừ module preview cụ thể yêu cầu).

#### Visual consistency check (cho cả 2 app)

Trước khi ship component/screen mới: so sánh visually với phần đã có — màu, font, spacing, radius cùng hệ thống chưa? Nếu khác biệt → align lại, không phải "trang đó đúng theo chuẩn riêng".

**Cấm (cả 2 app):**
- ❌ Arbitrary Tailwind value (`bg-[#abc]`, `text-[13px]`, `p-[17px]`) khi token tương đương đã tồn tại.
- ❌ Tailwind built-in color (`bg-red-500`, `text-blue-600`) thay vì brand token.
- ❌ Import font / `@font-face` ngoài danh sách approved.
- ❌ Dùng font/token của app này trong app kia.
- ❌ Generic shadcn default look, Tailwind UI template look, SaaS dashboard look, starter template look — phải trông như BigBike.

### 6.3 Inline Tailwind — không tạo class CSS mới khi Tailwind là đủ

Mọi styling phải viết **trực tiếp vào `className`** bằng Tailwind utility. Không tạo class CSS mới chỉ để dùng lại trong component.

**Sai — tạo class CSS rồi dùng:**

```css
/* globals.css */
.product-row { display: flex; padding: 16px; border-bottom: 1px solid #e5e7eb; }
.confirm-btn { background-color: #FF0C09; padding: 8px 16px; }
```
```jsx
<div className="product-row">...</div>
<button className="confirm-btn">Xác nhận</button>
```

**Đúng — viết thẳng Tailwind:**

```jsx
<div className="flex items-center p-4 border-b border-border bg-background">...</div>
<Button variant="default">Xác nhận</Button>
```

**Đúng — `cn()` cho variant/điều kiện:**

```jsx
<div className={cn(
  "flex items-center p-4 border-b border-border",
  isSelected && "bg-muted",
  isDisabled && "opacity-50 pointer-events-none"
)}>...</div>
```

**Được phép viết vào CSS file:**

| Được phép | Ví dụ |
|---|---|
| `@keyframes` animation phức tạp | `@keyframes shimmer { ... }` |
| Pseudo-selector Tailwind không làm được | `::selection`, `::-webkit-scrollbar` |
| Override third-party widget | Quill editor, react-datepicker, … |
| Base/reset trong `globals.css` | `body`, `*`, `html` |
| Design token (`@theme inline`) | `--color-brand: #FF0C09` |

**Quy trình kiểm tra trước khi viết CSS:**
1. Tailwind có utility tương đương? → viết thẳng `className`.
2. Combine nhiều class có điều kiện? → `cn()`.
3. Variant tái dùng nhiều chỗ? → tạo component hoặc `cva()`, không tạo CSS class.
4. Thật sự Tailwind không làm được? → mới viết CSS, kèm comment giải thích.

**Cấm:**
- ❌ File `.module.css` per component.
- ❌ `<style>` tag trong JSX/TSX.
- ❌ Class mới đặt tên theo component (`.product-row`, `.confirm-btn`, `.filter-bar-wrapper`).
- ❌ Class utility tự đặt (`.flex-center`, `.text-muted-sm`, `.btn-primary`).
- ❌ CSS file riêng per-page / per-screen / per-feature.

### 6.4 Component reuse — bắt buộc kiểm tra trước khi tạo mới

Trước khi tạo bất kỳ component mới nào, **phải check** danh sách đã có:

#### bigbike-web

| Thư mục | Có sẵn |
|---|---|
| `bigbike-web/components/ui/` | Primitive shadcn (Button, Input, Select, Dialog, Checkbox, Tabs, Tooltip, Popover, …) + helpers (`EmptyState`, `ErrorState`, `LoadingGrid`, `PriceText`, `MediaImage`, `RatingStars`, `PaginationNav`, `Skeletons`, `VnAddressFields`, `BBTooltip`) |
| `bigbike-web/components/layout/` | `SiteHeader`, `SiteFooter`, `PageHero`, `AccountShell`, `PolicySidebar`, `StickyHeaderShell` |
| `bigbike-web/components/catalog/` | `ProductCard`, `ProductGallery`, `VariantSelector`, `AddToCartButton`, `CatalogFilters`, `ReviewsSection` |

#### bigbike-admin

| Component | Dùng cho |
|---|---|
| `AdminTable` | Mọi bảng dữ liệu list (sản phẩm, đơn hàng, khách hàng, …) |
| `AdminShell` | Layout wrapper toàn trang admin (sidebar + header + content) |
| `ConfirmDialog` | Hành động destructive cần xác nhận (xóa, hủy, …) |
| `StatusBadge` | Hiển thị trạng thái (đơn hàng, sản phẩm, …) |
| `PaginationControls` | Phân trang cho list/table |
| `FilterChips` | Hiển thị filter đang active dạng chip |
| `BulkActionBar` | Thanh action khi chọn nhiều row |
| `RichTextEditor` | Editor soạn thảo nội dung |
| `StatePanel` | Panel trạng thái + action (state machine UI) |
| `DetailSection` | Section có tiêu đề trong trang detail |
| `DateRangePicker` | Chọn khoảng ngày cho filter/report |
| `ExportButton` | Nút export dữ liệu |
| `ReadOnlyBanner` | Banner cảnh báo màn hình read-only |
| `TagInput` | Input nhập nhiều tag/label |
| `MediaPickerModal` / `VideoPickerModal` / `ImageUrlInput` | Chọn / nhập media |
| `MediaCard` / `MediaCardSkeleton` / `MediaPreviewLightbox` / `MediaListRow` / `MediaDetailModal` / `MediaDetailPanel` / `MediaFolderSidebar` | Media library UI |
| `NotificationBell` / `OrderNotificationToast` | Realtime notification |
| `ErrorBoundary` | Bắt lỗi render, hiển thị fallback |

**Layout primitives** (`bigbike-admin/src/components/layout/`, import qua `index.js`):

| Component | Dùng cho |
|---|---|
| `Screen` | Wrapper chuẩn cho mọi trang (padding, max-width, scroll) |
| `ScreenHeader` | Header trang: tiêu đề + breadcrumb + action button |
| `FilterBar` | Thanh filter: search + select + date range |
| `SummaryCard` | Card chỉ số tổng quan (dashboard, report) |
| `Tabs` | Tab navigation trong trang |
| `Modal` | Modal wrapper chuẩn |
| `StickyActionBar` | Thanh action dính dưới màn hình (form save/cancel) |
| `MobileCardList` | List dạng card trên mobile thay table |
| `FormField` | Field wrapper: label + input + error message |

**Quy trình bắt buộc trước khi tạo component mới:**
1. Tìm trong danh sách trên — có component nào đáp ứng không?
2. Gần đúng nhưng cần thêm prop → **extend component có sẵn**, không tạo bản copy.
3. Thực sự chưa có → tạo mới trong thư mục phù hợp, đặt tên theo convention (PascalCase `.jsx` / `.tsx`).
4. Component mới phải tuân thủ Section 6.2 (design system) — không tự ý chọn màu/font/spacing.

**Cấm:**
- ❌ Tạo `MyConfirmModal` khi `ConfirmDialog` đã có; `MyTable` khi `AdminTable` đã có; `MyPagination` khi `PaginationControls` đã có; v.v.
- ❌ Copy-paste component có sẵn rồi sửa nhỏ — phải extend hoặc dùng thẳng.
- ❌ Layout wrapper mới khi `Screen`, `ScreenHeader`, `FilterBar`, `Modal` đã đáp ứng.
- ❌ Tạo component mà không check danh sách trước.

### 6.5 Encoding và chính tả tiếng Việt — không mojibake, phải có dấu

Mọi text trong source code — JSX content, string literal, comment, error message, log, placeholder, aria-label, alt text, tooltip — phải:

1. **File encoding: UTF-8** (không BOM) — mọi `.tsx`, `.jsx`, `.ts`, `.js`, `.css`, `.json`, `.md`. Không Latin-1, Windows-1252.
2. **Không mojibake** — không xuất hiện ký tự bị vỡ.
3. **Tiếng Việt phải có dấu** — không "tiếng Việt không dấu".

**Sai — mojibake / không dấu:**

```jsx
<p>ThÃ nh toÃ¡n thÃ nh cÃ´ng</p>           // ❌ encoding vỡ
<p>Gi&#7843;m gi&#225;</p>                  // ❌ unicode escape thủ công
<h1>San pham noi bat</h1>                  // ❌ không dấu
<Button>Thanh toan</Button>                // ❌ không dấu
```

**Đúng:**

```jsx
<h1>Sản phẩm nổi bật</h1>
<p>Thêm vào giỏ hàng</p>
<Button>Thanh toán</Button>
toast.error("Không thể hủy đơn hàng")
```

**Áp dụng cho:** JSX content, string literal, placeholder, aria-label, alt text, toast/notification, comment trong code, console log/error, JSON/API mock.

**Nguyên nhân gây mojibake — phải tránh:**
- Lưu file encoding khác UTF-8 rồi mở lại bằng UTF-8.
- Copy text từ Word/Excel không chuyển encoding.
- Dùng `Buffer` / `TextDecoder` sai encoding khi xử lý response.
- Template string nối ký tự Unicode escape thủ công thay vì viết thẳng.

**Cấm:**
- ❌ Tiếng Việt không dấu trong bất kỳ string nào hiển thị UI.
- ❌ Unicode escape thủ công (`ả`, `&#7843;`) khi có thể viết thẳng UTF-8.
- ❌ File source lưu encoding khác UTF-8.
- ❌ Comment / log tiếng Việt không dấu.

### 6.6 CSS hygiene — không để dead code, xóa ngay khi phát hiện

**Dead CSS** = class được định nghĩa trong file `.css` nhưng không có reference nào trong bất kỳ `.jsx` / `.tsx` / `.js` nào. Dead CSS gây confusion và làm file ngày càng phình ra vô ích.

#### Nguyên tắc phòng ngừa

Mỗi class CSS mới phải được dùng ngay trong cùng commit. Nếu viết class vào `.css` mà không có JSX nào reference → đó là mistake ngay tại điểm viết.

**Ngoại lệ được phép — không tính là dead:**
- Selector của third-party lib (ProseMirror `.tiptap`, Recharts `.recharts-*`, react-day-picker `.rdp-*`) — lib inject class vào DOM lúc runtime.
- State/modifier class set qua `classList.add` / `element.className = ...` trong JS thuần — grep JSX bỏ sót.
- `@keyframes` — chỉ dead nếu không có `animation:` hoặc `animation-name:` reference đến tên đó trong cùng file CSS.

#### Quy trình bắt buộc khi nghi ngờ dead CSS

Trước khi kết luận dead, **phải grep xác nhận**:

```bash
# Kiểm tra class cụ thể (chạy từ root repo)
grep -rn "ten-class" bigbike-admin/src --include="*.jsx" --include="*.tsx" --include="*.js"
grep -rn "ten-class" bigbike-web    --include="*.jsx" --include="*.tsx" --include="*.js" --include="*.ts"
```

- Grep ra **kết quả** → class đang dùng → giữ nguyên.
- Grep ra **0 kết quả** → dead → **xóa ngay trong cùng task**, không ghi TODO.

#### Kiến trúc CSS bigbike-admin — hai hệ song song

`bigbike-admin` chạy **hai hệ CSS song song**. Không được nhầm lẫn về trạng thái của từng file:

| File | Hệ | Prefix class | Trạng thái |
|---|---|---|---|
| `src/index.css` | Mới — production | không prefix (`sidebar`, `admin-table`, `screen`, …) | Active |
| `src/styles/admin-layout.css` | Mới — production | không prefix (`summary-card`, `seg-tabs`, `dash-*`, …) | Active |
| `src/styles/admin-prototype.css` | Cũ — prototype ported | `bb-*` | **Vẫn active** — dùng bởi `AdminShell`, `DashboardScreen`, `LoginScreen` và nhiều screen khác. **KHÔNG giả định dead mà không grep.** |
| `src/styles/admin-tokens.css` | Design tokens | `--bb-*`, `--admin-*` CSS variables | Active |

**Đặc biệt với `bb-*` class**: Phần lớn `bb-*` đang được dùng nặng (`bb-sidebar`, `bb-nav-link`, `bb-kpi`, `bb-card`, `bb-table`, `bb-btn`, `bb-screen-header`, …). Một số đã được xác nhận dead và xóa (tháng 5/2026): `bb-search`, `bb-checkbox`, `bb-radio`, `bb-switch`, `bb-tabs`, `bb-detail-grid`, `bb-detail-grid-wide`, `bb-timeline`. Không xóa thêm mà không grep.

#### Khi thêm class mới vào file CSS

1. Tailwind không làm được? → mới viết CSS (xem Section 6.3).
2. Viết class → **ngay lập tức viết JSX reference trong cùng commit**.
3. Class chỉ dùng một chỗ duy nhất → không cần CSS, dùng Tailwind inline.
4. Class mới trong `admin-prototype.css` → **không được thêm** — đây là file legacy. Thêm vào `admin-layout.css` hoặc `index.css` thay thế.

**Cấm:**
- ❌ Viết CSS class vào `.css` mà không có JSX nào dùng ngay.
- ❌ "Placeholder" class — "sẽ dùng sau" không được tồn tại.
- ❌ Copy cả block CSS từ nơi khác rồi chỉ dùng một phần, bỏ phần còn lại.
- ❌ Kết luận dead mà không grep xác nhận.
- ❌ Phát hiện dead CSS → ghi TODO "sẽ xóa sau" — phải xóa ngay.
- ❌ Thêm class mới vào `admin-prototype.css` (file legacy, chỉ đọc để maintain).

---

## 7. Backend Stack — Spring Boot + Lombok + MapStruct + Bean Validation

Áp dụng cho **toàn bộ** code Java trong `bigbike-backend`. Bắt buộc dùng triệt để 3 thư viện sau — không viết boilerplate thủ công khi thư viện đã xử lý được.

### 7.1 Lombok — không viết getter / setter / constructor / logger thủ công

| Tình huống | Dùng |
|---|---|
| Class cần getter + setter | `@Getter` + `@Setter` |
| DTO / value object (không phải JPA Entity) | `@Data` (gồm getter, setter, equals, hashCode, toString) |
| Builder pattern | `@Builder` |
| Constructor không tham số | `@NoArgsConstructor` |
| Constructor tất cả field | `@AllArgsConstructor` |
| Constructor chỉ field `final` / `@NonNull` | `@RequiredArgsConstructor` |
| Logging | `@Slf4j` → `log.info(...)`, `log.error(...)` |
| DTO immutable / read-only | `@Value` |
| Loại field khỏi equals / hashCode / toString | `@EqualsAndHashCode.Exclude` / `@ToString.Exclude` |

**JPA Entity — không dùng `@Data`:**

```java
// ✅ Đúng — Entity dùng @Getter/@Setter riêng, tránh vòng lặp lazy-load
@Entity
@Getter @Setter @NoArgsConstructor
public class Product {
    @Id @GeneratedValue
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Category category;
}

// ❌ Sai — @Data trên Entity gây vòng lặp vô hạn với lazy relationship
@Data @Entity
public class Product { ... }
```

**Cấm:**
- ❌ Viết getter / setter thủ công khi Lombok đã được import.
- ❌ Khai báo `private static final Logger log = LoggerFactory.getLogger(...)` thủ công — dùng `@Slf4j`.
- ❌ Viết constructor thủ công chỉ để gán field — dùng `@RequiredArgsConstructor` / `@AllArgsConstructor`.
- ❌ Dùng `@Data` trên JPA Entity có `@ManyToOne` / `@OneToMany` lazy relationship.

### 7.2 MapStruct — không viết mapping Entity ↔ DTO thủ công

Mọi conversion Entity ↔ DTO phải qua MapStruct mapper interface.

```java
// ✅ Đúng
@Mapper(componentModel = "spring")
public interface ProductMapper {
    ProductResponse toResponse(Product product);

    @Mapping(target = "categoryName", source = "category.name")
    ProductSummaryResponse toSummary(Product product);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    Product toEntity(CreateProductRequest request);

    List<ProductResponse> toResponseList(List<Product> products); // MapStruct tự generate
}

// ❌ Sai — mapping thủ công
ProductResponse response = new ProductResponse();
response.setId(product.getId());
response.setName(product.getName());
// ...
```

**Quy tắc:**
- Mapper là `interface`, đặt trong package `mapper/` (ví dụ `com.bigbike.product.mapper.ProductMapper`).
- Luôn dùng `componentModel = "spring"` để inject qua constructor injection.
- `@Mapping(target, source)` cho field khác tên hoặc nested field.
- `@Mapping(target, ignore = true)` cho field không cần map (id, audit fields, …).
- `@AfterMapping` / `@BeforeMapping` cho logic phức tạp sau/trước khi map.
- `List<Entity>` → `List<DTO>`: khai báo method signature, MapStruct tự generate.

**Cấm:**
- ❌ Set từng field thủ công khi MapStruct xử lý được.
- ❌ `BeanUtils.copyProperties()` thay vì MapStruct.
- ❌ Mapper là class thường (không phải interface) trừ khi logic phức tạp bắt buộc.
- ❌ Đặt mapper trong service hay controller — mapper phải là layer riêng.

### 7.3 Bean Validation — validate tại boundary, không validate thủ công

Mọi DTO nhận request phải có constraint annotation. Controller phải kích hoạt validation bằng `@Valid`.

**DTO / Request:**

```java
public class CreateProductRequest {

    @NotBlank(message = "Tên sản phẩm không được để trống")
    @Size(max = 255, message = "Tên không quá 255 ký tự")
    private String name;

    @NotNull(message = "Giá không được để trống")
    @Positive(message = "Giá phải lớn hơn 0")
    private Long retailPrice;

    @NotNull
    @Min(value = 0, message = "Số lượng không được âm")
    private Integer stockQuantity;

    @Email(message = "Email không hợp lệ")
    private String contactEmail;

    @Valid  // cascade vào nested object
    private AddressRequest shippingAddress;
}
```

**Controller:**

```java
// ✅ Đúng — @Valid kích hoạt Bean Validation
@PostMapping
public ResponseEntity<?> create(@Valid @RequestBody CreateProductRequest request) { ... }

@GetMapping
public ResponseEntity<?> list(@Valid ProductFilterRequest filter) { ... }

// ❌ Sai — thiếu @Valid, constraint không được kích hoạt
@PostMapping
public ResponseEntity<?> create(@RequestBody CreateProductRequest request) { ... }
```

**Constraint annotations hay dùng:**

| Annotation | Dùng cho |
|---|---|
| `@NotNull` | Field không được null |
| `@NotBlank` | String không null, không rỗng, không chỉ khoảng trắng |
| `@NotEmpty` | Collection / String không null và không rỗng |
| `@Size(min, max)` | Độ dài String hoặc kích thước Collection |
| `@Min(n)` / `@Max(n)` | Số nguyên tối thiểu / tối đa |
| `@Positive` / `@PositiveOrZero` | Số dương / không âm |
| `@DecimalMin` / `@DecimalMax` | Số thực có giới hạn |
| `@Email` | Định dạng email |
| `@Pattern(regexp)` | Regex pattern (SĐT, mã sản phẩm, …) |
| `@Past` / `@Future` | Date trong quá khứ / tương lai |
| `@Valid` | Cascade validation vào nested object |

**Custom validator** khi logic nghiệp vụ cụ thể:

```java
@Constraint(validatedBy = VietnamesePhoneValidator.class)
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidVietnamesePhone {
    String message() default "Số điện thoại Việt Nam không hợp lệ";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
```

**Cấm:**
- ❌ Validate thủ công bằng `if (x == null || x.isBlank())` trong controller/service khi Bean Validation đủ xử lý.
- ❌ Bỏ `@Valid` trên `@RequestBody` hoặc `@ModelAttribute` — không có `@Valid` thì constraint không được kích hoạt.
- ❌ Message validation trống hoặc generic tiếng Anh khi có thể viết tiếng Việt rõ nghĩa.
- ❌ Validate lại ở service những gì đã được Bean Validation check ở boundary — không duplicate.
- ❌ Throw exception thủ công thay vì để `MethodArgumentNotValidException` handler xử lý tập trung.

### 7.4 Global exception handler — `@ControllerAdvice` tập trung

Mọi exception từ controller và service đều phải được xử lý bởi **một** global exception handler dùng `@ControllerAdvice`. Không catch/format exception thủ công trong từng controller.

**Vị trí**: package `exception/` hoặc `handler/` (ví dụ `com.bigbike.common.exception.GlobalExceptionHandler`).

```java
@ControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    // Bean Validation failure → 422
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<?> handleValidation(MethodArgumentNotValidException ex) {
        // format theo Section 9.1 error shape, code = "VALIDATION_ERROR"
    }

    // Custom business exception → 4xx
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<?> handleBusiness(BusinessException ex) { ... }

    // Fallback → 500, không expose message/stack trace
    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> handleGeneric(Exception ex) {
        log.error("Unhandled exception", ex);
        // trả message generic, KHÔNG expose ex.getMessage() hay stack trace
    }
}
```

**Cấm:**
- ❌ `try { } catch (Exception e) { return ResponseEntity.status(500).body(e.getMessage()); }` trong controller.
- ❌ Service bắt exception để format HTTP response — service chỉ `throw`.
- ❌ Expose stack trace hoặc raw `ex.getMessage()` trong response body.
- ❌ Nhiều hơn một `@ControllerAdvice` class xử lý cùng exception type mà không có `@Order`.

### 7.5 Backend coding standards

- Validate request DTO bằng Bean Validation (xem 7.3), không thủ công.
- Service layer xử lý business validation (rule không thuộc constraint annotation).
- Enforce permissions server-side cho mọi admin endpoint.
- Trả về standard error shape (xem Section 9.1) qua global exception handler (xem 7.4).
- Avoid leaking internals (stack trace, raw exception message).
- Transaction quanh state change cần atomicity.
- Preserve order snapshots (xem Section 8.3).
- Test cho business transition quan trọng.

---

## 8. Data Contract Rules

### 8.1 Canonical media fields

Dùng canonical: `image.url`, `gallery[]`, `videos[]`.

Avoid reintroducing legacy drift: `imageUrl`, `images`, `videoUrl`. Fallback cho legacy data tạm thời OK, nhưng write mới phải canonical.

### 8.2 Money

Money là integer VND amount. Không float.

```json
// ✅
{ "retailPrice": 1250000, "currency": "VND" }

// ❌
{ "retailPrice": 1250000.50 }
```

### 8.3 Order snapshot

Order phải preserve snapshot: product name, product image, variant/options, unit price, quantity, customer info, shipping address. Không depend chỉ vào live product/customer data để render order cũ.

### 8.4 Unknown enum

Nhận unknown enum: không crash, show neutral fallback, log/report nếu appropriate, không map unknown → success.

---

## 9. API Rules

### 9.1 Standard shape

Single resource:
```json
{ "data": {}, "meta": { "requestId": "req_123", "timestamp": "2026-04-20T03:30:00Z" } }
```

Error:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Validation failed.", "details": [] },
  "meta": { "requestId": "req_123", "timestamp": "2026-04-20T03:30:00Z" } }
```

### 9.2 Method rules

- `GET` reads. Never mutate data with `GET`.
- `POST` creates hoặc execute commands.
- `PATCH` updates partially.
- `DELETE` deletes chỉ khi business allows.

### 9.3 Auth & permission

- `401`: not authenticated.
- `403`: authenticated nhưng not authorized.
- Admin endpoints phải enforce permissions server-side.

### 9.4 State-changing endpoints

Dùng command endpoint khi transition có side effect:

```text
POST /api/v1/admin/orders/{orderId}/status
POST /api/v1/admin/orders/{orderId}/cancel
POST /api/v1/admin/products/{productId}/publish
```

Backend phải validate transition theo state machine (Section 10).

---

## 10. State Machine Rules

State transition phải enforce backend. Không cho phép impossible transition chỉ vì UI button tồn tại.

Ví dụ invalid:
```text
COMPLETED -> PENDING_CONFIRMATION
CANCELLED -> SHIPPING
PENDING_CONFIRMATION -> COMPLETED
```

Frontend hide/disable invalid action, nhưng backend vẫn phải reject invalid transition.

---

## 11. Permission Rules

Admin route/action map đến permission defined:

```text
/admin/products       -> products.read
/admin/products/new   -> products.create
/admin/orders         -> orders.read
/admin/settings       -> settings.read
```

Backend enforce mọi admin endpoint. Frontend:
- Hide inaccessible module.
- Disable forbidden action khi resource visible.
- Show permission denied route state khi cần.

Dangerous action yêu cầu: permission + confirmation + backend validation + audit (nếu supported).

---

## 12. SEO Rules — chỉ áp dụng `bigbike-web`

Không phá SEO. Public page phải có:
- One clear H1, semantic heading hierarchy.
- Crawlable text, metadata, stable URL, internal link.
- Image alt text, optimized image.
- Không heavy hero/video làm chậm performance.
- Category/PDP content không được hidden trong image only.

Đổi slug/URL behavior: check redirect strategy, update internal link, avoid breaking indexed URL.

---

## 13. Cart / Checkout Rules

Khi đụng cart/checkout:
- Không trust frontend price hoặc stock.
- Không cho phép duplicate submit.
- Preserve form data on error.
- Show price/stock changed notice.
- Show clear next step sau order success.
- COD / manual confirmation phải rõ ràng nếu dùng.
- Backend phải validate final order.

---

## 14. File and Asset Rules

### 14.1 Brand assets

Live trong `public/brand` hoặc shared asset package theo project structure. Không rename asset random mà không update reference.

### 14.2 Uploaded media

Validate: file type, file size, public URL, alt text (nếu public image), fallback nếu image fail.

---

## 15. Repository Boundaries

### 15.1 `bigbike-web`

**Purpose:** Public website, SEO, product discovery/detail, cart/checkout, content/blog/policy, trust & conversion.

**Rules:** Mobile-first. SEO-friendly. Product-first. Fast loading. Clear CTA. Crawlable content. Stable URLs. Internal links. Optimized images. UI stack theo Section 6.

Không biến public web thành dashboard. Customer muốn mua đồ và rời đi với phẩm giá, không phải "manage entity rows".

### 15.2 `bigbike-admin`

**Purpose:** Internal operations — product / order / customer / support / content / campaign / settings management.

**Rules:** Data-first. Dense nhưng readable. Tables / forms / filters phải mạnh. Destructive action cần confirmation. Permission phải respect. Dùng admin token (Section 6.2), không web campaign styling. Không hero/campaign visuals trong operational screen trừ khi module preview cụ thể yêu cầu. UI stack theo Section 6.

Không biến admin thành biker poster gallery.

### 15.3 `bigbike-backend`

**Purpose:** Business enforcement, API, data persistence, auth/permission, status transition, validation, integration boundary.

**Rules:** Validate mọi incoming data. Enforce permission. Never trust frontend total. Never expose secret. Align response với contract. Consistent error shape. Reject invalid state transition. Preserve order snapshot. Stack theo Section 7.

### 15.4 `bigbike_mobile`

**Purpose:** Flutter mobile companion app (production scope `NEEDS_VERIFICATION` — xem [docs/business/PROJECT_OVERVIEW.md](docs/business/PROJECT_OVERVIEW.md)).

**Rules:** Gọi đúng API theo `API_CONTRACT.md`. Không trust client-side total hay permission. Handle network failure gracefully. Dùng docs mapping Section 3.6 trước khi sửa. Section 6 (React stack) và Section 7 (Spring Boot stack) không áp dụng — Docs-First Contract (Section 2) và Section 5 áp dụng bình thường.

---

## 16. Testing and Verification

Chạy check available trước khi finalize.

**Frontend:**
```bash
npm run lint
npm run test
npm run build
```

**Backend:**
```bash
./mvnw test
./mvnw package
```

Command khác? Inspect `package.json`, `pom.xml`, project scripts, hoặc CI config.

**Không claim test passed nếu chưa chạy.** Revolutionary honesty, apparently.

### 16.1 Web smoke checks

Homepage / category / PDP load, search works (nếu implemented), cart flow, checkout submit handle validation, mobile layout không vỡ, SEO title/H1 không thiếu.

### 16.2 Admin smoke checks

Login/session, dashboard load, product list load, product create/edit validation, order list/detail load, permission denied behavior, destructive confirmation, table empty/error/loading state.

### 16.3 Backend smoke checks

App start, endpoint match contract, validation error dùng standard shape, permission enforce, state transition validate, không leak secret.

---

## 17. Change Summary & PR Guidance

Khi code change ảnh hưởng business behavior, API shape, data model, state transition, permission, hoặc SEO behavior — document rõ trong PR summary.

**Commit/PR phải tóm tắt:**
- What changed.
- Why it changed.
- Which app affected.
- Test/check đã chạy.
- Risk hoặc follow-up work.

**Example:**

```text
Summary:
- Added product publish validation in backend.
- Updated admin publish button disabled state.

Checks:
- npm run lint
- ./mvnw test

Notes:
- No database migration required.
```

**Final response format khi xong task:**

```text
Summary:
- ...

Files changed:
- ...

Checks:
- ...   (hoặc "Not run: <reason>")

Notes:
- ...
```

Không claim imaginary test result. CI gods are petty, they keep receipts.

---

## 18. Forbidden Without Explicit Request / Safe Defaults

### Forbidden — không làm trừ khi user explicit yêu cầu

- Rewrite whole app architecture.
- Replace framework / library.
- Rename major route.
- Change API versioning.
- Change database schema.
- Add auth / payment provider.
- Change brand color.
- Change business status / permission model.
- Hard-delete existing business data.
- Remove SEO route.
- Remove fallback support cho existing data.

### Safe defaults — khi uncertain

- Preserve existing behavior.
- Prefer additive change.
- Add fallback.
- Keep old route working.
- Keep old data readable.
- Mark unclear business rule là `TBD`.
- Ask clarification trong final response nếu cần.
- Do not invent.

---

## Final Rule

An AI agent must leave the repository **more consistent** than it found it.

Nếu thay đổi làm frontend, backend, và contracts bất đồng với nhau, thay đổi đó **chưa xong** — nó chỉ là bug đang khoác áo pull request.
