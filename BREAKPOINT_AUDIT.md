# Thống Kê Breakpoint — Toàn Dự Án BigBike

> **Phạm vi:** `bigbike-web` (Next.js) và `bigbike-admin` (React + Vite)  
> **Nguồn:** CSS files, JSX/TSX files, Tailwind config  
> **Ngày audit:** 2026-05-30

---

## 1. Tổng Quan Nhanh

| | bigbike-web | bigbike-admin |
|---|---|---|
| Tailwind version | v4 (via PostCSS) | v4 (via @tailwindcss/vite) |
| Custom Tailwind breakpoints | `3xl` (1920px), `4xl` (2560px) | Không có |
| Tailwind breakpoints dùng trong JSX | `sm md lg xl 2xl 3xl 4xl max-sm max-md` | `sm md lg` |
| Tổng `@media` rules trong CSS | ~110 | ~41 |
| Unique `@media` conditions | ~35 | ~13 |
| Feature queries | `prefers-reduced-motion`, `hover`, `pointer` | `prefers-reduced-motion` |

---

## 2. bigbike-web

### 2.1 Tailwind Breakpoints — Cấu Hình

**File config:** Không có `tailwind.config.js` riêng — dùng Tailwind v4 với `@theme inline` trong `globals.css`.

**Breakpoints mặc định của Tailwind v4** (áp dụng cho prefix `sm:`, `md:`, v.v.):

| Prefix | min-width |
|---|---|
| `sm:` | 640px |
| `md:` | 768px |
| `lg:` | 1024px |
| `xl:` | 1280px |
| `2xl:` | 1536px |

**Custom breakpoints thêm vào `@theme` trong `globals.css`:**

```css
--breakpoint-3xl: 120rem;  /* 1920px — Full HD ultrawide, 27"+ monitor */
--breakpoint-4xl: 160rem;  /* 2560px — QHD/4K workstation, showroom TV */
```

---

### 2.2 Tailwind Prefix — Sử Dụng Trong JSX/TSX

Tổng hợp từ `app/` và `components/`:

| Prefix | Breakpoint | Tổng lượt dùng | File dùng chính |
|---|---|---|---|
| `sm:` | ≥ 640px | ~32 | `components/ui/`, `app/not-found.tsx`, `dialog.tsx` |
| `md:` | ≥ 768px | ~86 | `components/catalog/`, `components/layout/`, nhiều app pages |
| `lg:` | ≥ 1024px | ~15 | `Skeletons.tsx`, `lien-he/page.tsx`, `catalog/` |
| `xl:` | ≥ 1280px | ~28 | `app/` pages, `components/layout/` |
| `2xl:` | ≥ 1536px | ~6 | `Skeletons.tsx`, `gioi-thieu/page.tsx` |
| `3xl:` | ≥ 1920px | ~13 | `PageHero.tsx`, `SiteFooter.tsx`, `tin-tuc/loading.tsx` |
| `4xl:` | ≥ 2560px | ~13 | `PageHero.tsx`, `SiteFooter.tsx`, `tin-tuc/loading.tsx` |
| `max-sm:` | < 640px | ~2 | `WarrantyContent.tsx`, `doi-tra/page.tsx` |
| `max-md:` | < 768px | ~10 | `FooterCollapsible.tsx`, `ArticleCarousel.tsx`, `SiteFooter.tsx` |

> **Không dùng:** `max-lg:`, `max-xl:`, `max-2xl:`

---

### 2.3 `@media` Trong CSS — Toàn Bộ Unique Conditions

**File nguồn:** `globals.css` (110+ rules), `brand-tokens.css`, `home-news-parity.css`

#### Min-width breakpoints

| Breakpoint | Số lần dùng | File |
|---|---|---|
| `min-width: 430px` | 1 (trong range) | `globals.css` |
| `min-width: 576px` | ~7 | `globals.css`, `brand-tokens.css` |
| `min-width: 600px` | 2 (trong range) | `globals.css` |
| `min-width: 640px` | 2 | `globals.css` |
| `min-width: 768px` | ~18 | `globals.css` (block lớn nhất) |
| `min-width: 992px` | 4 | `globals.css` |
| `min-width: 1024px` | 4 | `globals.css` |
| `min-width: 1200px` | 1 | `globals.css` |
| `min-width: 1280px` | 1 | `globals.css` |
| `min-width: 1536px` | 4 | `globals.css` |
| `min-width: 1920px` | 6 | `globals.css`, `home-news-parity.css` |
| `min-width: 2560px` | 9 | `globals.css`, `home-news-parity.css` |

