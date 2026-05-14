# AGENTS.md

> Operating instructions for AI coding agents working on the BigBike monorepo.
>
> This file is the first document an AI agent should read before modifying code, configs, or tests.
>
> Repository scope:
> - `bigbike-web`: public website / SEO commerce website for end customers (Next.js)
> - `bigbike-admin`: internal admin dashboard (Vite + React)
> - `bigbike-backend`: Spring Boot backend (Java 17)
> - `bigbike_mobile`: Flutter mobile companion app (production scope: `NEEDS_VERIFICATION` — see [docs/business/PROJECT_OVERVIEW.md](docs/business/PROJECT_OVERVIEW.md))
> - `docs/`: business + engineering documentation (source of truth — see Docs-First Contract below)

---

## 1. Purpose

`AGENTS.md` defines how AI agents must work in this repository.

It exists to prevent the usual charming disaster where an agent fixes a button, invents three order statuses, hardcodes brand colors, rewrites API payloads, and calls it "minor refactor". No. Behave.

This file tells agents:

- Which resources to read before making changes.
- How to respect project boundaries.
- How to handle business rules, API contracts, data contracts, design rules and tokens.
- How to avoid breaking SEO, admin workflows and backend contracts.
- How to report changes clearly.
- What must never be invented without documentation.

---

## 2. Project Overview

BigBike is a retail / D2C commerce project for motorcycle riders and biker gear.

The project includes:

