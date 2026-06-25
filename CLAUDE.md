# CLAUDE.md

> **Đọc file này trước khi làm bất cứ gì trong repo.**
>
> Đây là **bản tóm tắt mirror** của [AGENTS.md](AGENTS.md) — file canonical, đầy đủ hơn. Khi 2 file lệch nhau, **AGENTS.md thắng**. Mỗi rule dưới đây trỏ tới section AGENTS.md để xem chi tiết/ví dụ.
>
> Auto-load: Claude Code đọc file này đầu mỗi conversation. Codex đọc [AGENTS.md](AGENTS.md). Tool khác: nếu không chắc, đọc cả 2.

---

## ⚠️ Docs-First Contract — đọc trước MỌI thay đổi code

`docs/business/` và `docs/engineering/` là **source of truth**. Code dựng từ docs, không phải ngược lại.

Trước khi sửa file source trong [bigbike-backend/](bigbike-backend/), [bigbike-web/](bigbike-web/), [bigbike-admin/](bigbike-admin/), [bigbike_mobile/](bigbike_mobile/):

1. **Đọc đúng docs liên quan** (tra mapping dưới), chỉ section bạn đụng đến — không đọc cả file.
2. **Cite evidence path** trong response/PR (vd "theo `BUSINESS_RULES.md` rule `ORDER_RULE_003`").
3. Thay đổi chạm business rule / API contract / data shape / permission / state machine / workflow / deployment env → **update docs trước, rồi sửa code, cùng một PR**.
4. **Không bịa rule.** Docs ghi `NEEDS_VERIFICATION` / `NOT_FOUND_IN_REPO` / `CONFLICTING_EVIDENCE` mà bạn cần → **dừng, hỏi user**.
5. **Không tự "fix" cái đã được report/audit trong `docs/` hoặc `docs/audits/` flag là code bug** — đó là task riêng.

**Không cần đọc docs khi:** câu hỏi giải thích thuần, thay đổi thuần style/token, refactor nội tại không ảnh hưởng API/contract/data/permission/state/deployment.

**Mapping nhanh** — chỉ đọc section liên quan:

| Bạn đang sửa | Đọc |
|---|---|
| Backend controller/service (endpoint, business logic) | `API_CONTRACT.md` + `BUSINESS_RULES.md` + [AGENTS.md](AGENTS.md) §7 |
| Backend entity/DTO/enum/migration | `DATA_CONTRACT.md` + [AGENTS.md](AGENTS.md) §7.1–7.2 |
| Backend state transition | `STATE_MACHINES.md` |
| Backend integration (DB/MinIO/Mail/WS) | `INTEGRATION_GUIDE.md` |
| Frontend API call / response shape | `API_CONTRACT.md` + `DATA_CONTRACT.md` |
| Frontend flow màn hình → API | `API_FLOW_MAP.md` |
| Frontend workflow / UX | `WORKFLOW_OVERVIEW.md` |
| Module / feature ownership | `MODULE_CATALOG.md` |
| `bigbike-web` UI/style | `bigbike-web/STYLEGUIDE.md` + `styles/brand-tokens.css` |
| `bigbike-admin` UI/style | `bigbike-admin/src/styles/admin-tokens.css` |
| Permission / role / auth | `PERMISSION_MATRIX.md` + `USER_ROLES.md` |
| Order/payment/refund/inventory/return | `BUSINESS_RULES.md` + `STATE_MACHINES.md` |
| Deployment / Dockerfile / env / CI | `DEPLOYMENT_GUIDE.md` + `INTEGRATION_GUIDE.md` |
| Test / quality gate | `TESTING_GUIDE.md` + `ACCEPTANCE_CRITERIA.md` |
| Toàn cảnh kiến trúc | `ARCHITECTURE.md` + `MODULE_CATALOG.md` + `PROJECT_OVERVIEW.md` |

Docs mâu thuẫn: `business/` thắng `engineering/`; `engineering/` thắng code (trừ khi audit có verdict khác).

Chi tiết: [AGENTS.md](AGENTS.md) §2 (contract) + §3 (mapping đầy đủ) + §4 (source of truth map).

---

## ⚠️ UI Stack — bigbike-web & bigbike-admin

Mọi UI phải dùng combo: **React + Tailwind CSS + Radix UI + shadcn/ui**.

- Component (button, input, select, dialog, tabs…) → **shadcn/ui** từ `components/ui/`.
- Styling/spacing/color/layout → **Tailwind** viết thẳng vào `className` (dùng `cn()` cho điều kiện).
- Primitive tương tác → **Radix** qua shadcn wrapper.
- **Tái dùng component có sẵn** trước khi tạo mới — kiểm tra `components/ui|layout|catalog/` (web) và `src/components/` (admin). Danh sách đầy đủ: [AGENTS.md](AGENTS.md) §6.4.

