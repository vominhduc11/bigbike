# DESIGN SYSTEM CONSISTENCY — bigbike-admin

> Luật chung cho toàn bộ UI của `bigbike-admin`. Mọi screen, component, form, table
> phải tuân theo tài liệu này. Khi tài liệu này mâu thuẫn với code, **tài liệu thắng** —
> code cần sửa.
>
> Nguồn token: [`bigbike-admin/src/styles/admin-tokens.css`](../bigbike-admin/src/styles/admin-tokens.css)
> — đây là source of truth. Tài liệu này chỉ mô tả lại và đặt luật sử dụng.

---

## 0. Kiến trúc style — cách hệ thống được lắp

```
admin-tokens.css   → biến CSS gốc (--admin-color-*, --admin-space-*, …) + dark mode
        ↓
index.css          → map token sang shadcn (--background, --primary…) + @theme inline
        ↓ + admin-layout.css (class layout dùng chung: .screen, .admin-table, .filter-bar…)
        ↓
JSX                → Tailwind utility (bg-primary, text-muted-foreground…) HOẶC class index.css
```

**Quy tắc nền tảng:**
- Không bao giờ hardcode màu / spacing / radius / shadow. Luôn đi qua token.
- Component tương tác (button, input, dialog, select…) → dùng shadcn trong `components/ui/`.
- Layout lặp lại (screen shell, table, filter bar, form) → dùng class trong `index.css` /
  `admin-layout.css` hoặc layout component trong `components/layout/`.
- Style động (theo runtime: progress %, depth padding, grid template) → cho phép inline
  `style={{}}` nhưng giá trị màu vẫn phải là token `var(--admin-...)`.

---

## 1. Color System

Tất cả màu lấy từ `admin-tokens.css`. **Cấm** hardcode hex và **cấm** Tailwind built-in
color (`bg-red-500`, `text-blue-600`).

### 1.1 Brand
| Vai trò | Token | Tailwind |
|---|---|---|
| Primary | `--admin-color-brand-red` | `bg-primary`, `text-primary` |
| Primary hover | `--admin-color-brand-red-hover` | (qua `hover:opacity-90`) |
| Primary active | `--admin-color-brand-red-active` | (qua `active:opacity-80`) |
| Primary subtle nền | `--admin-color-brand-red-subtle` | `bg-accent` |

### 1.2 Background / Surface
| Vai trò | Token |
|---|---|
| App background | `--admin-color-background-app` |
| Page background | `--admin-color-background-page` |
| Sidebar | `--admin-color-background-sidebar` |
| Surface base (card, panel) | `--admin-color-surface-base` → `bg-card` |
| Surface muted | `--admin-color-surface-muted` → `bg-muted` |
| Surface raised (KPI, popover) | `--admin-color-surface-raised` |
| Surface hover | `--admin-color-surface-hover` → `bg-surface-hover` |
| Surface selected | `--admin-color-surface-selected` → `bg-accent` |
| Overlay (modal) | `--admin-color-overlay` |

### 1.3 Border
| Vai trò | Token |
|---|---|
| Subtle (mặc định, divider) | `--admin-color-border-subtle` → `border-border` |
| Default (input, control) | `--admin-color-border-default` |
| Strong (nhấn) | `--admin-color-border-strong` |

### 1.4 Text
| Vai trò | Token |
|---|---|
| Primary | `--admin-color-text-primary` → `text-foreground` |
| Secondary | `--admin-color-text-secondary` |
| Muted | `--admin-color-text-muted` → `text-muted-foreground` |
| Placeholder | `--admin-color-text-placeholder` |
| Inverse (chữ trên nền brand/đậm) | `--admin-color-text-inverse` |

### 1.5 Status (danger / warning / success / info / neutral)
Mỗi status có bộ 3 token `-bg` / `-border` / `-text`. Dùng `bg-*-bg border-*-border text-*`.

| Status | Tailwind |
|---|---|
| Danger | `bg-danger-bg border-danger-border text-danger` |
| Warning | `bg-warning-bg border-warning-border text-warning` |
| Warning orange | `--admin-color-status-warning-orange-*` |
| Success | `bg-success-bg border-success-border text-success` |
| Info | `bg-info-bg border-info-border text-info` |
| Neutral | `--admin-color-status-neutral-bg / -text` |

### 1.6 State của control
| State | Quy tắc |
|---|---|
| Hover | `hover:bg-surface-hover` cho control trung tính; `hover:opacity-90` cho nền màu đặc |
| Active | `active:opacity-80` |
| Focus | **Bắt buộc** `focus-visible:ring-2 focus-visible:ring-ring` — không xóa outline mà không thay focus ring |
| Disabled | `disabled:opacity-50 disabled:pointer-events-none` |