```text
bigbike/
├── AGENTS.md                       # This file — AI agent operating instructions
├── CLAUDE.md                       # Claude Code auto-loaded summary; mirrors Docs-First Contract
├── docker-compose.yaml             # Full stack infrastructure
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

Primary product domain:

- Motorcycle helmets.
- Riding jackets / pants.
- Gloves.
- Riding shoes.
- Protection gear.
- Bags / bike luggage.
- Helmet intercom / Bluetooth accessories.
- Other biker accessories.

Brand direction:

- Bold.
- Fast.
- Sporty.
- Mechanical.
- Biker-focused.
- Red / black identity.
- Commercially clear.
- Not cute.
- Not generic SaaS.
- Not random starter-template UI.

---

## Phong cách trả lời

- **Ngôn ngữ business, không dùng thuật ngữ kỹ thuật.** Giải thích bằng ngôn ngữ mà chủ shop / quản lý có thể hiểu ngay — không dùng tên class, method, endpoint, stack trace hay jargon lập trình trừ khi user là developer và đang hỏi về code cụ thể.
- **Ngắn gọn nhưng đủ ý.** Không viết dài dòng, không lặp lại điều đã nói. Mỗi câu phải có thông tin.
- **Trình bày dễ đọc.** Dùng danh sách, bảng, hoặc tiêu đề ngắn khi có nhiều điểm cần liệt kê. Không đổ thành đoạn văn dài.
- **Trả lời đúng trọng tâm câu hỏi.** Không giải thích những thứ user không hỏi.

---

## ⚠️ Docs-First Contract — READ THIS BEFORE ANY CODE CHANGE

> Tài liệu trong [docs/business/](docs/business/) và [docs/engineering/](docs/engineering/) là **source of truth** của BigBike. Code được dựng lên từ những docs này, không phải ngược lại.

### Bắt buộc

1. **Đọc docs liên quan trước khi sửa code.** Trước khi đụng vào bất kỳ file source nào trong [bigbike-backend/](bigbike-backend/), [bigbike-web/](bigbike-web/), [bigbike-admin/](bigbike-admin/) hoặc [bigbike_mobile/](bigbike_mobile/), agent phải đọc trước các docs liên quan trong [docs/](docs/) và xác định doc nào đang quy định behavior bạn sắp sửa. Xem mapping ở dưới.
2. **Cite evidence khi mô tả thay đổi.** Trong PR summary / final response, phải cite path docs cụ thể (ví dụ `docs/business/BUSINESS_RULES.md` rule `ORDER_RULE_003`, hoặc `docs/engineering/API_CONTRACT.md` Section 8.3) làm căn cứ cho thay đổi.
3. **Không bịa rule.** Nếu rule / contract / permission / state cần thiết không có trong docs hoặc đang `NEEDS_VERIFICATION` / `NOT_FOUND_IN_REPO` / `CONFLICTING_EVIDENCE`, **dừng và hỏi user** thay vì tự suy diễn rồi viết code.
4. **Docs đi trước code khi có lệch.** Nếu thay đổi ảnh hưởng business rule, API contract, data shape, permission, state machine, workflow hoặc deployment env:
   - **Update docs trước** (file business / engineering tương ứng).
   - **Rồi mới sửa code** để khớp docs.
   - Cùng một PR phải có cả docs change và code change; không tách rời để "fix docs sau".
5. **Bug fix vẫn phải cite docs.** Bug = code đang lệch docs. Trong PR ghi rõ docs/spec nào bị code làm sai, sau đó fix code về đúng docs. Nếu docs cũng sai, xem điều 4.
6. **Audit/report là context, canonical docs vẫn thắng.** Nếu repo có report verification/audit trong `docs/` hoặc `docs/audits/`, dùng nó để đọc mismatch/risk context. Nếu report không có trong repo hiện tại hoặc đã được đánh dấu historical/stale thì ưu tiên current code + canonical docs đã được cập nhật.

### Mapping docs ↔ scope

| Bạn đang sửa | Phải đọc trước |
|---|---|
| Backend controller / service / entity / migration | [docs/engineering/API_CONTRACT.md](docs/engineering/API_CONTRACT.md), [DATA_CONTRACT.md](docs/engineering/DATA_CONTRACT.md), [PERMISSION_MATRIX.md](docs/engineering/PERMISSION_MATRIX.md), [STATE_MACHINES.md](docs/business/STATE_MACHINES.md), [BUSINESS_RULES.md](docs/business/BUSINESS_RULES.md) (mục liên quan) |
| Frontend route / component / API call | [API_CONTRACT.md](docs/engineering/API_CONTRACT.md), [API_FLOW_MAP.md](docs/engineering/API_FLOW_MAP.md), [WORKFLOW_OVERVIEW.md](docs/business/WORKFLOW_OVERVIEW.md), [MODULE_CATALOG.md](docs/business/MODULE_CATALOG.md); nếu `bigbike-web` → **thêm** [bigbike-web/STYLEGUIDE.md](bigbike-web/STYLEGUIDE.md) + [bigbike-web/styles/brand-tokens.css](bigbike-web/styles/brand-tokens.css); nếu `bigbike-admin` → **thêm** [bigbike-admin/src/styles/admin-tokens.css](bigbike-admin/src/styles/admin-tokens.css) và xem Section 5.12 |
| Permission / role / auth | [PERMISSION_MATRIX.md](docs/engineering/PERMISSION_MATRIX.md), [USER_ROLES.md](docs/business/USER_ROLES.md) |
| Order / payment / refund / inventory / return logic | [BUSINESS_RULES.md](docs/business/BUSINESS_RULES.md), [STATE_MACHINES.md](docs/business/STATE_MACHINES.md), [WORKFLOW_OVERVIEW.md](docs/business/WORKFLOW_OVERVIEW.md), [API_FLOW_MAP.md](docs/engineering/API_FLOW_MAP.md) |
| Deployment / Dockerfile / env / CI | [DEPLOYMENT_GUIDE.md](docs/engineering/DEPLOYMENT_GUIDE.md), [INTEGRATION_GUIDE.md](docs/engineering/INTEGRATION_GUIDE.md) |
| Test / quality gate | [TESTING_GUIDE.md](docs/engineering/TESTING_GUIDE.md), [ACCEPTANCE_CRITERIA.md](docs/business/ACCEPTANCE_CRITERIA.md) |
| Architecture / module ownership | [ARCHITECTURE.md](docs/engineering/ARCHITECTURE.md), [MODULE_CATALOG.md](docs/business/MODULE_CATALOG.md), [PROJECT_OVERVIEW.md](docs/business/PROJECT_OVERVIEW.md) |
| Cross-trace requirement → API → test | [TRACEABILITY_MATRIX.md](docs/engineering/TRACEABILITY_MATRIX.md) |

### Cấm

- ❌ Sửa code mà không đọc docs liên quan.
- ❌ Đẩy code mà docs không phản ánh thay đổi (trừ refactor nội tại không ảnh hưởng API / contract / data / permission / state / deployment).
- ❌ Tự suy diễn rule khi docs ghi `NEEDS_VERIFICATION` / `NOT_FOUND_IN_REPO` / `CONFLICTING_EVIDENCE`.
- ❌ "Code-first, doc-fix-later" trừ khi user explicitly cho phép.
- ❌ Tự "fix" cái đã được report/audit trong `docs/` hoặc `docs/audits/` flag là code bug — đó là task riêng có ngữ cảnh riêng.

---

## 3. Required Reading Order

Before modifying anything, read the relevant resources.

### 3.1 Always read first

```text
AGENTS.md
docs/business/PROJECT_OVERVIEW.md        # Business + system overview; actor map
docs/engineering/ARCHITECTURE.md         # Tech stack / layers / runtime / boundaries
docs/audits/                             # Historical audit context, if relevant; canonical docs still win
```

### 3.2 For `bigbike-web` changes

```text
docs/engineering/API_CONTRACT.md         # ⚡ Backend endpoint contract bạn đang gọi
docs/engineering/API_FLOW_MAP.md         # ⚡ Flow screen → API end-to-end
docs/engineering/DATA_CONTRACT.md        # ⚡ Public field shape, drift, legacy fallback
docs/business/WORKFLOW_OVERVIEW.md       # ⚡ End-to-end customer workflow
docs/business/MODULE_CATALOG.md          # ⚡ Module/feature ownership
bigbike-web/AGENTS.md                    # Next.js version-specific agent rules — read before any code change
bigbike-web/STYLEGUIDE.md                # Condensed brand + UI rules for bigbike-web
bigbike-web/styles/brand-tokens.css      # Web CSS token source of truth
bigbike-web/public/brand/                # Brand assets used by public website
docs/audits/                             # Historical web/design audits, if relevant; not canonical
```

Use these for:

- Homepage.
- Category/listing.
- Product detail page.
- Search.
- Cart.
- Checkout.
- SEO content.
- Public pages.
- Responsive/mobile behavior.

### 3.3 For `bigbike-admin` changes

```text
docs/engineering/API_CONTRACT.md                                                     # ⚡ Admin endpoint contract
docs/engineering/PERMISSION_MATRIX.md                                                # ⚡ Role/permission per route + endpoint
docs/engineering/DATA_CONTRACT.md                                                    # ⚡ Admin field shape + normalizer drift
docs/business/USER_ROLES.md                                                          # ⚡ Role definitions
docs/business/MODULE_CATALOG.md                                                      # ⚡ Admin module catalog
docs/business/STATE_MACHINES.md                                                      # ⚡ Allowed transitions (orders/returns/products)
bigbike-admin/src/styles/admin-tokens.css                                            # ⚡ Admin design token source of truth — xem Section 5.12 cho full rules
bigbike-admin/public/brand/                                                          # Admin brand assets
bigbike-backend/src/main/resources/openapi/bigbike-openapi.json                      # Raw OpenAPI (machine-readable companion)
bigbike-backend/docs/PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md                # Historical phase report
```

Use these for:

- Dashboard.
- Product management.
- Order management.
- Content management.
- Support/contact.
- Settings.
- CRUD screens.
- Admin tables/forms.
- Role/permission behavior.

### 3.4 For backend changes

```text
docs/engineering/API_CONTRACT.md                                                     # ⚡ Endpoint contract per controller
docs/engineering/DATA_CONTRACT.md                                                    # ⚡ Entity/DTO/enum shape + drift
docs/engineering/PERMISSION_MATRIX.md                                                # ⚡ ROLE_ADMIN/CUSTOMER + permission strings
docs/engineering/INTEGRATION_GUIDE.md                                                # ⚡ Postgres/MinIO/Mail/WS/migration integration
docs/business/BUSINESS_RULES.md                                                      # ⚡ Backend-enforced rules (price/stock/transition)
docs/business/STATE_MACHINES.md                                                      # ⚡ Allowed state transitions
docs/business/WORKFLOW_OVERVIEW.md                                                   # ⚡ End-to-end workflow context
bigbike-backend/docs/PHASE_1D_CUSTOMER_AUTH_REPORT.md                                # Historical phase report (auth)
bigbike-backend/docs/PHASE_1F_CHECKOUT_API_REPORT.md                                 # Historical phase report (checkout)
bigbike-backend/docs/PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md                # Historical phase report (settings/menu/coupon)
bigbike-backend/src/main/resources/openapi/bigbike-openapi.json                      # Raw OpenAPI (machine-readable companion)
```

Use these for:

- API endpoints.
- Request/response shapes.
- Validation.
- Order/payment/product state transitions.
- Permissions.
- Business enforcement.
- Data model alignment.

### 3.5 For legacy migration changes

Before implementing product, order, content, auth, customer, media, category, brand, search, cart, checkout, or public route behavior derived from the legacy WordPress site, inspect:

```text
bigbike_vn__2026_04_17/             # Local-only legacy WordPress export
bigbike_vn__2026_04_17/sqldump.sql  # Schema-only reference
```

Do not commit or copy raw WordPress source, raw SQL dump data, `wp-config.php` secret values, user data, order data, customer email, phone, address, password hash, session, token, API key, webhook secret, or order key values.

---

## 4. Source of Truth Map

| Concern | Source of truth |
|---|---|
| **Business overview / actors / modules / workflows / rules / states** | [docs/business/](docs/business/) — `PROJECT_OVERVIEW.md`, `MODULE_CATALOG.md`, `USER_ROLES.md`, `BUSINESS_PROCESS.md`, `BUSINESS_RULES.md`, `WORKFLOW_OVERVIEW.md`, `STATE_MACHINES.md`, `ACCEPTANCE_CRITERIA.md`, `GLOSSARY.md` |
| **Technical architecture / API contract / data contract / permission / deployment** | [docs/engineering/](docs/engineering/) — `ARCHITECTURE.md`, `API_CONTRACT.md`, `DATA_CONTRACT.md`, `API_FLOW_MAP.md`, `PERMISSION_MATRIX.md`, `TESTING_GUIDE.md`, `DEPLOYMENT_GUIDE.md`, `INTEGRATION_GUIDE.md`, `TRACEABILITY_MATRIX.md` |
| **Docs governance / role separation** | This `AGENTS.md` + canonical docs under `docs/business/` and `docs/engineering/` |
| **Latest docs↔code audit / known mismatches** | `docs/audits/` if relevant reports exist; historical reports are not canonical |
| Brand identity, logo, colors, typography, copy | `bigbike-web/STYLEGUIDE.md`, `bigbike-web/styles/brand-tokens.css`, `bigbike-admin/src/styles/admin-tokens.css` |
| Brand assets (logos, icons, fonts, favicons) | `bigbike-web/public/brand/` + `bigbike-admin/public/brand/` |
| Web UI design reference | `bigbike-web/STYLEGUIDE.md` + `bigbike-web/components/` |
| Visual design audit context | `docs/audits/` if relevant reports exist; canonical style/token files still win |
| bigbike-web UI rules (condensed) | `bigbike-web/STYLEGUIDE.md` |
| Backend OpenAPI raw schema (machine-readable companion to `docs/engineering/API_CONTRACT.md`) | `bigbike-backend/src/main/resources/openapi/bigbike-openapi.json` |
| Backend phase implementation reports (historical) | `bigbike-backend/docs/` |
| Architecture / product decisions (what was rejected and why) | Canonical business/engineering docs; if not documented, ask user instead of inventing |
| SEO redirect map | `bigbike-web/docs/` |
| Legacy WordPress data and migration reference | `bigbike_vn__2026_04_17/` (local-only) |

Quy tắc:

- Khi docs nghiệp vụ trong `docs/business/` và docs kỹ thuật trong `docs/engineering/` mâu thuẫn nhau → **business docs thắng**, engineering docs cần được sửa lại để khớp.
- Khi `docs/engineering/*` và code mâu thuẫn nhau → xem report/audit liên quan trong `docs/` hoặc `docs/audits/` nếu có; nếu chưa có verdict, mặc định docs là source of truth và code cần sửa, trừ khi user nói khác.
- Không di chuyển trách nhiệm giữa các file trừ khi được yêu cầu rõ.

---

## 5. Global Agent Rules

### 5.1 Do not invent business rules

Do not invent:

- Order statuses.
- Payment statuses.
- Product stock states.
- Warranty rules.
- Return/exchange rules.
- Promotion logic.
- Shipping fee rules.
- Permission rules.
- API fields.
- Database columns.

If a rule is missing, mark it as `TBD` or explain the gap. Do not fill the gap with confident nonsense, the official language of many broken systems.

### 5.2 Backend enforces business logic

Frontend may validate for UX, but backend must enforce:

- Price.
- Quantity.
- Stock.
- Product availability.
- Order status transition.
- Payment status.
- Permissions.
- Checkout validity.
- Admin actions.

### 5.3 Respect contracts

If changing API response or data model, document the change clearly in the PR summary.

If changing status transitions, ensure backend rejects invalid transitions.

If changing admin permission behavior, ensure backend enforces it server-side.

If changing behavior or business rule, mark any unclear gaps as `TBD`.

If changing route, slug, permalink, trailing slash, or blog `.html` behavior, ensure internal links are updated and redirects are handled.

### 5.4 No hardcoded design drift

Do not hardcode brand colors, spacing, radius, typography or shadows if token docs already define them.

Bad:

```tsx
className="bg-[#F90606] px-[17px] rounded-[11px]"
```

Better — use CSS variables from the app token file (`bigbike-web/styles/brand-tokens.css` or `bigbike-admin/src/styles/admin-tokens.css`):

```tsx
className="bg-[var(--bb-brand-primary)] px-[var(--bb-space-4)] rounded-[var(--bb-radius-sm)]"
```

Exact syntax depends on the project stack, but the principle is not optional.

### 5.5 No random UI style

Do not introduce:

- New gradient style without brand reason.
- Random font.
- Random icon set.
- Random animation style.
- Vite/Next starter visuals.
- Cute/pastel UI.
- Generic SaaS dashboard look.

BigBike has a brand. Use it.

### 5.6 No raw null rendering

Never render raw:

```text
null
undefined
NaN
[object Object]
```

Use designed fallback states.

### 5.7 All screens need states

Every screen/component must handle:

- Loading.
- Empty.
- Error.
- Success.
- Disabled.
- Permission denied when relevant.
- Updating/submitting.
- Partial data if relevant.
- Unknown status fallback.
- Network failure where relevant.

### 5.8 Legacy migration guardrails

Do not implement product, order, content, auth, customer, media, category, brand, search, cart, checkout, or public route behavior from memory. Inspect `bigbike_vn__2026_04_17/` first.

Never commit raw `bigbike_vn__2026_04_17/` source, `sqldump.sql`, `wp-config.php` values, user/order/customer PII, password hashes, sessions, tokens, API keys, webhook secrets, or raw redirect exports.

Do not build new features ahead of legacy discovery for the affected domain.

### 5.9 Frontend UI stack — React + Tailwind CSS + Radix UI + shadcn/ui

Khi code bất kỳ UI component hoặc layout nào trong `bigbike-web` hoặc `bigbike-admin`:

- **shadcn/ui** là component library chính — dùng `components/ui/` (Button, Input, Select, Dialog, Checkbox, Tabs, …) làm building block trước khi tự build.
- **Tailwind CSS** cho styling — viết utility classes **trực tiếp vào JSX** (`className="..."`) thay vì tạo class name mới trong `globals.css`.
- **Radix UI** cho interactive primitives (Select, Dialog, Dropdown, Tooltip, Checkbox, Radio…) — không dùng native HTML `<select>`, `<dialog>`, `<details>` nếu shadcn wrapper đã tồn tại trong `components/ui/`.
- Variants và override: dùng `cn()` + `cva()` / `buttonVariants()` — không bypass bằng cách xóa component để thay raw HTML element.
- Tham chiếu `@theme inline` trong `globals.css` để biết Tailwind color tokens có sẵn (`text-primary`, `bg-brand`, `border-border`, …).

**Quy tắc globals.css:**

`globals.css` chỉ được chứa:
1. CSS custom properties / design tokens (`@theme inline { ... }`)
2. Base / reset styles (`body`, `*`, `html`)
3. shadcn/ui component overrides (khi cần thiết)
4. Những rule CSS mà Tailwind **thật sự không thể làm được** — ví dụ: complex `@keyframes`, multi-step pseudo-selector nesting, feature queries (`@supports`), hoặc third-party widget overrides.

Không được thêm class mới vào `globals.css` chỉ vì muốn đặt tên ngắn — đó là lý do của Tailwind utility classes và `cn()`.

**Tái sử dụng component dùng chung — bắt buộc:**

Trước khi tạo component mới, **phải kiểm tra** các component dùng chung đã có:

| Thư mục | Nội dung |
|---|---|
| `bigbike-web/components/ui/` | Primitive shadcn (Button, Input, Select, Dialog, Checkbox, Tabs, …) + custom helpers (EmptyState, LoadingGrid, PriceText, MediaImage, RatingStars, PaginationNav, ErrorState, Skeletons, VnAddressFields, BBTooltip) |
| `bigbike-web/components/layout/` | SiteHeader, SiteFooter, PageHero, AccountShell, PolicySidebar, StickyHeaderShell, … |
| `bigbike-web/components/catalog/` | ProductCard, ProductGallery, VariantSelector, AddToCartButton, CatalogFilters, ReviewsSection, … |
| `bigbike-admin/src/components/` | AdminTable, AdminShell, ConfirmDialog, StatusBadge, PaginationControls, FilterChips, BulkActionBar, RichTextEditor, StatePanel, DetailSection, DateRangePicker, ExportButton, ReadOnlyBanner, TagInput, MediaPickerModal, VideoPickerModal, ImageUrlInput, MediaCard, MediaCardSkeleton, MediaPreviewLightbox, MediaListRow, MediaDetailModal, MediaDetailPanel, MediaFolderSidebar, NotificationBell, OrderNotificationToast, ErrorBoundary |
| `bigbike-admin/src/components/layout/` | Screen, ScreenHeader, FilterBar, SummaryCard, Tabs, Modal, StickyActionBar, MobileCardList, FormField (import từ `index.js`) |

❌ **Cấm code lại component đã có** — nếu `EmptyState`, `PaginationNav`, `MediaImage`, `ConfirmDialog`, `AdminTable`, … đã tồn tại, dùng luôn, không tạo phiên bản mới.

Cấm:

- ❌ Viết class mới vào `globals.css` (hoặc bất kỳ file `.css` nào) khi Tailwind utility là đủ — phải viết trực tiếp vào `className` trong JSX.
- ❌ Dùng native `<select>`, `<input type="checkbox">`, `<dialog>`, `<button>` khi shadcn `Select`, `Checkbox`, `Dialog`, `Button` đã có sẵn trong `components/ui/`.
- ❌ Xóa hoặc bypass shadcn component (Button, Select, …) để thay bằng raw HTML với class legacy.
- ❌ Tạo component UI từ đầu khi Radix UI / shadcn đã có primitive phù hợp.
- ❌ Hardcode màu hex, spacing px, font string trực tiếp — dùng token từ `bigbike-web/styles/brand-tokens.css`, `bigbike-admin/src/styles/admin-tokens.css`, hoặc Tailwind token tương ứng.
- ❌ Tạo component mới khi component tương đương đã tồn tại trong `components/ui/`, `components/layout/`, hoặc `components/catalog/`.

### 5.10 Docker server access khi fix bug / vận hành hệ thống

Khi cần fix lỗi hệ thống, debug runtime issue, kiểm tra log, query database thật, verify migration, hoặc làm bất kỳ task vận hành nào cần dữ liệu/trạng thái runtime:

- **Được phép vào trực tiếp container Docker đang chạy** (backend, db, redis, web, admin…) qua `docker ps`, `docker logs`, `docker exec`, `docker compose exec`, mysql/psql client trong container, … để chẩn đoán và sửa lỗi.
- Trước khi dùng, **chạy `docker ps` (hoặc `docker compose ps`) để xác nhận stack đang chạy**.
- Nếu container cần dùng **chưa chạy hoặc đang stopped/exited** → **DỪNG lại và yêu cầu user khởi động** (`docker compose up -d <service>`). Không tự ý `up`, `start`, `restart`, `down`, `rm`, `prune` khi user chưa cho phép — đó là shared state và có thể ảnh hưởng dữ liệu/process khác.
- Trong container, mặc định chỉ làm **thao tác đọc** (logs, `SELECT`, `SHOW`, `EXPLAIN`, `cat`, `ls`, …). Thao tác ghi/destructive (`UPDATE`, `DELETE`, `DROP`, `TRUNCATE`, sửa file config trong container, `kill`, restart service…) phải hỏi user trước.
- Khi report kết quả cho user, cite rõ container/service và command đã chạy (ví dụ "chạy `docker compose exec backend ...` thấy log X") để user verify được.

Cấm:

- ❌ Giả định container đang chạy mà không check `docker ps` trước.
- ❌ Tự ý `docker compose up/down/restart/rm`, xoá volume, xoá network, prune image — luôn hỏi user.
- ❌ Chạy `UPDATE`/`DELETE`/`DROP`/`TRUNCATE` hoặc sửa file bên trong container đang chạy mà không có lệnh rõ ràng từ user.
- ❌ Mock/giả lập dữ liệu trong khi container thật đang chạy và có thể query được — luôn ưu tiên data thật để chẩn đoán đúng root cause.

### 5.11 Design System Unity — toàn bộ bigbike-web phải thiết kế nhất quán

Mọi trang, route, component trong `bigbike-web` phải có visual appearance bắt nguồn từ **cùng một design system duy nhất**. Không có ngoại lệ theo trang, feature, hoặc developer/agent.

**Token cascade bắt buộc:**

```
bigbike-web/STYLEGUIDE.md            ← brand rules: palette, typography, component rules (source of truth cho web)
  ↓ mapped into
bigbike-web/styles/brand-tokens.css  ← CSS custom properties
  ↓ exposed via
bigbike-web/app/globals.css          ← @theme inline { ... } → Tailwind design tokens
  ↓ used as
Tailwind utility classes in JSX      ← text-primary, bg-brand, border-border, ...
```

**Color rules:**
- Chỉ dùng màu trong palette `STYLEGUIDE.md` — `#FF0C09` brand red, `#007BFF` blue, `#00BFFF` chat cyan, và các neutral token.
- Tham chiếu qua CSS variable hoặc Tailwind token — không hardcode hex trong JSX.
- Không dùng Tailwind built-in color (`bg-red-500`, `text-blue-600`) khi brand token đã tương ứng.

**Typography rules:**
- Fonts được duyệt cho `bigbike-web`: `Barlow` (body/UI/content), `Oswald` (heading/CTA/badge), `Barlow Condensed` (display/hero).
- Không import font ngoài danh sách trên.
- Scale: dùng Tailwind text scale (`text-xs` → `text-5xl`) hoặc size explicit từ `STYLEGUIDE.md` — không dùng arbitrary `text-[13px]`.
- Heading, nav, CTA, badge → uppercase. Body text → sentence case. Không dùng letter-spacing âm.

**Spacing và sizing rules:**
- Spacing thang 4px — dùng Tailwind step (`p-4` = 16px, `gap-6` = 24px, `mt-8` = 32px…).
- Không dùng arbitrary px (`mt-[17px]`) trừ khi không có Tailwind step nào phù hợp.
- Container max-width: `1200px`. Section spacing: desktop `72px`, tablet `52px`, mobile `32px`.
- Touch target tối thiểu `44px`.

**Border radius rules:**
- Mặc định `rounded-none` (`0px`) cho mọi component thông thường.
- Chỉ dùng `rounded-full` cho phần tử thực sự tròn (avatar, badge dot, chat button).
- Không tự ý thêm `rounded-md`, `rounded-lg`, hay arbitrary radius nếu `STYLEGUIDE.md` không định nghĩa.

**Visual consistency check:**
- Trước khi ship component mới, phải so sánh visually với component đã có: màu, font, spacing, radius có cùng hệ thống không?
- Nếu component mới trông khác biệt so với phần còn lại của site → phải align lại, không phải "trang đó đúng theo chuẩn riêng".
- Generic shadcn default look, Tailwind UI template look, hoặc SaaS dashboard look đều sai — mọi thứ phải trông như BigBike.

Cấm:

- ❌ Arbitrary Tailwind value (`bg-[#abc]`, `text-[13px]`, `p-[17px]`) khi token tương đương đã tồn tại.
- ❌ Tailwind built-in color (`bg-red-500`, `text-blue-600`) thay vì brand token.
- ❌ Import font hoặc `@font-face` ngoài Barlow / Oswald / Barlow Condensed.
- ❌ CSS module, `<style>` scoped per-page, hoặc class trong file `.css` riêng khi Tailwind là đủ.
- ❌ Mỗi trang / agent tự quyết định color scheme / visual style riêng — mọi quyết định visual phải traceable về `bigbike-web/STYLEGUIDE.md`.
- ❌ Giới thiệu component "trông đúng" theo tiêu chuẩn khác (generic SaaS, starter template) mà không align với BigBike brand.

### 5.12 Design System Unity — toàn bộ bigbike-admin phải thiết kế nhất quán

Mọi screen, route, component trong `bigbike-admin` phải có visual appearance bắt nguồn từ **cùng một design system của BigBike**. Không màn hình nào, không component nào được tự chọn màu, font, spacing, hay border-radius riêng ngoài hệ thống đã định nghĩa.

**Token cascade bắt buộc:**

```
bigbike-admin/src/styles/admin-tokens.css   ← admin palette + type scale (source of truth)
  ↓ imported via
bigbike-admin/src/index.css                  ← admin CSS entry point
  ↓ exposed via
Tailwind utility classes / CSS variables     ← text-primary, bg-brand, var(--admin-...), ...
```

**Color rules:**
- Chỉ dùng màu trong BigBike admin palette (red/black identity) từ `bigbike-admin/src/styles/admin-tokens.css`.
- Tham chiếu qua CSS variable hoặc Tailwind token — không hardcode hex trong JSX.
- Không dùng Tailwind built-in color (`bg-red-500`, `text-blue-600`) khi brand token đã tương ứng.

**Typography rules:**
- Fonts được duyệt cho `bigbike-admin`: `Bungee` (display/headline, uppercase only), `Exo` (body/UI/content, 9 weights available).
- Không import font ngoài danh sách trên. Không dùng Barlow / Oswald / Barlow Condensed trong `bigbike-admin`.
- Scale: dùng Tailwind text scale — không dùng arbitrary `text-[13px]`.

**Spacing và sizing rules:**
- Spacing thang 4px — dùng Tailwind step (`p-4`, `gap-6`, `mt-8`…).
- Không dùng arbitrary px (`mt-[17px]`) trừ khi không có Tailwind step nào phù hợp.
- Touch target tối thiểu `44px`.

**Border radius rules:**
- Mặc định `rounded-none` (`0px`) cho mọi component thông thường.
- Chỉ dùng `rounded-full` cho phần tử thực sự tròn (avatar, badge dot).
- Không tự ý thêm `rounded-md`, `rounded-lg` khi design system không định nghĩa.

**Visual style rules:**
- `bigbike-admin` là operational/data-first: dense, readable, table/form/filter centric.
- Không đưa hero visuals, campaign banner, customer-facing animations vào operational screens — trừ khi module preview cụ thể yêu cầu.
- Mọi screen phải trông như BigBike admin — không phải generic SaaS dashboard, không phải starter template.

**Visual consistency check:**
- Trước khi ship screen mới, phải so sánh visually với screen đã có: màu, font, spacing, radius có cùng hệ thống không?
- Nếu screen mới trông khác biệt so với phần còn lại của admin → phải align lại, không phải "screen đó đúng theo chuẩn riêng".

Cấm:

- ❌ Arbitrary Tailwind value (`bg-[#abc]`, `text-[13px]`, `p-[17px]`) khi token tương đương đã tồn tại.
- ❌ Tailwind built-in color (`bg-red-500`, `text-blue-600`) thay vì brand token.
- ❌ Import font hoặc `@font-face` ngoài Bungee / Exo.
- ❌ CSS module, `<style>` scoped per-screen, hoặc class trong file `.css` riêng khi Tailwind là đủ.
- ❌ Mỗi màn hình / agent tự quyết định color scheme / visual style riêng — mọi quyết định visual phải traceable về `bigbike-admin/src/styles/admin-tokens.css`.
- ❌ Dùng font/token của `bigbike-web` (Barlow / Oswald / Barlow Condensed) trong `bigbike-admin` — hai app có font system riêng.
- ❌ Generic SaaS dashboard look, starter template look — mọi thứ phải trông như BigBike admin.

### 5.13 Inline Tailwind — không tạo class CSS mới khi Tailwind là đủ

Mọi styling trong `bigbike-web` và `bigbike-admin` phải được viết **trực tiếp vào `className` trong JSX** bằng Tailwind utility classes. Không tạo class CSS mới trong bất kỳ file `.css` nào chỉ để dùng lại trong component.

**Sai — tạo class CSS rồi dùng trong JSX:**

```css
/* styles.css hoặc globals.css */
.product-row {
  display: flex;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
  background-color: #ffffff;
}

