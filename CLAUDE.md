# CLAUDE.md

> **Read this before doing anything in this codebase.**
>
> Auto-load behavior:
> - **Claude Code**: tự động đọc file này ở đầu mọi conversation trong repo.
> - **Codex** (CLI / web agent): KHÔNG đọc file này. Codex tự load [AGENTS.md](AGENTS.md) — nội dung đầy đủ và canonical hơn.
> - **Tool khác** (Cursor, Continue, …): tuỳ tool. Nếu không chắc, đọc cả 2 file để an toàn.
>
> File này là **bản tóm tắt mirror** của Docs-First Contract trong [AGENTS.md](AGENTS.md). Khi 2 file khác nhau, AGENTS.md là canonical.

---

## ⚠️ Docs-First Contract

Tài liệu trong [docs/business/](docs/business/) và [docs/engineering/](docs/engineering/) là **source of truth** của BigBike. Code được dựng từ docs, không phải ngược lại.

### Trước khi sửa BẤT KỲ file source nào trong [bigbike-backend/](bigbike-backend/), [bigbike-web/](bigbike-web/), [bigbike-admin/](bigbike-admin/), [bigbike_mobile/](bigbike_mobile/):

1. **Đọc đúng docs liên quan** — tra mapping bên dưới, chỉ mở file nào trực tiếp liên quan đến phần bạn đang sửa. Trong mỗi file, chỉ đọc section liên quan — không đọc toàn bộ file vì một câu hỏi hoặc một thay đổi nhỏ.
2. **Cite evidence path** khi mô tả thay đổi trong response/PR (ví dụ "theo `docs/business/BUSINESS_RULES.md` rule `ORDER_RULE_003`").
3. Nếu thay đổi ảnh hưởng business rule, API contract, data shape, permission, state machine, workflow hoặc deployment env → **update docs trước**, rồi mới sửa code, trong cùng một PR.
4. **Không bịa rule.** Nếu docs ghi `NEEDS_VERIFICATION` / `NOT_FOUND_IN_REPO` / `CONFLICTING_EVIDENCE` mà bạn cần biết để code → **dừng và hỏi user** thay vì tự suy diễn.
5. **Trước khi "fix bug"**, nếu repo có report verification/audit trong `docs/` hoặc `docs/audits/`, đọc phần liên quan để biết những vấn đề đã được flag là code bug có task riêng — không tự ý fix chung trong task khác.

**Không cần đọc docs khi:** câu hỏi giải thích đơn thuần, thay đổi thuần style/token, refactor nội tại không ảnh hưởng API/contract/data/permission/state/deployment.

### Mapping nhanh — tra cứu theo phần đang sửa, chỉ đọc những gì bạn thật sự đụng đến