**Cấm:** native `<select>/<dialog>/<input type=checkbox>/<button>` khi shadcn đã có; hardcode hex/spacing px thay token; CSS-in-JS; tạo component trùng cái đã tồn tại.

Chi tiết: [AGENTS.md](AGENTS.md) §6.1, §6.3, §6.4.

---

## ⚠️ CSS Hygiene — không để dead code

**Dead CSS** = class trong `.css` không có JSX/JS nào reference.

- Class mới phải được dùng ngay cùng commit — không "placeholder".
- Nghi dead → **grep xác nhận trước**, 0 kết quả → **xóa ngay**, không ghi TODO.
- `bigbike-admin` có 3 file CSS song song — `index.css` + `admin-layout.css` (production), `admin-prototype.css` (**hệ `bb-*` canonical đang sống**, chassis chính). Không nhét class ngoài `bb-*` vào `admin-prototype.css`; không giả định dead mà không grep.

```bash
grep -rn "ten-class" bigbike-admin/src bigbike-web --include="*.jsx" --include="*.tsx" --include="*.js" --include="*.ts"
```

Chi tiết: [AGENTS.md](AGENTS.md) §6.6.

---

## ⚠️ Design System Unity — web & admin chung 1 hệ thống thiết kế

Mọi trang/screen phải lấy màu/font/spacing/radius từ **design system của app đó** — không trang nào tự chọn riêng. Hai app chung brand palette nhưng **font system riêng, không trộn**.

**bigbike-web** (cascade: `STYLEGUIDE.md` → `brand-tokens.css` → `globals.css @theme inline` → Tailwind token):
- Màu: palette `STYLEGUIDE.md`, qua token — không hardcode hex.
- Font: Barlow/Arial (body), Barlow Condensed (heading/CTA/nav/display, UPPERCASE). **Oswald đã gỡ bỏ.**
- Spacing thang 4px. Radius `rounded-none` mặc định (`rounded-full` chỉ cho phần tử thật sự tròn).

**bigbike-admin** (cascade: `admin-tokens.css` → `index.css` → Tailwind/CSS var):
- Màu: **Primary = cam `#cc4a08`** (dark `#f0791f`) cho CTA/active/selected/focus/link; **đỏ `#e8281e`** **chỉ** cho brand chrome (vạch sidebar active, nav badge, notification pip, logo); danger có token riêng. Qua token, không hardcode hex.
- Font: Inter (body), Bungee (display/KPI), JetBrains Mono (mã/SKU) — không Exo/Barlow/Oswald.
- Spacing thang 4px. Radius theo `--admin-radius-*` (xs5/sm8/md12/lg16). Admin **không** `rounded-none` mặc định. Visual data-first, không hero/campaign trong operational screen.

**Cấm (cả 2 app):** arbitrary Tailwind value (`bg-[#abc]`, `text-[13px]`) khi đã có token; Tailwind built-in color (`bg-red-500`) thay brand token; import font ngoài danh sách; dùng font/token app này trong app kia; CSS scoped per-page khi Tailwind đủ.

**Encoding/tiếng Việt** (mọi text trong code): file UTF-8; tiếng Việt **có dấu đầy đủ**; không mojibake (`ThÃ nh toÃ¡n`, `Gi&#7843;m` là sai). Áp dụng cho JSX, string, placeholder, aria-label, alt, comment, toast, log.

Chi tiết: [AGENTS.md](AGENTS.md) §6.2 (design system), §6.5 (encoding).

---

## ⚠️ File `.env` — biến môi trường toàn stack

`.env` ở root là cấu hình chính của toàn stack khi chạy Docker Compose (load tự động vào mọi service). Nhóm biến: SMTP/Email, URL email & site/admin, `SPRING_PROFILES_ACTIVE=dev`, CORS, JWT, DB, MinIO, Next.js public URL.

- URL sai môi trường (vd link email trỏ production khi đang localhost) → **kiểm tra `.env` trước, không sửa code**.
- Thêm biến mới vào code → cập nhật `.env.example` đồng thời.
- **KHÔNG commit `.env`** — chỉ commit `.env.example`.

Chi tiết: [AGENTS.md](AGENTS.md) §5.5.

---

## ⚠️ Media của dữ liệu admin quản lý — bắt buộc lưu trong MinIO

**Mọi ẢNH của dữ liệu admin quản lý BẮT BUỘC nằm trong MinIO, không trỏ link ra ngoài.** Áp dụng cho product, category, brand, banner/hero, content/blog/policy, page builder (contact/guide/warranty), settings, media library… Mọi `image.url`, `gallery[]` (ảnh), banner, icon, menuIcon, thumbnail, og-image phải trỏ về object MinIO (`/media/...`).