.confirm-btn {
  background-color: #FF0C09;
  color: white;
  padding: 8px 16px;
  border-radius: 0;
}
```

```jsx
<div className="product-row">...</div>
<button className="confirm-btn">Xác nhận</button>
```

**Đúng — viết thẳng Tailwind vào JSX:**

```jsx
<div className="flex items-center p-4 border-b border-border bg-background">...</div>
<Button variant="default">Xác nhận</Button>
```

**Đúng — dùng `cn()` khi cần variant/điều kiện:**

```jsx
<div className={cn(
  "flex items-center p-4 border-b border-border",
  isSelected && "bg-muted",
  isDisabled && "opacity-50 pointer-events-none"
)}>
  ...
</div>
```

**Khi nào ĐƯỢC PHÉP viết vào file CSS:**

| Được phép | Ví dụ |
|---|---|
| `@keyframes` animation phức tạp | `@keyframes shimmer { ... }` |
| Pseudo-selector Tailwind không làm được | `::selection`, `scrollbar-width`, `::-webkit-scrollbar` |
| Override style của third-party widget | Quill editor, react-datepicker, … |
| Base/reset style trong `globals.css` | `body`, `*`, `html` |
| Design token (`@theme inline`) trong `globals.css` | `--color-brand: #FF0C09` |

