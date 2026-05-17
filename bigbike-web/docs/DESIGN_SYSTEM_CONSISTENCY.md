# BigBike Web — Design System Consistency Rules

> Tài liệu luật chung cho toàn bộ UI của `bigbike-web`.
> Đây là **bản áp dụng (consistency contract)** — mọi page, layout, component mới
> phải tuân theo. Nguồn token gốc: [`styles/brand-tokens.css`](../styles/brand-tokens.css);
> nguồn quy tắc brand: [`STYLEGUIDE.md`](../STYLEGUIDE.md). Khi tài liệu này mâu thuẫn
> với `STYLEGUIDE.md`, `STYLEGUIDE.md` là canonical — sửa lại file này.
>
> Cập nhật: 2026-05-17.

---

## 0. Nguyên tắc nền tảng

1. **Token-first** — màu, font, spacing, radius, shadow phải lấy từ token. Không hardcode
   hex / px khi đã có token tương đương.
2. **Stack bắt buộc** — React + Tailwind CSS + Radix UI + shadcn/ui. UI viết bằng Tailwind
   utility thẳng trong `className`; không tạo class CSS mới khi Tailwind đủ.
3. **Light-first WP-parity** — nền trang trắng, chữ đen; chỉ header / footer / drawer /
   toast / media player giữ nền tối.
4. **Sharp industrial** — mọi component thường `radius = 0`; chỉ phần tử tròn thật sự
   (avatar, badge tròn, nút chat) dùng `rounded-full`.
5. **Tiếng Việt đủ dấu, UTF-8** — không mojibake (`ThÃ nh toÃ¡n`), không "viet khong dau".

---

## 1. Color System

Tất cả màu tham chiếu qua token trong [`brand-tokens.css`](../styles/brand-tokens.css)
hoặc Tailwind utility map trong `globals.css` (`@theme inline`).

### 1.1 Bảng màu ngữ nghĩa

| Vai trò | Token CSS | Tailwind utility | Giá trị |
|---|---|---|---|
| Primary / CTA chính | `--bb-brand-primary` | `bg-primary` `text-primary` | `#ff0c09` |
| Primary hover | `--bb-brand-primary-hover` | `bg-brand-hover` | `#e50a07` |
| Primary active | `--bb-brand-primary-active` | `bg-brand-active` | `#cc0906` |
| Secondary / link phụ | `--bb-color-blue` | `text-blue` `bg-blue` | `#007bff` |
| Background trang | `--bb-bg-page` | `bg-background` | `#ffffff` |
| Surface (card, panel) | `--bb-bg-surface` | `bg-card` | `#ffffff` |
| Surface raised | `--bb-bg-surface-raised` | `bg-secondary` | `#f5f5f5` |
| Surface hover (light) | `--bb-bg-surface-hover` | `bg-accent` | `#fff4f3` |
| Surface tối (header/footer) | `--bb-bg-surface-dark` | — | `#141414` |
| Border subtle (mặc định) | `--bb-border-subtle` | `border-border` | `#dddddd` |
| Border default | `--bb-border-default` | — | `#cecece` |
| Border strong | `--bb-border-strong` | — | `#abb8c3` |
| Text primary | `--bb-text-primary` | `text-foreground` | `#000000` |
| Text secondary | `--bb-text-secondary` | `text-muted-foreground` | `#6f6f6f` |
| Text muted | `--bb-text-muted` | `text-muted-foreground` | `#6f6f6f` |
| Text inverse (trên nền tối) | `--bb-text-inverse` | `text-white` | `#ffffff` |

### 1.2 Màu trạng thái

| Trạng thái | BG token | Border token | Text token |
|---|---|---|---|
| Danger / error | `--bb-state-danger-bg` | `--bb-state-danger-border` | `--bb-brand-primary` |
| Warning | `--bb-state-warning-bg` | `--bb-state-warning-border` | `--bb-state-warning-text` |
| Success | `--bb-state-success-bg` | `--bb-state-success-border` | `--bb-state-success-text` |
| Info | — | — | `--bb-state-info` (`#007bff`) |

### 1.3 Màu theo state tương tác