| Bạn đang sửa | Đọc docs (chỉ section liên quan) |
|---|---|
| Backend controller / service — endpoint hoặc business logic | [API_CONTRACT.md](docs/engineering/API_CONTRACT.md) section endpoint đó; [BUSINESS_RULES.md](docs/business/BUSINESS_RULES.md) section rule liên quan; [AGENTS.md](AGENTS.md) Section 7 (Lombok / MapStruct / Bean Validation) |
| Backend entity / DTO / enum / migration | [DATA_CONTRACT.md](docs/engineering/DATA_CONTRACT.md) section entity đó; [AGENTS.md](AGENTS.md) Section 7.1 (Lombok trên Entity), 7.2 (MapStruct mapper) |
| Backend state transition | [STATE_MACHINES.md](docs/business/STATE_MACHINES.md) section entity đó |
| Backend integration (DB, MinIO, Mail, WS) | [INTEGRATION_GUIDE.md](docs/engineering/INTEGRATION_GUIDE.md) section service liên quan |
| Frontend API call / response shape | [API_CONTRACT.md](docs/engineering/API_CONTRACT.md) section endpoint đó; [DATA_CONTRACT.md](docs/engineering/DATA_CONTRACT.md) section field liên quan |
| Frontend flow màn hình → API | [API_FLOW_MAP.md](docs/engineering/API_FLOW_MAP.md) section flow đó |
| Frontend workflow / UX | [WORKFLOW_OVERVIEW.md](docs/business/WORKFLOW_OVERVIEW.md) section liên quan |
| Frontend module / feature ownership | [MODULE_CATALOG.md](docs/business/MODULE_CATALOG.md) |
| `bigbike-web` UI / style | [bigbike-web/STYLEGUIDE.md](bigbike-web/STYLEGUIDE.md); [bigbike-web/styles/brand-tokens.css](bigbike-web/styles/brand-tokens.css) |
| `bigbike-admin` UI / style | [bigbike-admin/src/styles/admin-tokens.css](bigbike-admin/src/styles/admin-tokens.css) |
| Permission / role / auth | [PERMISSION_MATRIX.md](docs/engineering/PERMISSION_MATRIX.md) section role liên quan; [USER_ROLES.md](docs/business/USER_ROLES.md) |
| Order / payment / refund / inventory / return logic | [BUSINESS_RULES.md](docs/business/BUSINESS_RULES.md) + [STATE_MACHINES.md](docs/business/STATE_MACHINES.md) — chỉ section liên quan |
| Deployment / Dockerfile / env / CI | [DEPLOYMENT_GUIDE.md](docs/engineering/DEPLOYMENT_GUIDE.md); [INTEGRATION_GUIDE.md](docs/engineering/INTEGRATION_GUIDE.md) |
| Test / quality gate | [TESTING_GUIDE.md](docs/engineering/TESTING_GUIDE.md); [ACCEPTANCE_CRITERIA.md](docs/business/ACCEPTANCE_CRITERIA.md) |
| Architecture / module ownership (cần toàn cảnh) | [ARCHITECTURE.md](docs/engineering/ARCHITECTURE.md); [MODULE_CATALOG.md](docs/business/MODULE_CATALOG.md); [PROJECT_OVERVIEW.md](docs/business/PROJECT_OVERVIEW.md) |
| Trace requirement → API → test | [TRACEABILITY_MATRIX.md](docs/engineering/TRACEABILITY_MATRIX.md) |

### Khi docs mâu thuẫn nhau

- `docs/business/` mâu thuẫn `docs/engineering/` → **business docs thắng**, engineering cần sửa.
- `docs/engineering/` mâu thuẫn code → check report/audit liên quan trong `docs/` hoặc `docs/audits/` nếu có; mặc định docs là source of truth nếu chưa có verdict.

### Cấm

- ❌ Sửa code mà không đọc docs liên quan.
- ❌ Đẩy code mà docs không phản ánh thay đổi (trừ refactor nội tại không ảnh hưởng API/contract/data/permission/state/deployment).
- ❌ "Code-first, doc-fix-later" trừ khi user explicitly cho phép.
- ❌ Tự "fix" cái đã được report/audit trong `docs/` hoặc `docs/audits/` flag là code bug — đó là task riêng.

---

## ⚠️ UI Stack — bigbike-web & bigbike-admin

Khi code bất kỳ giao diện nào trong `bigbike-web` hoặc `bigbike-admin`, **bắt buộc dùng combo**:

> **React + Tailwind CSS + Radix UI + shadcn/ui**

| Việc cần làm | Dùng gì |
|---|---|
| Component UI (button, input, select, dialog, checkbox, tabs…) | shadcn/ui từ `components/ui/` |
| Styling, spacing, color, layout | Tailwind CSS utility classes — viết **trực tiếp vào `className`** trong JSX |
| Interactive primitive (dropdown, tooltip, popover, radio…) | Radix UI qua shadcn wrapper |
| Variant/override | `cn()` + `cva()` / `buttonVariants()` |
| Color/token reference | `@theme inline` trong `globals.css` (`text-primary`, `bg-brand`, `border-border`…) |

**Encoding và tiếng Việt — áp dụng cho mọi text trong code:**
- File phải lưu **UTF-8**. Text tiếng Việt phải **có dấu đầy đủ** — không "viet khong dau".
- Không để text bị vỡ mã (mojibake): `ThÃ nh toÃ¡n`, `Gi&#7843;m gi&#225;` là sai.
- Áp dụng cho: JSX content, string literal, placeholder, aria-label, alt text, comment, toast, log.