**Không được phép viết vào file CSS:**

- Class mới đặt tên theo component (`.product-row`, `.confirm-btn`, `.filter-bar-wrapper`)
- Class utility tự đặt tên (`.flex-center`, `.text-muted-sm`, `.btn-primary`)
- Style có thể viết bằng Tailwind utility class tương đương

**Quy trình kiểm tra trước khi viết CSS:**

1. Tailwind có utility class tương đương không? (`flex`, `p-4`, `border-b`, `text-sm`, …) → viết thẳng vào `className`.
2. Cần combine nhiều class có điều kiện? → dùng `cn()`.
3. Cần variant/style tái dùng nhiều chỗ? → tạo component hoặc dùng `cva()`, không tạo CSS class.
4. Thật sự không dùng Tailwind được? → mới viết vào CSS, kèm comment giải thích lý do.

Cấm:

- ❌ Tạo file `.module.css` cho component.
- ❌ Thêm `<style>` tag trong file JSX/TSX.
- ❌ Tạo class mới trong `globals.css` hoặc bất kỳ file `.css` nào khi Tailwind utility là đủ.
- ❌ Tạo file CSS riêng per-page, per-screen, per-feature.
- ❌ Dùng `styled-components`, `emotion`, hoặc bất kỳ CSS-in-JS nào khác.

