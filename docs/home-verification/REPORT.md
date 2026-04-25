# Homepage Verification Report

**Date:** 2026-04-25  
**Environment:** Next.js production build (`next start`) + Spring Boot (PostgreSQL, real migrated WP data)  
**Backend:** `http://localhost:8080` — Java 17, Spring Boot 4.0.5  
**Frontend:** `http://localhost:3000` — Next.js 16.2.4, ISR (`revalidate=60`)

> **Phương pháp:** Automated HTTP checks (curl + Node.js). Items **[MANUAL]** cần browser để verify.  
> Visual checks (hover states, carousel autoplay, DevTools mobile), Lighthouse, screenshots: xem mục cuối.

---

## Checklist — Sections

| # | Section | Status | Ghi chú |
|---|---------|--------|---------|
| 1 | Hero: 8 slides, ảnh banner curated | ❌ DATA | 0 sliders trong DB — section ẩn hoàn toàn |
| 2 | Hero: Hero Fallback khi slides=0 | ❌ BUG-01 | Fallback không render (xem BUG-01) |
| 3 | Hero: mobileSrc trên 375px | ⬜ MANUAL | |
| 4 | Featured tiles (3): tên SP, cat đỏ, "Mua ngay" | ❌ DATA | 0 products có `isFeatured=true` |
| 5 | Featured tiles: click → product page đúng | ⬜ MANUAL | |
| 6 | About: từ settings (`about_title/subtitle/content_html`) | ❌ DATA | 3 keys không có trong DB → fallback hardcoded |
| 7 | About: fallback stats ("13+ năm", "20K+", "50+") | ✅ PASS | Renders đúng |
| 8 | Carousel 5 SP: giá VND | ✅ PASS | 5 sản phẩm, `retailPrice` hiển thị |
| 9 | Carousel 5 SP: rating stars | ⬜ MANUAL | `rating=null` → component default 4.5; cần xem visual |
| 10 | Carousel 5 SP: SALE tag khi compare > price | ⬜ MANUAL | Logic đúng trong code; cần data có sale để verify visual |
| 11 | Category grid: top 8, sortOrder đúng | ❌ DATA | 0 categories có `showOnHomepage=true` |
| 12 | Category grid: hover overlay đỏ + arrow | ⬜ MANUAL | |
| 13 | Promo banner: ảnh nếu có `promo_image_url` | ❌ DATA | `promo_image_url=""` — image mode không render |
| 14 | Promo banner: text fallback (HOT OFFER) | ✅ PASS | Renders đúng với promo_title/promo_off từ settings |
| 15 | Experience: 3 bài cat `trai-nghiem` | ❌ DATA | 0 articles có category `trai-nghiem` |
| 16 | News: 3 bài cat `blog`, badge ngày j/n/Y | ❌ DATA | 0 articles có category `blog` |
| 17 | Brand carousel: 12 brands | ✅ PASS | 12 brands (AGV, Alpinestars, Apro…) |
| 18 | Brand carousel: hover full opacity | ⬜ MANUAL | |
| 19 | SEO content: H1 đúng | ✅ PASS | `<h1>Shop bán đồ phượt moto chuyên cung cấp phụ kiện phượt moto</h1>` |
| 20 | SEO content: internal links đúng slug | ✅ PASS | `/ao-quan-bao-ho.html`, `/giay-bao-ho.html`, `/phu-kien-khac.html` — slug đã sửa |
| 21 | SEO content: fallback khi không có `home_content_bottom_html` | ✅ PASS | Hardcoded fallback render đúng |
| 22 | FloatingChat: hiện khi có hotline | ✅ PASS | `wp-chat-float`, `href="tel:028.62797251"` — render đúng |

---

## Checklist — SEO / Metadata

| # | Item | Status | Giá trị thực tế |
|---|------|--------|----------------|
| 23 | `<title>` present | ✅ PASS | `BigBike - Do bao ho moto chinh hang` |
| 24 | `<title>` đúng Yoast wording (có dấu) | ❌ DATA | Setting DB thiếu dấu tiếng Việt; Yoast fallback chỉ render khi setting trống |
| 25 | `<meta description>` | ✅ PASS | `BigBike - shop do bao ho moto uy tin tai TP.HCM.` (thiếu dấu) |
| 26 | `og:title` | ✅ PASS | Khớp title |
| 27 | `og:description` | ✅ PASS | Khớp description |
| 28 | `og:image` | ✅ PASS | `https://bigbike.vn/brand/logo/PNG/01/BIGBIKE_FINAL_LOGO-01.png` (fallback logo) |
| 29 | `og:image` custom từ settings | ❌ DATA | `og_image_url=""` — cần upload ảnh OG |
| 30 | `twitter:card = summary_large_image` | ✅ PASS | Correct |
| 31 | `twitter:title`, `twitter:description`, `twitter:image` | ✅ PASS | Tất cả present |
| 32 | `<link rel="canonical">` | ⚠️ DEV | `http://localhost:3000` (no trailing slash, no https) — dev env, prod sẽ là `https://bigbike.vn/` |
| 33 | 3 JSON-LD scripts (Organization + WebSite + LocalBusiness) | ✅ PASS | Đủ 3 |
| 34 | LocalBusiness: name, logo, telephone | ✅ PASS | `name=BigBike`, `telephone=028.62797251` |

---

## Root Cause: Data Gaps in Production PostgreSQL

6 section failures + 4 SEO gaps đều do **dữ liệu chưa có trong DB production**, không phải lỗi code:

| Field / Table | Trạng thái hiện tại | Action cần làm |
|---|---|---|
| `sliders` table | 0 rows | Admin UI tạo 8 slides curated |
| `products.is_featured` | NULL toàn bộ | Admin đánh dấu ≥3 sản phẩm nổi bật |
| `categories.show_on_homepage` | NULL toàn bộ | Admin bật ≥2 danh mục + đặt `sort_order` |
| `categories.sort_order` | NULL toàn bộ | |
| `articles` → category `trai-nghiem` | 0 matches | ETL/admin gán bài review vào đúng content category |
| `articles` → category `blog` | 0 matches | ETL/admin gán tin tức vào category blog |
| `settings.zalo_url` | `""` (empty string) | Admin nhập Zalo URL |
| `settings.seo_home_title` | `"BigBike - Do bao ho moto chinh hang"` (không dấu) | Cập nhật đúng wording Yoast |
| `settings.seo_home_description` | `"BigBike - shop do bao ho moto uy tin tai TP.HCM."` (không dấu) | |
| `settings.og_image_url` | `""` (empty) | Upload ảnh OG 1200×630 |
| `settings.about_title/subtitle/content_html` | keys không tồn tại | Insert 3 keys qua admin hoặc migration |
| `settings.home_content_bottom_html` | key không tồn tại | ETL từ ACF `content_bottom` WP post 12 |
| `settings.promo_image_url` | `""` (empty) | Upload ảnh promo nếu muốn banner ảnh |

> **Lưu ý:** Dev seeds (V1000/V1001/V1002) cung cấp data này nhưng chỉ chạy được trên H2 test DB (xem BUG-02). Production PostgreSQL cần populate riêng.

---

## Bugs

### BUG-01 — Hero fallback không hiển thị khi slides=0 · Severity: LOW

**Mô tả:** `page.tsx` guard `{slides.length > 0 && <HeroSlider slides={slides} />}` ngăn render cả `HeroSlider`. Fallback UI (kicker "BIGBIKE · SINCE 2013" + CTA button) được code bên trong `HeroSlider` nhưng không được call.  
**Hệ quả:** Top trang có khoảng trắng trong khi chưa có slider data.  
**File:** [app/page.tsx](../../bigbike-web/app/page.tsx) — dòng `{slides.length > 0 && <HeroSlider>}`  
**Fix đề xuất:** Bỏ guard; để `HeroSlider` tự handle `slides=[]` (đã có fallback branch trong component):
```tsx
// Trước:
{slides.length > 0 && <HeroSlider slides={slides} />}
// Sau:
<HeroSlider slides={slides} />
```

### BUG-02 — Dev profile Flyway auth failure · Severity: HIGH (blocks dev workflow)

**Mô tả:** Start backend với `SPRING_PROFILES_ACTIVE=dev` → `FATAL: password authentication failed for user "bigbike"`. Spring context không khởi động được; dev seeds V1000/V1001/V1002 không apply vào PostgreSQL local.  
**Log:** `Error creating bean with name 'flywayInitializer'... Unable to obtain connection from database`  
**Cần điều tra:** So sánh `BIGBIKE_DB_PASSWORD` env var khi start có/không có dev profile. Có thể env var không được đọc đúng khi dùng `-Dspring-boot.run.profiles=dev`.  
**Workaround tạm:** Start backend bình thường (không dev profile), data sections sẽ trống; dùng admin UI để tạo dữ liệu test.

---

## Viewport & Lighthouse — Cần verify thủ công

### Hướng dẫn viewport test

Mở `http://localhost:3000/` trong Chrome, F12 → Toggle Device Toolbar:

| Viewport | Cần kiểm tra |
|----------|-------------|
| **375px** | Hero: ảnh mobileSrc thay desktopSrc; category grid 2 cột; news cards stack; floating chat vị trí |
| **768px** | Layout chuyển 2→3 cột đúng không; carousel scrollable |
| **1440px** | Hero full-width; 4-col category grid; 3-col news; carousel 5 cards visible |

### Hướng dẫn Lighthouse

DevTools → Lighthouse → chọn cả 4 category → Generate report:

| Category | Desktop | Mobile |
|----------|---------|--------|
| Performance | — | — |
| Accessibility | — | — |
| Best Practices | — | — |
| SEO | — | — |

**Lưu ý khi đọc Lighthouse:** Nhiều sections đang ẩn (no data) → Performance score sẽ cao hơn thực tế khi có đủ ảnh.

### Screenshots

Lưu vào `docs/home-verification/screenshots/` sau khi có đủ data:

| Viewport | File |
|----------|------|
| 375px full page | `375-full.png` |
| 768px full page | `768-full.png` |
| 1440px hero | `1440-01-hero.png` |
| 1440px featured + about | `1440-02-featured-about.png` |
| 1440px carousel + categories | `1440-03-carousel-cat.png` |
| 1440px promo + articles | `1440-04-promo-articles.png` |
| 1440px brands + seo | `1440-05-brands-seo.png` |

---

## Summary

| | Count |
|---|---|
| ✅ PASS (automated) | **11** |
| ❌ DATA GAP | **10** (6 sections + 4 SEO) |
| ⬜ MANUAL pending | **7** |
| 🐛 Bugs | **2** |

**Priority actions:**
1. **[HIGH]** Fix BUG-02 (Flyway dev auth) — unblocks dev seed workflow
2. **[HIGH]** Populate production DB: sliders, isFeatured, showOnHomepage, article categories, settings với đúng tiếng Việt có dấu
3. **[LOW]** Fix BUG-01 (Hero fallback) — 1 dòng thay đổi trong page.tsx
4. **[MANUAL]** Sau khi có data: chạy Lighthouse + screenshot 3 viewport + cập nhật report này