### 1.7 Charts (Recharts)
Recharts nhận chuỗi màu — **dùng `var(--admin-color-...)`** chứ không hex, để chart theo
dark mode. Trục/grid: `var(--admin-color-text-muted)`, `var(--admin-color-border-subtle)`.

---

## 2. Typography System

| Thuộc tính | Giá trị |
|---|---|
| Font body / UI | `--admin-font-body` = Inter / Exo |
| Font display (headline, uppercase) | `--admin-font-display` = Bungee |
| Font mono (mã, ID) | `--admin-font-mono` |

**Cấm import font ngoài danh sách** (không Barlow/Oswald — đó là của `bigbike-web`).

### Type scale
| Token | px | Dùng cho |
|---|---|---|
| `--admin-text-xs` | 12 | caption, helper, badge, table meta |
| `--admin-text-sm` | 14 | body phụ, input, table cell |
| `--admin-text-base` | 15 | body mặc định |
| `--admin-text-md` | 16 | label nhấn |
| `--admin-text-lg` | 17 | sub-heading |
| `--admin-text-xl` | 19 | heading section |
| `--admin-text-2xl` | 23 | tiêu đề screen (`h1`) |

### Heading hierarchy
- `h1` (screen title) — 1 cái duy nhất / screen, đi kèm `.eyebrow` + mô tả ngắn.
- `h2` — tiêu đề section / detail block.
- `h3` — tiêu đề card / subsection.
- Không nhảy cấp (h1 → h3). Không dùng heading chỉ để phóng to chữ.

### Font weight & line-height
- Weight: 400 body, 500 label, 600 heading/nút, 700 số liệu KPI. Không dùng 800/900.
- Line-height: 1.5 cho body, 1.2–1.3 cho heading.

### Label / helper / error text
- Label: `text-sm font-medium`, bắt buộc cho mọi input.
- Helper text: `text-xs text-muted-foreground`.
- Error text: `text-xs text-danger`.

---

## 3. Spacing System

Thang chuẩn (token `--admin-space-*`, hoặc Tailwind step 4px): **4 / 8 / 12 / 16 / 20 / 24 / 32 / 40** (mở rộng 48 / 64 khi cần).

| Ngữ cảnh | Padding / gap |
|---|---|
| Page content | 24 (`--admin-space-6`); mobile 16 |
| Section spacing (giữa các block) | 20–24 |
| Card padding | 16–20 |
| Form field gap | 16 (dọc), 12–16 (ngang) |
| Modal padding | 20–24 |
| Table cell padding | 8–12 |
| Filter bar gap | 8–12 |

**Cấm** arbitrary px (`p-[17px]`) khi step chuẩn đã đủ.

---

## 4. Radius / Shadow / Border

### Radius
| Token | px | Dùng cho |
|---|---|---|
| `--admin-radius-xs` | 4 | button (sm/md), input, badge, chip |
| `--admin-radius-sm` | 7 | button lg, card nhỏ, control gộp |
| `--admin-radius-md` | 10 | card, panel, KPI, chart card |
| `--admin-radius-lg` | 14 | modal, drawer |
| `--admin-radius-full` | — | avatar, dot, pill thực sự tròn |

Mặc định bo nhẹ — admin là giao diện dữ liệu, không bo tròn quá mức.

### Shadow
| Token | Dùng cho |
|---|---|
| `--admin-shadow-xs` | hover nhẹ, chip |
| `--admin-shadow-sm` | card, dropdown |
| `--admin-shadow-md` | popover, tooltip, toast |
| `--admin-shadow-lg` | modal, drawer |

Không tự chế box-shadow mới. Dark mode đã có shadow nặng hơn — không override.

### Border
- Mặc định `1px solid var(--admin-color-border-subtle)`.
- Input/control: `--admin-color-border-default`.
- Không dùng border 2px+ cho mục trang trí.

---

## 5. Layout / Grid

| Thuộc tính | Quy tắc |
|---|---|
| Screen shell | `.screen` + `.screen-header` (hoặc `<Screen>` / `<ScreenHeader>` trong `components/layout/`) |
| Page max-width | full width trong main content; content tự co theo sidebar |
| Section spacing | 20–24px dọc |
| Grid responsive | `repeat(auto-fit/auto-fill, minmax(Npx, 1fr))` — cho phép inline `gridTemplateColumns` |