### 5.14 Encoding và chính tả tiếng Việt — không mojibake, phải có dấu

Mọi text trong source code — JSX content, string literal, comment, error message, log, placeholder, aria-label, alt text, tooltip — phải đảm bảo:

1. **File encoding: UTF-8** — mọi file `.tsx`, `.jsx`, `.ts`, `.js`, `.css`, `.json`, `.md` đều phải lưu UTF-8 (không BOM). Không dùng Latin-1, Windows-1252, hay encoding khác.
2. **Không mojibake** — text tiếng Việt không được xuất hiện dưới dạng ký tự bị vỡ.
3. **Tiếng Việt phải có dấu** — không viết "tiếng Việt không dấu" trong bất kỳ string nào trong code.

**Ví dụ sai — mojibake (encoding bị vỡ):**

```jsx
// ❌ Sai — ký tự bị vỡ do encoding sai
<p>ThÃ nh toÃ¡n thÃ nh cÃ´ng</p>
<p>Gi&#7843;m gi&#225;</p>
<Button>X&#225;c nh&#7853;n &#273;&#417;n h&#224;ng</Button>
```

**Ví dụ sai — tiếng Việt không dấu:**

```jsx
// ❌ Sai — thiếu dấu tiếng Việt
<h1>San pham noi bat</h1>
<p>Them vao gio hang</p>
<span>Xac nhan don hang</span>
<Button>Thanh toan</Button>
```