| State | Quy tắc |
|---|---|
| Hover (CTA đỏ) | nền `--bb-brand-primary-hover`, có thể `scale-[1.02]` |
| Active (CTA đỏ) | nền `--bb-brand-primary-active` |
| Disabled | `opacity-60`, không transform, `cursor-not-allowed` |
| Focus | ring xanh `--bb-focus-ring` (`0 0 0 3px rgba(0,123,255,0.1)`) hoặc `outline` 2px `--bb-color-blue` |

### 1.4 Cấm

- ❌ Hardcode hex trong JSX (`bg-[#abc]`) khi đã có token. **Ngoại lệ duy nhất:** màu
  thương hiệu của nền tảng thứ ba trên nút share (Facebook `#1877f2`, Zalo `#0068ff`) —
  các màu này không thuộc palette BigBike và không có token; được phép giữ nhưng phải
  kèm comment ghi rõ là brand color của nền tảng.
- ❌ Tailwind built-in color (`bg-red-500`, `text-blue-600`).
- ❌ Chữ contrast yếu: không dùng `--bb-text-muted` (#6f6f6f) trên nền xám đậm hơn
  `#eeeeef` — fail WCAG AA. Trên nền `gray-100` trở lên phải dùng `#4a4a4a`.

---

## 2. Typography System

### 2.1 Font family

| Vai trò | Token | Tailwind | Font |
|---|---|---|---|
| Body / link / UI text | `--bb-font-body` | `font-body` | Barlow |
| Heading / product title / CTA | `--bb-font-heading` | `font-heading` | Oswald |
| Nav / button / display dày đặc | `--bb-font-cta` | `font-cta` | Barlow Condensed |

Không import font ngoài 3 font trên.

### 2.2 Type scale

| Vai trò | Size token | Weight | Line height | Ghi chú |
|---|---|---|---|---|
| Display / hero | `--bb-text-hero` (30px, mobile 18px) | 700 | 1.5 | Barlow Condensed |
| H1 | `--bb-text-h1` (32px, mobile 20px) | 600 | 1.5 | |
| H2 | `--bb-text-h2` (24px) | 600 | 1.5 | |
| H3 / card title | `--bb-text-h3` (18px) | 600 | tight | Oswald, uppercase |
| Body | `--bb-text-base` (16px) | 400 | 1.5 | |
| Button / CTA | 16px | 600 | 24px | uppercase |
| Small / helper | `--bb-text-sm` (14px) | 400 | 1.5 | |
| Meta / badge | `--bb-text-xs` (12px) | 700 | 1 | uppercase |

### 2.3 Quy tắc

- **Heading, nav, badge, CTA, card title → UPPERCASE.** Body text → sentence case.
- Heading dùng weight `600` (semibold), không `700` cho heading thường.
- Không letter-spacing âm.
- Không render chữ trắng < 16px trên nền tối (trừ meta phụ màu `#cecece`).
- Label form: `font-body`, 14px, weight 600. Helper text: 14px, `text-muted-foreground`.
  Error text: 14px, `text-destructive`.
- **Heading hierarchy** phải đúng cấp: trang có đúng 1 `<h1>`; section dùng `<h2>`;
  card / block con dùng `<h3>`. Không nhảy cấp chỉ để lấy size — dùng class size thay vì
  đổi tag.

---

## 3. Spacing System

Thang spacing thống nhất — bội số 4px: `4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64`.
Trong Tailwind: `1 / 2 / 3 / 4 / 5 / 6 / 8 / 10 / 12 / 16`.

| Ngữ cảnh | Padding / gap chuẩn |
|---|---|
| Page padding | mobile 16px (`px-4`), tablet 24px (`px-6`), desktop 32px (`px-8`) — dùng `.bb-container` |
| Section spacing dọc | desktop 72px, tablet 52px, mobile 32px (`--bb-section-y`) |
| Card padding | 20px (`p-5`) — đồng bộ với `CardHeader/Content/Footer` |
| Form: gap giữa field | 16px (`gap-4`) |
| Modal padding | 24px (`p-6`) |
| Table cell padding | 8px–12px (`px-3 py-2`) |
| Gap giữa item trong list/grid | 16–24px (`gap-4` … `gap-6`) |

**Cấm:** arbitrary px (`p-[17px]`, `gap-[14px]`) khi step Tailwind đã đủ. Giá trị px
arbitrary chỉ chấp nhận khi **bám pixel WP-parity** có chủ đích — khi đó phải nhất quán
trong cùng cụm component, không tùy tiện mỗi chỗ một số.

---

## 4. Radius / Shadow / Border System

### 4.1 Radius — sharp industrial

| Phần tử | Radius |
|---|---|
| Button, input, card, modal, dropdown, badge thường | `0` (`rounded-none`) |
| Avatar, nút chat, badge tròn, dot | `rounded-full` |

Token `--bb-radius-*` đều = `0`. **Không dùng** `rounded-sm/md/lg/xl`.

### 4.2 Shadow

| Cấp | Token | Dùng cho |
|---|---|---|
| none | `--bb-shadow-sm` (none) | card ở trạng thái nghỉ |
| md | `--bb-shadow-md` | dropdown nhẹ |
| lg | `--bb-shadow-lg` | modal, popover nổi |
| product | `--bb-shadow-product` | product card khi hover (đỏ nhẹ) |
| dropdown | `--bb-shadow-dropdown` | menu, popover |

Card mặc định **không shadow**. Shadow chỉ xuất hiện khi hover (product card) hoặc khi
phần tử thật sự nổi trên nền (modal, dropdown).

### 4.3 Border

- Màu mặc định: `border-border` (`#dddddd`).
- Độ dày: `1px` cho card / input / divider; `2px` cho secondary button và border nhấn.
- Không dùng border đậm hơn `--bb-border-strong` cho phần tử thường.

---

## 5. Layout / Grid Rules

| Mục | Quy tắc |
|---|---|
| Container | tối đa `1200px`, canh giữa — dùng `.bb-container` |
| Page padding | mobile 16 / tablet 24 / desktop 32 (đã gắn trong `.bb-container`) |
| Product grid | desktop 3 cột, tablet 2 cột, mobile 1 cột |
| Section spacing | desktop 72 / tablet 52 / mobile 32 (`--bb-section-y`) |
| Touch target | tối thiểu `44px` |

### 5.1 Breakpoints

| Range | Hành vi |
|---|---|
| 320–575px | 1 cột, padding 16, hero 18px |
| 576–767px | 2 cột nhẹ, padding 24 |
| 768–991px | 2 cột tablet, padding 24 |
| 992px+ | 3 cột / sidebar, padding 32 |
| 1200px+ | container canh giữa 1200px |

### 5.2 Table overflow

- Mọi table phải bọc trong wrapper `overflow-x-auto` để không vỡ layout trên mobile.
- Hoặc đổi sang dạng card list (`MobileCardList`-style) ở breakpoint < 768px.
- Không để table tràn ngang trang gây horizontal scroll toàn page.

---

## 6. Component State Rules

Mọi component tương tác phải định nghĩa rõ các state sau:

| State | Yêu cầu |
|---|---|
| Default | màu / spacing / border theo token |
| Hover | feedback rõ (đổi nền / border / màu); **không gây layout shift** |
| Active | đổi màu đậm hơn hover |
| Focus | `focus-visible` ring xanh rõ — bắt buộc cho keyboard nav |
| Disabled | `opacity-60`, `cursor-not-allowed`, không transform, không hover effect |
| Loading | hiển thị spinner / skeleton; disable action; giữ kích thước cố định |
| Empty | dùng `EmptyState` — có title + mô tả + hành động gợi ý |
| Error | dùng `ErrorState` — có title + thông điệp + nút thử lại |
| Success | feedback rõ (toast / inline message / UI cập nhật ngay) |

**Quy tắc chống layout shift:** hover/loading không được đổi kích thước phần tử. Button
khi loading giữ nguyên width — thay label bằng spinner, không thu/giãn.

### 6.1 Buttons (`components/ui/button.tsx`)

- Variant chuẩn: `primary` / `secondary` / `outline` / `dark` / `ghost` / `link` /
  `destructive`. Không tự chế variant rời rạc trong từng màn hình.
- Size: `sm` (36px) / `md` (44px) / `lg` (52px) / `icon` (44×44). Mặc định `md`.
- Button cùng chức năng ở các màn hình khác nhau phải dùng cùng `variant` + `size`.
- Action chính của một màn hình / modal: đúng **một** `primary`.

### 6.2 Inputs (`components/ui/input.tsx`)

- Luôn có `<label>` gắn `htmlFor`. Field bắt buộc đánh dấu rõ (dấu `*` hoặc chữ "bắt buộc").
- Error: set `aria-invalid` → tự đổi border đỏ + nền `accent`; kèm error text 14px đỏ.
- Disabled / read-only: `opacity-60`, không cho focus.

### 6.3 Cards

- Dùng `Card` từ `components/ui/card.tsx`: nền trắng, border `1px`, radius `0`, không
  shadow khi nghỉ, padding `p-5`.
- Card clickable: thêm hover (border đỏ + shadow product) và toàn card là click target.
- Không nhồi quá nhiều thông tin / quá nhiều CTA trong một card.

### 6.4 Tables / Lists

- Header dễ đọc (`bg-secondary`, weight 600). Có đủ empty / loading / error state.
- Row action rõ ràng — phân biệt view / edit / delete bằng icon + nhãn, không để user nhầm.
- Pagination dùng `PaginationNav`. Overflow ngang xử lý theo §5.2.

### 6.5 Modal / Dialog

- Dùng `Dialog` (shadcn/Radix) — có focus trap, ESC để đóng.
- Title rõ; description đủ ngữ cảnh.
- Thứ tự action: primary bên phải, secondary/cancel bên trái.
- Danger action (xóa) phải có cảnh báo rõ + nút màu `destructive`.

### 6.6 Toast / Alert

- Phân biệt rõ success / error / warning / info bằng màu state ở §1.2.
- Message ngắn, có nghĩa. Không spam nhiều toast cho một hành động.

---

## 7. Navigation UX Rules

| Mục | Quy tắc |
|---|---|
| Active menu | menu / nav item phản ánh đúng route hiện tại (màu đỏ + underline đỏ) |
| Breadcrumb | trang chi tiết sâu nên có breadcrumb; mỗi cấp click được, cấp cuối không link |
| Back | không phá state khi browser back; deep-link vào route phải hoạt động |
| Mobile nav | drawer dễ thao tác, touch target ≥ 44px, đóng được rõ ràng |
| Redirect sau action | tạo mới → về trang chi tiết hoặc danh sách có item mới; cập nhật → ở lại detail; xóa → về danh sách đã loại item |
| Route cần quyền | chưa đăng nhập → chuyển trang đăng nhập kèm `returnUrl`; không đủ quyền / dữ liệu không tồn tại → trang trạng thái rõ ràng, không 404 trắng |
| Dead-end | mọi trạng thái cuối (empty, success, error) phải có hành động tiếp theo rõ |

---

## 8. UI State Update UX Rules

| Quy tắc | Chi tiết |
|---|---|
| Loading sau submit | mọi form submit phải có loading state; disable nút submit khi đang gửi |
| Chống double submit | nút submit disable trong lúc request chạy — không cho bấm nhiều lần tạo duplicate request |
| Success | sau khi thành công phải cập nhật UI ngay, hoặc refetch có kiểm soát; có feedback rõ (toast / message) |
| Error | hiển thị message lỗi rõ ràng, cho biết lỗi gì và cách xử lý |
| Confirm | hành động xóa / hủy dữ liệu quan trọng phải có bước xác nhận |
| Optimistic update | chỉ dùng khi rollback được khi lỗi |
| Empty state | phải có hướng dẫn hành động tiếp theo, không để màn hình trống vô nghĩa |
| Stale UI | sau create / update / delete, UI không được hiển thị dữ liệu cũ; count / list phải đồng bộ |
| Flicker | tránh nhấp nháy — dùng skeleton thay vì spinner trắng toàn trang khi có thể |
| Giữ dữ liệu form | navigate trong flow không được làm mất dữ liệu form ngoài ý muốn |

---

## Checklist khi tạo / sửa UI

Trước khi ship một page / component:

- [ ] Màu / font / spacing / radius / shadow lấy từ token, không hardcode.
- [ ] Dùng component dùng chung trong `components/ui` & `components/layout` thay vì tạo mới.
- [ ] Có đủ state: default / hover / focus / disabled / loading / empty / error.
- [ ] Responsive đúng ở mobile / tablet / desktop, không overflow ngang.
- [ ] Focus-visible rõ; thao tác được bằng bàn phím; có `aria-label` khi cần.
- [ ] Action async có loading + chống double submit + feedback success/error.
- [ ] Tiếng Việt đủ dấu, file UTF-8, không mojibake.
- [ ] Nhìn như cùng một hệ thống thiết kế — không lệch chuẩn so với màn hình khác.