#### Max-width breakpoints

| Breakpoint | Số lần dùng | File | Ghi chú |
|---|---|---|---|
| `max-width: 374px` | 2 | `globals.css` | Màn hình rất nhỏ (iPhone SE cũ) |
| `max-width: 419px` | 1 | `globals.css` | |
| `max-width: 430px` | 2 | `globals.css` | iPhone 14/15 Plus |
| `max-width: 480px` | 1 | `globals.css` | |
| `max-width: 500px` | 1 | `globals.css` | |
| `max-width: 575px` | 3 | `globals.css` | |
| `max-width: 576px` | 1 | `brand-tokens.css` | |
| `max-width: 600px` | 7 | `globals.css` | Block dày nhất sau 767px |
| `max-width: 639px` | 2 | `globals.css` | |
| `max-width: 767px` | ~22 | `globals.css`, `brand-tokens.css` | **Block nhiều nhất toàn file** |
| `max-width: 768px` | 4 | `globals.css` | |
| `max-width: 900px` | 2 | `globals.css` | |
| `max-width: 991px` | 1 | `globals.css` | |
| `max-width: 1023px` | 1 | `globals.css` | |
| `max-width: 1024px` | 2 | `globals.css` | |
| `max-width: 1260px` | 3 | `globals.css` | |

#### Range breakpoints (min + max kết hợp)

| Condition | Dòng | File |
|---|---|---|
| `(min-width: 430px) and (max-width: 599px)` | 14309 | `globals.css` |
| `(min-width: 576px) and (max-width: 991px)` | 414 | `brand-tokens.css` |
| `(min-width: 600px) and (max-width: 767px)` | 14315 | `globals.css` |
| `(min-width: 600px) and (max-width: 1023px)` | 4462 | `globals.css` |
| `(min-width: 640px) and (max-width: 1023px)` | 6278 | `globals.css` |
| `(min-width: 768px) and (max-width: 991px)` | 133 | `home-news-parity.css` |
| `(min-width: 768px) and (max-width: 1023px)` | 11084 | `globals.css` |
| `(min-width: 768px) and (max-width: 1260px)` | 1877, 2135 | `globals.css` |

#### Feature queries (không phải kích thước)

| Condition | Số lần dùng | Mục đích |
|---|---|---|
| `(prefers-reduced-motion: reduce)` | 10 | Tắt animation cho user có nhu cầu |
| `(hover: none), (pointer: coarse)` | 1 | Touch device — ẩn hover effect |
| `(pointer: coarse), (max-width: 768px)` | 1 | Touch hoặc mobile — cursor lớn hơn |

#### Container width scale (token `--bb-container-xl`)

| Breakpoint | Container max-width |
|---|---|
| Default | `75rem` (1200px) |
| `min-width: 1536px` | `85rem` (1360px) |
| `min-width: 1920px` | `100rem` (1600px) |
| `min-width: 2560px` | `140rem` (2240px) |

---

## 3. bigbike-admin

### 3.1 Tailwind Breakpoints — Cấu Hình

**File config:** Không có `tailwind.config.js` — dùng Tailwind v4 qua `@tailwindcss/vite` plugin (khai báo trong `vite.config.js`).

**Breakpoints mặc định Tailwind v4** (không custom thêm):

| Prefix | min-width |
|---|---|
| `sm:` | 640px |
| `md:` | 768px |
| `lg:` | 1024px |
| `xl:` | 1280px |
| `2xl:` | 1536px |

---

### 3.2 Tailwind Prefix — Sử Dụng Trong JSX/TSX

| Prefix | Breakpoint | Tổng lượt dùng | File dùng chính |
|---|---|---|---|
| `sm:` | ≥ 640px | ~10 | `dialog.jsx`, `CustomerDetailScreen.jsx`, `PosScreen.jsx` |
| `md:` | ≥ 768px | ~16 | `GlobalSearch.jsx`, `ContentDetailScreen.jsx`, `ProductDetailScreen.jsx` |
| `lg:` | ≥ 1024px | ~2 | `CustomerDetailScreen.jsx`, `button.jsx` |