**Đúng:**

```jsx
// ✅ Đúng — UTF-8, có dấu đầy đủ
<h1>Sản phẩm nổi bật</h1>
<p>Thêm vào giỏ hàng</p>
<span>Xác nhận đơn hàng</span>
<Button>Thanh toán</Button>
```

**Áp dụng cho mọi nơi có text:**

| Loại text | Ví dụ đúng |
|---|---|
| JSX content | `<p>Đơn hàng của bạn</p>` |
| String literal | `const msg = "Sản phẩm không tồn tại"` |
| Placeholder | `placeholder="Tìm kiếm sản phẩm..."` |
| aria-label / title | `aria-label="Đóng hộp thoại"` |
| alt text | `alt="Mũ bảo hiểm BigBike đỏ đen"` |
| Toast / notification | `toast.error("Không thể hủy đơn hàng")` |
| Comment trong code | `// Kiểm tra tồn kho trước khi thêm vào giỏ` |
| Console log / error | `console.error("Lỗi khi tải danh sách sản phẩm")` |
| JSON / API mock | `{ "message": "Xác nhận thành công" }` |

**Nguyên nhân thường gặp gây mojibake — phải tránh:**

- Lưu file với encoding khác UTF-8 rồi mở lại bằng UTF-8.
- Copy text từ Word/Excel không chuyển encoding.
- Dùng `Buffer` / `TextDecoder` sai encoding khi xử lý response.
- Template string nối ký tự Unicode escape thủ công thay vì viết thẳng.

Cấm:

- ❌ Text tiếng Việt không dấu trong bất kỳ string nào hiển thị ra UI.
- ❌ Ký tự Unicode escape thủ công (`ả`, `&#7843;`) khi có thể viết thẳng ký tự UTF-8.
- ❌ File source lưu encoding khác UTF-8.
- ❌ Comment hoặc log tiếng Việt không dấu.

### 5.15 Component reuse — bigbike-admin bắt buộc dùng lại component dùng chung

Trước khi tạo bất kỳ component mới nào trong `bigbike-admin`, **phải kiểm tra** các component sau đây đã có sẵn:

**`bigbike-admin/src/components/` — component dùng chung:**

| Component | Dùng cho |
|---|---|
| `AdminTable` | Mọi bảng dữ liệu dạng list (sản phẩm, đơn hàng, khách hàng, …) |
| `AdminShell` | Layout wrapper toàn trang admin (sidebar + header + content) |
| `ConfirmDialog` | Mọi hành động destructive cần xác nhận (xóa, hủy, …) |
| `StatusBadge` | Hiển thị trạng thái (đơn hàng, sản phẩm, …) |
| `PaginationControls` | Phân trang cho mọi list/table |
| `FilterChips` | Hiển thị filter đang active dạng chip |
| `BulkActionBar` | Thanh action khi chọn nhiều row trong table |
| `RichTextEditor` | Editor soạn thảo nội dung (blog, mô tả, …) |
| `StatePanel` | Panel hiển thị trạng thái + action (state machine UI) |
| `DetailSection` | Section có tiêu đề trong trang detail |
| `DateRangePicker` | Chọn khoảng ngày cho filter/report |
| `ExportButton` | Nút export dữ liệu ra file |
| `ReadOnlyBanner` | Banner cảnh báo khi màn hình ở chế độ read-only |
| `TagInput` | Input nhập nhiều tag/label |
| `MediaPickerModal` | Modal chọn ảnh từ thư viện media |
| `VideoPickerModal` | Modal chọn video từ thư viện media |
| `ImageUrlInput` | Input nhập URL ảnh |
| `MediaCard` | Card hiển thị một file media trong grid |
| `MediaCardSkeleton` | Skeleton loading cho MediaCard |
| `MediaPreviewLightbox` | Xem ảnh/video fullscreen |
| `MediaListRow` | Row hiển thị media dạng list |
| `MediaDetailModal` | Modal xem chi tiết một file media |
| `MediaDetailPanel` | Panel sidebar chi tiết media |
| `MediaFolderSidebar` | Sidebar cây thư mục media |
| `NotificationBell` | Icon chuông thông báo trên header |
| `OrderNotificationToast` | Toast thông báo đơn hàng mới realtime |
| `ErrorBoundary` | Bắt lỗi render, hiển thị fallback UI |

**`bigbike-admin/src/components/layout/` — layout primitives (import qua `index.js`):**

| Component | Dùng cho |
|---|---|
| `Screen` | Wrapper chuẩn cho mọi trang (padding, max-width, scroll) |
| `ScreenHeader` | Header trang: tiêu đề + breadcrumb + action button |
| `FilterBar` | Thanh filter: search + select + date range |
| `SummaryCard` | Card hiển thị chỉ số tổng quan (dashboard, report) |
| `Tabs` | Tab navigation trong trang |
| `Modal` | Modal wrapper chuẩn |
| `StickyActionBar` | Thanh action dính dưới màn hình (form save/cancel) |
| `MobileCardList` | Hiển thị list dạng card trên mobile thay table |
| `FormField` | Field wrapper: label + input + error message |

**Quy trình bắt buộc trước khi tạo component mới:**

1. Tìm trong `bigbike-admin/src/components/` và `bigbike-admin/src/components/layout/` — có component nào đáp ứng không?
2. Nếu gần đúng nhưng cần thêm prop → **extend component có sẵn**, không tạo bản copy.
3. Nếu thực sự chưa có → tạo mới trong thư mục phù hợp, đặt tên theo convention hiện tại (PascalCase `.jsx`).
4. Component mới phải tuân thủ design system rules (Section 5.12) — không tự ý chọn màu/font/spacing.

Cấm:

- ❌ Tạo `MyConfirmModal.jsx` khi `ConfirmDialog` đã có.
- ❌ Tạo `MyTable.jsx` khi `AdminTable` đã có.
- ❌ Tạo `MyPagination.jsx` khi `PaginationControls` đã có.
- ❌ Tạo `MyStatusTag.jsx` khi `StatusBadge` đã có.
- ❌ Tạo layout wrapper mới khi `Screen`, `ScreenHeader`, `FilterBar`, `Modal` đã đáp ứng.
- ❌ Copy-paste component có sẵn rồi sửa nhỏ — phải extend hoặc dùng thẳng.
- ❌ Tạo component mà không check danh sách trên trước.