### Breakpoints (theo `index.css`)
| Breakpoint | Hành vi |
|---|---|
| ≤1200px | Dashboard grid về 2 cột |
| ≤1100px | Sidebar thu gọn icon+text, padding chặt |
| ≤900px | Hamburger + sidebar dạng drawer; table → card list |
| ≤480px | KPI grid về 1 cột |

### Table overflow
- Mọi table bọc trong `.table-wrap` (overflow-x: auto).
- Trên mobile (≤900px): table ẩn, thay bằng `MobileCardList` / card list.
- Không để table tràn ngang gây scroll cả trang.

---

## 6. Component State Rules

Mọi component tương tác phải định nghĩa đủ 9 trạng thái:

| State | Yêu cầu |
|---|---|
| Default | Theo token, không hardcode |
| Hover | Feedback rõ, **không layout shift** (đổi màu/opacity, không đổi border-width/padding) |
| Active | `active:opacity-80` hoặc nền đậm hơn |
| Focus | `focus-visible:ring-2 ring-ring` — bắt buộc, cho keyboard nav |
| Disabled | `opacity-50` + `pointer-events-none` + con trỏ không cho click |
| Loading | Spinner / skeleton; disable action; **không double-submit** |
| Empty | `StatePanel` / empty state có icon + câu mô tả + hành động gợi ý |
| Error | `StatePanel tone="danger"` — nói rõ lỗi gì + cách xử lý |
| Success | Toast `sonner` + UI cập nhật ngay |

Loading/empty/error dùng component dùng chung `StatePanel`, không tự chế từng screen.

---

## 7. Navigation UX Rules

| Quy tắc | Chi tiết |
|---|---|
| Active menu state | Mục sidebar của route hiện tại phải highlight rõ (nền + chữ đậm) |
| Current route | Người dùng luôn biết đang ở đâu — qua sidebar active + tiêu đề screen |
| Back behavior | Detail screen có nút back về list; browser back không để lại state sai |
| Breadcrumb | Dùng cho screen lồng sâu (detail trong list); phản ánh đúng đường đi |
| Mobile nav | Hamburger mở drawer; tap mục → đóng drawer + điều hướng |
| Redirect sau action | Tạo mới → về detail của bản ghi vừa tạo (hoặc list nếu nghiệp vụ yêu cầu); Cập nhật → ở lại detail/edit; Xóa → về list |
| Guard route | Route thiếu quyền / chưa login → màn trạng thái rõ ràng, không trắng/404 bất ngờ |
| Deep link | Mở thẳng route detail phải load đúng dữ liệu, không vỡ |
| Dead-end | Mọi màn cụt phải có lối ra (nút về list / CTA tiếp theo) |

---

## 8. UI State Update UX Rules

| Quy tắc | Bắt buộc |
|---|---|
| Submit form | Có loading state; disable nút submit khi đang gửi |
| Chống double-submit | Nút disable trong lúc request chạy |
| Sau success | UI cập nhật ngay hoặc refetch có kiểm soát (React Query invalidate); không stale UI |
| Sau error | Hiển thị message rõ (toast hoặc inline), nói được lỗi gì |
| Delete dữ liệu quan trọng | Bắt buộc `ConfirmDialog` xác nhận |
| Optimistic update | Chỉ dùng khi rollback được |
| Empty state | Phải hướng dẫn hành động kế tiếp ("Chưa có … — bấm Thêm mới") |
| Không flicker | Tránh nhấp nháy khi chuyển loading → data; ưu tiên skeleton |
| Filter/search/sort/paginate | Mỗi thao tác phản hồi tức thì; giữ state khi quay lại |
| Form không mất dữ liệu | Không reset form ngoài ý muốn khi navigate / re-render |

---

## 9. Danh sách CẤM

- ❌ Hardcode hex màu khi token đã có.
- ❌ Tailwind built-in color (`bg-red-500`) thay token brand.
- ❌ Arbitrary value (`p-[17px]`, `text-[13px]`) khi step/token đã đủ.
- ❌ Import font ngoài Inter/Exo/Bungee.
- ❌ CSS module / `<style>` tag mới cho screen — dùng `index.css` class hoặc Tailwind.
- ❌ Native `<select>/<dialog>/<button>/<input type=checkbox>` khi shadcn đã có.
- ❌ Tạo component mới khi `components/`, `components/ui/`, `components/layout/` đã có tương đương.
- ❌ Xóa focus outline mà không thay focus ring.
- ❌ Layout shift khi hover/focus/loading.
- ❌ Mỗi screen tự quyết màu/font/spacing riêng.