> **Không dùng:** `xl:`, `2xl:`, `3xl:`, `4xl:`, `max-sm:`, `max-md:`, `max-lg:`

---

### 3.3 `@media` Trong CSS — Toàn Bộ Unique Conditions

**File nguồn:** `index.css`, `admin-layout.css`, `admin-prototype.css`

**Chính sách breakpoint của admin** (từ comment trong `admin-layout.css`):

| Nhóm | Breakpoint | Hành vi |
|---|---|---|
| xs / mobile | < 640px | Card thay table, filter stacked, grid collapse |
| Tablet | < 900px | Sidebar drawer + hamburger |
| Compact sidebar | 901px–1200px | Sidebar icon-only 64px |
| Desktop | ≥ 1201px | Sidebar full 260px |
| Large desktop | ≥ 1280px | Content area 972px |
| Wide desktop | ≥ 1536px | Content area 1228px |
| Ultra-wide | ≥ 1920px | max-width mở rộng 1700px |

#### Min-width breakpoints

| Breakpoint | Số lần dùng | File |
|---|---|---|
| `min-width: 641px` (trong range) | 1 | `index.css` |
| `min-width: 901px` (trong range) | 1 | `index.css` |
| `min-width: 1400px` | 1 | `admin-prototype.css` |
| `min-width: 1920px` | 1 | `index.css` |

#### Max-width breakpoints

| Breakpoint | Số lần dùng | File | Ghi chú |
|---|---|---|---|
| `max-width: 400px` | 1 | `index.css` | Màn hình rất nhỏ |
| `max-width: 480px` | 3 | `index.css` | Mobile nhỏ |
| `max-width: 640px` | 9 | `index.css`, `admin-layout.css`, `admin-prototype.css` | **Threshold chính của admin** |
| `max-width: 720px` | 3 | `index.css`, `admin-layout.css` | |
| `max-width: 760px` | 1 | `index.css` | |
| `max-width: 900px` | 10 | `index.css`, `admin-prototype.css` | **Threshold tablet của admin** |
| `max-width: 960px` (trong range) | 1 | `index.css` | |
| `max-width: 1024px` | 2 | `admin-layout.css`, `admin-prototype.css` | |
| `max-width: 1100px` | 1 | `index.css` | |
| `max-width: 1200px` (trong range) | 1 | `index.css` | |

#### Range breakpoints

| Condition | File |
|---|---|
| `(min-width: 641px) and (max-width: 960px)` | `index.css` |
| `(min-width: 901px) and (max-width: 1200px)` | `index.css` |

#### Feature queries

| Condition | Số lần dùng | Mục đích |
|---|---|---|
| `(prefers-reduced-motion: reduce)` | 1 | Tắt animation |

---

## 4. Tổng Hợp So Sánh Hai Project

### 4.1 Breakpoint nào dùng ở cả hai project

| Breakpoint | bigbike-web | bigbike-admin | Ghi chú |
|---|---|---|---|
| 640px | ✅ (CSS + Tailwind sm:) | ✅ (CSS threshold chính) | Aligned |
| 768px | ✅ (CSS nhiều nhất, Tailwind md:) | ✅ (Tailwind md:) | Aligned |
| 1024px | ✅ (CSS + Tailwind lg:) | ✅ (CSS + Tailwind lg:) | Aligned |
| 1920px | ✅ (CSS + custom 3xl:) | ✅ (CSS max-width expand) | Aligned |

### 4.2 Breakpoint chỉ dùng trong bigbike-web

| Breakpoint | Lý do |
|---|---|
| 374px, 419px, 430px, 480px, 500px | WP-parity mobile edge cases |
| 575px / 576px | Bootstrap legacy (≈ Tailwind sm nhưng -1px) |
| 600px (7 lần) | WP-parity — threshold riêng cho cart/checkout |
| 639px | Trước Tailwind sm |
| 767px (22 lần) | **WP-parity mobile** — dùng nhiều nhất trong web |
| 900px | WP-parity tablet |
| 991px / 992px | Bootstrap md (≈ Tailwind lg nhưng sớm hơn) |
| 1023px | Trước Tailwind lg |
| 1200px | Bootstrap xl / WP container |
| 1260px | WP-parity container width cụ thể |
| 1280px | Tailwind xl trong CSS thuần |
| 1536px | Tailwind 2xl trong CSS thuần |
| 2560px (9 lần) | Custom 4xl — showroom TV / ultra-wide |