---

## 6. Repository Boundaries

### 6.1 `bigbike-web`

Purpose:

- Public website.
- SEO.
- Product discovery.
- Product detail.
- Cart/checkout.
- Content/blog/policy pages.
- Trust and conversion.

Rules:

- Mobile-first.
- SEO-friendly.
- Product-first.
- Fast loading.
- Clear CTA.
- Crawlable content.
- Stable URLs.
- Internal links.
- Optimized images.
- No admin UX patterns unless truly appropriate.
- **UI stack: React + Tailwind CSS + Radix UI + shadcn/ui** — xem rule 5.9 để biết cách dùng đúng.

Do not turn public web into a dashboard. Customers do not want to "manage entity rows", they want to buy gear and leave with dignity.

### 6.2 `bigbike-admin`

Purpose:

- Internal operations.
- Product management.
- Order handling.
- Customer/support/content/campaign/settings management.

Rules:

- Data-first.
- Dense but readable.
- Tables/forms/filters must be strong.
- Destructive actions require confirmation.
- Permissions must be respected.
- Use admin tokens, not web campaign styling.
- No hero/campaign visuals inside operational screens unless a module preview specifically needs it.
- **UI stack: React + Tailwind CSS + Radix UI + shadcn/ui** — bắt buộc, xem Section 5.9 (stack rules), Section 5.12 (design system), Section 5.13 (inline Tailwind), Section 5.14 (encoding/tiếng Việt), Section 5.15 (component reuse).

Do not turn admin into a biker poster gallery.

### 6.3 `bigbike-backend`

Purpose:

- Business enforcement.
- API.
- Data persistence.
- Auth/permissions.
- Status transitions.
- Validation.
- Integration boundary.

Rules:

- Validate all incoming data.
- Enforce permissions.
- Never trust frontend totals.
- Never expose secrets.
- Align responses with contract.
- Use consistent error shape.
- Reject invalid state transitions.
- Preserve historical order snapshots.

---

## 7. Data Contract Rules

### 7.1 Canonical media fields

Use canonical fields:

```text
image.url
gallery[]
videos[]
```

Avoid reintroducing legacy field drift:

```text
imageUrl
images
videoUrl
```

Fallback for legacy data may exist temporarily, but new writes should use canonical shape.

### 7.2 Money

Money must use integer VND amount.

Do not use float for money.

Good:

```json
{
  "retailPrice": 1250000,
  "currency": "VND"
}
```

Bad:

```json
{
  "retailPrice": 1250000.50
}
```

### 7.3 Order snapshot

Orders must preserve snapshots:

- Product name.
- Product image.
- Variant/options.
- Unit price.
- Quantity.
- Customer info.
- Shipping address.

Do not depend only on live product/customer data to render old orders.

### 7.4 Unknown enum

If receiving unknown enum:

- Do not crash.
- Show neutral fallback.
- Log/report if appropriate.
- Do not map unknown to success.

---

## 8. API Rules

### 8.1 Standard shape

Single resource:

```json
{
  "data": {},
  "meta": {
    "requestId": "req_123",
    "timestamp": "2026-04-20T03:30:00Z"
  }
}
```