**Ngoại lệ — VIDEO nhúng YouTube + TikTok + Facebook (owner chốt 2026-06-25):** video (gallery video, "Video sản phẩm", video trang chủ, khối video bài viết) được phép dán link **YouTube**, **TikTok** hoặc **Facebook** làm nguồn (provider `youtube`|`tiktok`|`facebook`|`upload`; `upload` phải là MinIO). Web tự dựng iframe embed (`youtube-nocookie.com/embed/{id}`, `tiktok.com/embed/v2/{id}`, `facebook.com/plugins/video.php?href={url}`). Link rút gọn (`vt.tiktok.com`/`vm.tiktok.com`/`fb.watch`) bị reject — yêu cầu link đầy đủ. Facebook chỉ render video CÔNG KHAI. Nền tảng khác (Vimeo/Dailymotion…) vẫn cấm.

**Cấm:** hotlink **ảnh** từ host ngoài (CDN bên thứ ba, Drive, Imgur, link `/wp/...` legacy); embed video nền tảng ngoài YouTube/TikTok/Facebook; cho admin nhập URL ảnh ngoài làm nguồn media (cần nhập từ URL → backend **fetch về + re-upload vào MinIO**, lưu URL MinIO); write mới giữ link ảnh external (chỉ chấp nhận fallback đọc cho legacy chưa migrate).

Chi tiết: [AGENTS.md](AGENTS.md) §14.3 (+ §8.1 media fields).

---

## ⚠️ Docker server access khi fix bug / vận hành

- **Được vào trực tiếp container đang chạy** (`docker ps/logs/exec`, `docker compose exec`) để chẩn đoán/sửa lỗi runtime.
- **Luôn `docker ps` trước** để xác nhận stack chạy. Container cần dùng chưa chạy → **DỪNG, yêu cầu user khởi động**. Không tự `up/start/restart/down/rm/prune` — shared state.
- Trong container mặc định chỉ **đọc** (logs, `SELECT`, `cat`, `ls`). Thao tác ghi/destructive (`UPDATE/DELETE/DROP/TRUNCATE`, sửa config, kill/restart) phải hỏi user trước.
- Report kết quả: cite rõ container/service + command đã chạy.
- **Không mock dữ liệu** khi container thật đang chạy và query được — ưu tiên data thật.

Chi tiết: [AGENTS.md](AGENTS.md) §5.6.

---

## ⚠️ Backend Java — bắt buộc Lombok + MapStruct + Bean Validation

Không viết boilerplate thủ công khi thư viện xử lý được.

| Thư viện | Dùng cho | Cấm thay thế |
|---|---|---|
| **Lombok** | `@Getter/@Setter`, `@Builder`, `@RequiredArgsConstructor`, `@Slf4j`, `@Data` (KHÔNG `@Data` trên JPA Entity có lazy relationship) | getter/setter/constructor/logger thủ công |
| **MapStruct** | `@Mapper(componentModel="spring")` interface trong package `mapper/`, `@Mapping` cho field khác tên/nested/ignore | mapping thủ công, `BeanUtils.copyProperties()` |
| **Bean Validation** | `@NotNull/@NotBlank/@Size/@Positive/@Email/@Pattern/@Valid` (cascade nested) | `if (x==null)` thủ công, quên `@Valid` trên `@RequestBody` |

- JPA Entity: `@Getter` + `@Setter` + `@NoArgsConstructor` riêng — **không `@Data`** (vòng lặp lazy-load).
- Controller: luôn `@Valid` trên `@RequestBody`/`@ModelAttribute`. Exception xử lý tập trung qua `@ControllerAdvice` — không try/catch format response trong controller.
- Service: không validate lại cái Bean Validation đã check ở boundary.

Chi tiết: [AGENTS.md](AGENTS.md) §7.

---

## Phong cách trả lời

User là **chủ shop / quản lý vận hành**, không phải lập trình viên.

- **Ngắn gọn nhưng đầy đủ ý** — trả lời thẳng trọng tâm; không lan man, không lặp ý, không giải thích thứ user không hỏi; mỗi câu mang thông tin.
- **Ngôn ngữ business, hạn chế tối đa từ kỹ thuật/chuyên ngành** — giải thích theo việc kinh doanh (sản phẩm, đơn hàng, tồn kho, khách hàng, trang web…); không tên class/method/endpoint/stack trace. Buộc phải nhắc khái niệm kỹ thuật → giải thích ngắn bằng ngôn ngữ thường.
- **Dễ đọc** — nhiều điểm thì dùng list/bảng/tiêu đề ngắn, không dồn đoạn văn dài.
- **Ngoại lệ:** chỉ dùng thuật ngữ kỹ thuật khi user rõ ràng là dev và hỏi trực tiếp về code/kiến trúc.

Chi tiết: [AGENTS.md](AGENTS.md) §5.7.

---

## Đọc thêm

Full operating rules: [AGENTS.md](AGENTS.md) — §2 Docs-First, §3 Reading Order, §4 Source of Truth, §5 Global Rules, §6 Frontend Stack, §7 Backend Stack, §14 File/Asset.