Chi tiết: [AGENTS.md](AGENTS.md) — Section 6.5.

---

**globals.css chỉ được chứa:** design tokens (`@theme inline`), base/reset styles, shadcn overrides, và những gì Tailwind thật sự không làm được (keyframes, complex pseudo-selectors). **Không thêm class mới** vào `globals.css` khi Tailwind là đủ.

**Inline Tailwind — viết thẳng vào JSX, không tạo class CSS mới:**

```jsx
// ❌ Sai — tạo class CSS rồi dùng
// .product-row { display: flex; padding: 16px; border-bottom: 1px solid #e5e7eb; }
<div className="product-row">...</div>

// ✅ Đúng — viết thẳng Tailwind vào className
<div className="flex p-4 border-b border-border">...</div>

// ✅ Đúng — dùng cn() khi cần điều kiện
<div className={cn("flex p-4 border-b border-border", isSelected && "bg-muted")}>...</div>
```

**Tái sử dụng component dùng chung — bắt buộc kiểm tra trước khi tạo mới:**

| Thư mục | Có sẵn gì |
|---|---|
| `bigbike-web/components/ui/` | Button, Input, Select, Dialog, Checkbox, Tabs, Tooltip, Popover, … + EmptyState, ErrorState, LoadingGrid, PriceText, MediaImage, RatingStars, PaginationNav, Skeletons, VnAddressFields, BBTooltip |
| `bigbike-web/components/layout/` | SiteHeader, SiteFooter, PageHero, AccountShell, PolicySidebar, StickyHeaderShell |
| `bigbike-web/components/catalog/` | ProductCard, ProductGallery, VariantSelector, AddToCartButton, CatalogFilters, ReviewsSection |
| `bigbike-admin/src/components/` | AdminTable, AdminShell, ConfirmDialog, StatusBadge, PaginationControls, FilterChips, BulkActionBar, RichTextEditor, StatePanel, DetailSection, DateRangePicker, ExportButton, ReadOnlyBanner, TagInput, MediaPickerModal, VideoPickerModal, ImageUrlInput, MediaCard, MediaCardSkeleton, MediaPreviewLightbox, MediaListRow, MediaDetailModal, MediaDetailPanel, MediaFolderSidebar, NotificationBell, OrderNotificationToast, ErrorBoundary |
| `bigbike-admin/src/components/layout/` | Screen, ScreenHeader, FilterBar, SummaryCard, Tabs, Modal, StickyActionBar, MobileCardList, FormField (import từ `index.js`) |

**Cấm:**
- ❌ Viết class mới vào `globals.css` (hoặc file `.css` nào) khi Tailwind utility là đủ — phải viết thẳng vào `className` trong JSX.
- ❌ Dùng native `<select>`, `<dialog>`, `<input type="checkbox">`, `<button>` khi shadcn đã có component tương ứng.
- ❌ Xóa/bypass shadcn component để thay bằng raw HTML + class CSS legacy.
- ❌ Hardcode hex màu / spacing px thay vì dùng Tailwind token.
- ❌ Tạo component mới khi component tương đương đã tồn tại trong các thư mục `components/` trên.

Chi tiết đầy đủ: [AGENTS.md](AGENTS.md) — Section 6.1 (stack), Section 6.3 (inline Tailwind), Section 6.4 (component reuse), Section 6.5 (encoding/tiếng Việt).

---

## ⚠️ Design System Unity — bigbike-web & bigbike-admin dùng chung 1 hệ thống thiết kế

Mọi trang, route, component trong `bigbike-web` — và mọi màn hình, form, table trong `bigbike-admin` — phải có visual appearance bắt nguồn từ **cùng một design system của BigBike**. Không trang nào, không screen nào được tự chọn màu, font, spacing, hay border-radius riêng ngoài hệ thống đã định nghĩa. Hai app dùng chung brand palette nhưng có font system riêng — không trộn lẫn.

### bigbike-web

**Token cascade — bắt buộc theo đúng thứ tự:**