### 4.3 Breakpoint chỉ dùng trong bigbike-admin

| Breakpoint | Lý do |
|---|---|
| 400px | Màn hình rất nhỏ (admin mobile edge case) |
| 720px / 760px | Admin-specific tablet intermediate |
| 900px | **Tablet threshold chính của admin** — sidebar collapse |
| 1100px | Admin content area intermediate |
| 1200px | Compact sidebar → full sidebar transition |
| 1400px | Admin-prototype legacy max-width |
| 641px–960px range | Compact sidebar range |
| 901px–1200px range | Icon-only sidebar range |

---

## 5. Phát Hiện & Vấn Đề

### 5.1 bigbike-web: hai hệ breakpoint chạy song song

CSS trong `globals.css` dùng **hệ WP-parity** (767px, 600px, 575px, 991px, 1260px...) — lấy từ Bootstrap/WordPress cũ — chạy song song với **hệ Tailwind** (640px, 768px, 1024px, 1280px, 1536px). Hai hệ không aligned:

| WP-parity (CSS) | Tailwind tương ứng | Chênh lệch |
|---|---|---|
| `max-width: 767px` | `max-md:` (< 768px) | 1px — về cơ bản giống |
| `max-width: 575px` | `max-sm:` (< 640px) | **65px** |
| `min-width: 992px` | `lg:` (≥ 1024px) | **32px** |
| `max-width: 991px` | `max-lg:` (< 1024px) | **33px** |
| `min-width: 1200px` | `xl:` (≥ 1280px) | **80px** |

### 5.2 bigbike-web: `max-width: 767px` vs `max-width: 768px`

Cả hai đều tồn tại trong `globals.css` (lần lượt 22 lần và 4 lần) với ý nghĩa gần giống nhau. Tại viewport 768px đúng, behaviour không nhất quán:
- Rules dùng `max-width: 767px` → **không apply** tại 768px
- Rules dùng `max-width: 768px` → **apply** tại 768px

### 5.3 bigbike-admin: 900px là threshold thực tế, không phải 768px

Admin dùng `max-width: 900px` (10 lần) làm ngưỡng tablet chính — không align với Tailwind `md:` (768px). Sidebar collapse xảy ra ở 900px, nhưng JSX dùng Tailwind `md:` (768px) cho logic hiển thị → có thể gây gap giữa 768px–900px.

### 5.4 bigbike-web: feature query `(pointer: coarse)` kết hợp với `(max-width: 768px)`

```css
@media (pointer: coarse), (max-width: 768px) { ... }
```
Rule này áp dụng cho **cả** touch device (tablet lớn, surface, iPad) **lẫn** desktop nhỏ — có thể áp dụng ngoài ý muốn trên màn hình 768px không phải touch.

### 5.5 Breakpoints "one-off" không có tên/token

Các giá trị như `374px`, `419px`, `430px`, `480px`, `500px`, `900px`, `1260px` không được định nghĩa thành token hay tên có nghĩa — chỉ là magic numbers trong CSS. Khó maintenance.

---

## 6. Chỉ Số Tổng Hợp

### bigbike-web

| Chỉ số | Giá trị |
|---|---|
| Tổng `@media` rules trong CSS | ~115 |
| Unique breakpoint values (px) | **18 giá trị** |
| Tailwind prefix variants dùng trong JSX | 9 (sm, md, lg, xl, 2xl, 3xl, 4xl, max-sm, max-md) |
| Feature queries | 3 loại |
| Range queries | 8 conditions |

### bigbike-admin

| Chỉ số | Giá trị |
|---|---|
| Tổng `@media` rules trong CSS | ~41 |
| Unique breakpoint values (px) | **12 giá trị** |
| Tailwind prefix variants dùng trong JSX | 3 (sm, md, lg) |
| Feature queries | 1 loại |
| Range queries | 2 conditions |