Error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed.",
    "details": []
  },
  "meta": {
    "requestId": "req_123",
    "timestamp": "2026-04-20T03:30:00Z"
  }
}
```

### 8.2 Method rules

- `GET` reads.
- `POST` creates or executes commands.
- `PATCH` updates partially.
- `DELETE` deletes only if business allows.

Never mutate data with `GET`.

### 8.3 Auth and permission

- `401`: not authenticated.
- `403`: authenticated but not authorized.
- Admin endpoints must enforce permissions server-side.

### 8.4 State-changing endpoints

Use command endpoints when transition has side effects:

```text
POST /api/v1/admin/orders/{orderId}/status
POST /api/v1/admin/orders/{orderId}/cancel
POST /api/v1/admin/products/{productId}/publish
```

Backend must validate transition against defined state machine rules.

---

## 9. State Machine Rules

State transitions must be enforced by the backend.

Do not allow impossible transitions just because the UI button exists.

Examples of invalid concepts:

```text
COMPLETED -> PENDING_CONFIRMATION
CANCELLED -> SHIPPING
PENDING_CONFIRMATION -> COMPLETED
```

Frontend should hide/disable invalid actions, but backend still must reject invalid transition.

---

## 10. Permission Rules

Admin route/action must map to a defined permission.

Examples:

```text
/admin/products       -> products.read
/admin/products/new   -> products.create
/admin/orders         -> orders.read
/admin/settings       -> settings.read
```

Backend must enforce every admin endpoint.

Frontend must:

- Hide inaccessible modules.
- Disable forbidden actions when resource is visible.
- Show permission denied route state when needed.

Dangerous actions require:

- Permission.
- Confirmation.
- Backend validation.
- Audit if supported.

---

## 11. Design Rules

### 11.1 Shared UI

All UI must have:

- Clear hierarchy.
- Clear actions.
- Consistent states.
- Accessible focus.
- Responsive behavior.
- No decorative noise.

### 11.2 Web design

For `bigbike-web`, reference:

```text
bigbike-web/STYLEGUIDE.md                # Brand rules, visual foundations
bigbike-web/styles/brand-tokens.css      # CSS tokens
bigbike-web/public/brand/                # Brand assets used by public website
docs/audits/                             # Historical visual/design audit context, if relevant
```

Priorities:

- SEO.
- Product discovery.
- Conversion.
- Mobile-first.
- Trust.
- Fast loading.
- PDP/cart/checkout clarity.

### 11.3 Admin design

For `bigbike-admin`, use the admin token system (not web campaign styling).

Priorities:

- Data readability.
- Fast operations.
- Tables.
- Forms.
- Filters.
- CRUD.
- Permissions.
- Safe destructive actions.

---

## 12. SEO Rules for `bigbike-web`

Do not break SEO.

Required for public pages:

- One clear H1.
- Semantic heading hierarchy.
- Crawlable text.
- Metadata.
- Stable URLs.
- Internal links.
- Image alt text.
- Optimized images.
- No heavy hero/video that destroys performance.
- Category/PDP content must not be hidden in images only.

If changing slug/URL behavior:

- Check redirect strategy.
- Update internal links.
- Avoid breaking indexed URLs.

SEO is not magic dust sprinkled after launch. Shocking, I know.

---

## 13. Cart / Checkout Rules

When touching cart/checkout:

- Do not trust frontend price.
- Do not trust frontend stock.
- Do not allow duplicate submit.
- Preserve form data on error.
- Show price/stock changed notices.
- Show clear next step after order success.
- COD/manual confirmation must be clear if used.
- Backend must validate final order.

---

## 14. Admin CRUD Rules

Every CRUD screen should have:

- List loading state.
- Empty state.
- Error state.
- Search/filter/sort if relevant.
- Pagination if relevant.
- Row actions.
- Permission handling.
- Create/edit form validation.
- Submit loading state.
- Success/error feedback.
- Confirmation for dangerous action.

Tables should not render raw null/undefined.

---

## 15. File and Asset Rules

### 15.1 Brand assets

Brand assets should live in `public/brand` or shared asset package depending on project structure.

Do not rename assets randomly without updating references.

### 15.2 Fonts

Approved fonts per project:

**`bigbike-web`** (xem `bigbike-web/STYLEGUIDE.md` để biết size/weight cụ thể):
- `Barlow` — body / UI / content / link.
- `Oswald` — heading / CTA / badge / nav.
- `Barlow Condensed` — display / hero / campaign.

**`bigbike-admin`** và các project khác:
- `Bungee` — display / campaign / headline (sparingly, uppercase only).
- `Exo` — body / UI / content (9 weights available).

Do not introduce unrelated fonts. Font choice must match the project — không dùng Bungee/Exo trong `bigbike-web`, không dùng Barlow/Oswald trong `bigbike-admin` trừ khi có lý do rõ ràng.

### 15.3 Uploaded media

Media upload must validate:

- File type.
- File size.
- Public URL.
- Alt text if public image.
- Fallback if image fails.

---

## 16. Coding Standards

### 16.1 General

- Keep changes focused.
- Avoid unrelated refactors.
- Prefer reusable components.
- Avoid duplicate logic.
- Add types where appropriate.
- Handle errors explicitly.
- Do not swallow exceptions silently.
- Do not add dead code.
- Do not leave debug logs.

### 16.2 Frontend

- Use existing component patterns.
- Use tokenized styles.
- Keep accessibility.
- Avoid unnecessary client-side rendering if SEO page can be server-rendered.
- Avoid blocking render with heavy scripts.
- Keep responsive behavior.
- Use semantic HTML for public pages.

### 16.3 Backend

- Validate request DTOs.
- Use service-layer business validation.
- Enforce permissions.
- Return standard error shape.
- Avoid leaking internals.
- Keep transactions around state changes where needed.
- Preserve order snapshots.
- Add tests for critical business transitions.

---

## 17. Testing and Verification

Run available checks before finalizing.

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

If exact commands differ, inspect `package.json`, `pom.xml`, project scripts, or CI config.

Do not claim tests passed if you did not run them. Revolutionary honesty, apparently.

### 17.1 Web smoke checks

For `bigbike-web`, verify:

- Homepage loads.
- Category page loads.
- PDP loads.
- Search works if implemented.
- Cart flow works.
- Checkout submit handles validation.
- Mobile layout not broken.
- SEO title/H1 not missing.

### 17.2 Admin smoke checks

For `bigbike-admin`, verify:

- Login/session behavior.
- Dashboard loads.
- Product list loads.
- Product create/edit validation.
- Order list/detail loads.
- Permission denied behavior.
- Destructive confirmation.
- Table empty/error/loading states.

### 17.3 Backend smoke checks

For `bigbike-backend`, verify:

- App starts.
- API endpoints match contract.
- Validation errors use standard shape.
- Permissions enforced.
- State transitions validated.
- No secrets exposed.

---

## 18. Change Summary Rules

When code changes affect business behavior, API shape, data model, state transitions, permissions, or SEO behavior — document it clearly in the PR summary. Do not leave reviewers guessing.

---

## 19. Commit / PR Guidance

When creating a commit or PR, summarize:

- What changed.
- Why it changed.
- Which app affected.
- Tests/checks run.
- Risks or follow-up work.

Example:

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

---

## 20. Forbidden Changes Without Explicit Request

Do not do these unless explicitly asked:

- Rewrite whole app architecture.
- Replace framework/library.
- Rename major routes.
- Change API versioning.
- Change database schema.
- Add auth provider.
- Add payment provider.
- Change brand colors.
- Change business statuses.
- Change permission model.
- Hard-delete existing business data.
- Remove SEO routes.
- Remove fallback support for existing data.

---

## 21. Safe Defaults

When uncertain:

- Preserve existing behavior.
- Prefer additive change.
- Add fallback.
- Keep old route working.
- Keep old data readable.
- Mark unclear business rule as `TBD`.
- Ask for clarification in the final response if needed.
- Do not invent.

---

## 22. Agent Final Response Format

When finishing a task, report:

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

If checks were not run, say:

```text
Checks:
- Not run: reason
```

Do not claim imaginary test results. The CI gods are petty and they keep receipts.

---

## 23. Quick Reference

### Web change

```text
AGENTS.md
CLAUDE.md
docs/audits/ (if relevant)
docs/engineering/API_CONTRACT.md
docs/engineering/API_FLOW_MAP.md
docs/engineering/DATA_CONTRACT.md
docs/business/WORKFLOW_OVERVIEW.md
docs/business/MODULE_CATALOG.md
bigbike-web/AGENTS.md
bigbike-web/STYLEGUIDE.md
bigbike-web/styles/brand-tokens.css
bigbike-web/public/brand/
bigbike-backend/src/main/resources/openapi/bigbike-openapi.json
```

### Admin change

```text
AGENTS.md
CLAUDE.md
docs/audits/ (if relevant)
docs/engineering/API_CONTRACT.md
docs/engineering/PERMISSION_MATRIX.md
docs/engineering/DATA_CONTRACT.md
docs/business/USER_ROLES.md
docs/business/MODULE_CATALOG.md
docs/business/STATE_MACHINES.md
bigbike-admin/src/styles/admin-tokens.css
bigbike-admin/public/brand/
bigbike-backend/src/main/resources/openapi/bigbike-openapi.json
```

### Backend change

```text
AGENTS.md
CLAUDE.md
docs/audits/ (if relevant)
docs/engineering/API_CONTRACT.md
docs/engineering/DATA_CONTRACT.md
docs/engineering/PERMISSION_MATRIX.md
docs/engineering/INTEGRATION_GUIDE.md
docs/business/BUSINESS_RULES.md
docs/business/STATE_MACHINES.md
docs/business/WORKFLOW_OVERVIEW.md
bigbike-backend/docs/PHASE_1D_CUSTOMER_AUTH_REPORT.md
bigbike-backend/docs/PHASE_1F_CHECKOUT_API_REPORT.md
bigbike-backend/docs/PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md
bigbike-backend/src/main/resources/openapi/bigbike-openapi.json
```

### Mobile change

```text
AGENTS.md
CLAUDE.md
docs/audits/ (if relevant)
docs/engineering/API_CONTRACT.md
docs/engineering/API_FLOW_MAP.md
docs/business/WORKFLOW_OVERVIEW.md
bigbike_mobile/lib/core/api/api_endpoints.dart
bigbike_mobile/lib/core/router/app_router.dart
```

### Deployment / Docker / env change

```text
AGENTS.md
docs/engineering/DEPLOYMENT_GUIDE.md
docs/engineering/INTEGRATION_GUIDE.md
.env.example
docker-compose.yaml
.github/workflows/ci.yml
```

### Test / CI change

```text
AGENTS.md
docs/engineering/TESTING_GUIDE.md
docs/business/ACCEPTANCE_CRITERIA.md
.github/workflows/ci.yml
```

### Legacy migration change

```text
bigbike_vn__2026_04_17/
```

### Contract change

Update docs first (see Docs-First Contract above), then PR summary, then code in all affected layers (frontend + backend + mobile if applicable).

---

## Final Rule

An AI agent must leave the repository more consistent than it found it.

If the change makes frontend, backend, and contracts disagree with each other, the change is not done. It is merely a bug wearing a pull request costume.