| Lớp | File |
|---|---|
| Brand rules (source of truth) | [`bigbike-web/STYLEGUIDE.md`](bigbike-web/STYLEGUIDE.md) — palette, typography, component rules |
| CSS custom properties | [`bigbike-web/styles/brand-tokens.css`](bigbike-web/styles/brand-tokens.css) |
| Tailwind exposure | [`bigbike-web/app/globals.css`](bigbike-web/app/globals.css) — `@theme inline { … }` |
| Dùng trong JSX | Tailwind utility classes (`text-primary`, `bg-brand`, `border-border`, …) |

**Quy tắc bắt buộc:**
- **Màu** → chỉ từ palette trong `STYLEGUIDE.md`; tham chiếu qua CSS variable hoặc Tailwind token — không hardcode hex ngoài danh sách đã duyệt.
- **Font** → Barlow (body/UI), Oswald (heading/CTA), Barlow Condensed (display/hero) — không import font khác.
- **Spacing** → thang 4px (`p-4`, `gap-6`, `mt-8`…) — không dùng arbitrary px khi Tailwind step đã đủ.
- **Border radius** → `0px` (`rounded-none`) cho mọi component thông thường; `rounded-full` chỉ cho phần tử thực sự tròn.
- **Visual consistency** → trước khi ship, component mới phải trông như phần của cùng một website — màu, font, spacing, radius phải cùng hệ thống.

### bigbike-admin

**Token cascade — bắt buộc theo đúng thứ tự:**

| Lớp | File |
|---|---|
| Brand token source of truth | [`bigbike-admin/src/styles/admin-tokens.css`](bigbike-admin/src/styles/admin-tokens.css) — admin palette + type scale |
| CSS exposure | [`bigbike-admin/src/index.css`](bigbike-admin/src/index.css) — import token; Tailwind theme mapping phải derive từ token này |
| Dùng trong JSX | Tailwind utility classes hoặc CSS variable (`text-primary`, `bg-brand`, `var(--admin-...)`, …) |

**Quy tắc bắt buộc:**
- **Màu** → chỉ từ BigBike brand palette; tham chiếu qua CSS variable hoặc Tailwind token — không hardcode hex ngoài danh sách đã duyệt.
- **Font** → Bungee (display/headline, uppercase only), Exo (body/UI/content) — không import font khác, không dùng Barlow/Oswald.
- **Spacing** → thang 4px — không dùng arbitrary px khi Tailwind step đã đủ.
- **Border radius** → `rounded-none` mặc định; `rounded-full` chỉ cho phần tử thực sự tròn.
- **Visual style** → operational/data-first: dense, readable, table/form/filter centric — không đưa hero/campaign visuals vào operational screens.
- **Visual consistency** → trước khi ship screen mới, phải trông như phần của cùng một admin dashboard — không generic SaaS template.

**Cấm (áp dụng cho cả hai app):**
- ❌ Arbitrary Tailwind value (`bg-[#abc]`, `text-[13px]`, `p-[17px]`) khi token tương đương đã tồn tại.
- ❌ Tailwind built-in color (`bg-red-500`, `text-blue-600`) thay vì brand token (`bg-brand`, `text-primary`).
- ❌ Import hoặc khai báo font ngoài danh sách đã duyệt cho từng project.
- ❌ CSS scoped per-page/screen (CSS module, `<style>` tag, class trong `.css` file riêng) khi Tailwind là đủ.
- ❌ Mỗi trang / screen / agent tự quyết định visual style riêng — mọi quyết định màu/font/spacing phải traceable về design system của app đó.
- ❌ Dùng font/token của `bigbike-web` trong `bigbike-admin` hoặc ngược lại.

Chi tiết đầy đủ: [AGENTS.md](AGENTS.md) — Section 6.2 (Design System Unity cho cả web và admin).

---

## ⚠️ Docker server access khi fix bug / vận hành hệ thống

Khi cần fix lỗi runtime, debug, xem log, query DB thật, verify migration hoặc bất kỳ task vận hành nào:

- **Được phép vào trực tiếp container Docker đang chạy** (backend, db, redis, web, admin…) qua `docker ps`, `docker logs`, `docker exec`, `docker compose exec` để chẩn đoán/sửa lỗi.
- **Luôn `docker ps` (hoặc `docker compose ps`) trước** để xác nhận stack đang chạy.
- Nếu container cần dùng **chưa chạy** → **DỪNG và yêu cầu user khởi động** (ví dụ `docker compose up -d backend`). Không tự ý `up`, `start`, `restart`, `down`, `rm`, `prune` — đó là shared state.
- Trong container, mặc định chỉ **thao tác đọc** (logs, `SELECT`, `SHOW`, `cat`, `ls`…). Mọi thao tác ghi/destructive (`UPDATE`, `DELETE`, `DROP`, `TRUNCATE`, sửa file config, kill/restart service…) phải hỏi user trước.
- Khi report kết quả, cite rõ container/service và command đã chạy để user verify được.

Cấm:

- ❌ Giả định container đang chạy mà không check.
- ❌ Tự ý `docker compose up/down/restart/rm`, xoá volume/network, prune image.
- ❌ Chạy lệnh destructive trong container đang chạy khi user chưa duyệt.
- ❌ Mock dữ liệu khi container thật đang chạy và có thể query được — luôn ưu tiên data thật để tìm đúng root cause.

Chi tiết đầy đủ: [AGENTS.md](AGENTS.md) — Section 5.5.

---

## ⚠️ Backend Java — bắt buộc dùng Lombok, MapStruct và Bean Validation

Khi viết code Java trong `bigbike-backend`, **bắt buộc dùng triệt để** 3 thư viện sau — không viết boilerplate thủ công khi thư viện đã xử lý được.

| Thư viện | Dùng cho | Cấm làm thay |
|---|---|---|
| **Lombok** | `@Getter/@Setter`, `@Builder`, `@RequiredArgsConstructor`, `@AllArgsConstructor`, `@NoArgsConstructor`, `@Slf4j`, `@Data` (không dùng `@Data` trên JPA Entity có lazy relationship) | Viết getter/setter/constructor/logger thủ công |
| **MapStruct** | `@Mapper(componentModel = "spring")` interface trong package `mapper/`; `@Mapping` cho field khác tên / nested / ignore | Viết mapping thủ công từng field, dùng `BeanUtils.copyProperties()` |
| **Bean Validation** | `@NotNull`, `@NotBlank`, `@Size`, `@Positive`, `@Email`, `@Pattern`, `@Valid` (cascade nested), `@Constraint` cho custom validator | `if (x == null)` thủ công trong controller/service, bỏ quên `@Valid` trên `@RequestBody` |

**Quy tắc chính:**
- JPA Entity: dùng `@Getter` + `@Setter` + `@NoArgsConstructor` riêng — **không dùng `@Data`** (gây vòng lặp lazy-load).
- Mapper: luôn là `interface`, `componentModel = "spring"`, đặt trong package `mapper/`.
- Controller: luôn có `@Valid` trên `@RequestBody` / `@ModelAttribute` để kích hoạt constraint.
- Service: không validate lại những gì Bean Validation đã check ở boundary.

Chi tiết đầy đủ: [AGENTS.md](AGENTS.md) — Section 7 (7.1 Lombok, 7.2 MapStruct, 7.3 Bean Validation, 7.4 coding standards).

---

## Phong cách trả lời

- **Ngôn ngữ business, không dùng thuật ngữ kỹ thuật.** Giải thích bằng ngôn ngữ mà chủ shop / quản lý có thể hiểu ngay — không dùng tên class, method, endpoint, stack trace hay jargon lập trình trừ khi user là developer và đang hỏi về code cụ thể.
- **Ngắn gọn nhưng đủ ý.** Không viết dài dòng, không lặp lại điều đã nói. Mỗi câu phải có thông tin.
- **Trình bày dễ đọc.** Dùng danh sách, bảng, hoặc tiêu đề ngắn khi có nhiều điểm cần liệt kê. Không đổ thành đoạn văn dài.
- **Trả lời đúng trọng tâm câu hỏi.** Không giải thích những thứ user không hỏi.

---

## Đọc thêm

Full agent operating rules: [AGENTS.md](AGENTS.md) — đặc biệt Section 2 (Docs-First Contract), Section 3 (Required Reading Order — lazy), Section 4 (Source of Truth Map), Section 6 (Frontend Stack), Section 7 (Backend Stack).
