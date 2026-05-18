# HOMEPAGE DESIGN PARITY AUDIT — bigbike-web

> **Phase:** AUDIT + TRACE + REPORT only. Không sửa code, không refactor, không đổi business logic / API contract / data contract.
> **Ngày audit:** 2026-05-18
> **Phạm vi:** Trang chủ `bigbike-web` (route `/`) so với bộ ảnh thiết kế homepage BigBike (7 ảnh do người dùng cung cấp: full homepage desktop, burger/off-canvas, account dropdown logged-in, search overlay × 2, header sticky, mega menu).

---

## 0. Phương pháp & môi trường

| Hạng mục | Chi tiết |
|---|---|
| Stack | Next.js 16.2.4 (App Router, RSC) + React 19.2 + Tailwind v4 + Radix UI + shadcn/ui + Swiper 12 |
| Route homepage | `/` → [bigbike-web/app/page.tsx](../../bigbike-web/app/page.tsx) — server component, `export const revalidate = 3600` (ISR) |
| Cách chạy | Docker stack đang chạy sẵn (`docker ps`): `bigbike-web` healthy tại `127.0.0.1:3000`, backend `127.0.0.1:8080`, postgres, minio |
| Công cụ chụp | Playwright (Chromium headless) — script tạm `_bbtmp-*.mjs` đã chạy rồi **xoá**, không commit |
| Viewport đã chụp | Desktop 1920×1080, Laptop 1440×900, Tablet 768×1024, Mobile 390×844 |
| Ảnh chứng minh | Thư mục [docs/audits/homepage-parity-shots/](homepage-parity-shots/) — 29 file PNG + `_audit-log.txt` |

**Lưu ý dữ liệu:** Trang chủ lấy gần như toàn bộ nội dung từ backend (sliders, products, categories, articles, brands, videos, settings, menu). Nhiều khác biệt so với thiết kế là **do dữ liệu vận hành** (admin chưa cấu hình / gán sai), không phải lỗi code. Báo cáo phân biệt rõ hai loại: **[CODE]** = lệch do implementation, **[DATA]** = lệch do nội dung/cấu hình admin.

### Ảnh tham chiếu (screenshot thực tế)

| File | Nội dung |
|---|---|
| `desktop-1920--full.png` / `--top.png` | Toàn trang & khung hình đầu |
| `laptop-1440--*`, `tablet-768--*`, `mobile-390--*` | Các viewport còn lại |
| `*--scrolled-sticky.png`, `state--sticky-scrollup.png` | Hành vi header khi scroll |
| `state--search-empty.png`, `state--search-typed.png` | Search overlay |
| `state--megamenu.png` | Mega menu |
| `state--account-guest.png` | Account dropdown (guest) |
| `state--burger-drawer.png` | Off-canvas shop info |
| `sec-*.png` | Crop từng section: about, products, catgrid, promo, experience, news, video, brands, seo, footer |

---

## 1. Tóm tắt điều hành

Trang chủ hiện tại **đã có đầy đủ các khối lớn** theo thiết kế (hero, sản phẩm, danh mục, promo, trải nghiệm, blog, video, brand, SEO, footer) và **không vỡ layout / không horizontal scroll** ở cả 4 viewport. Visual mood (đen/đỏ, font condensed uppercase) đúng tinh thần thiết kế.

Tuy nhiên **chưa đạt visual parity**. Các lệch đáng kể:

| # | Nhóm | Mức |
|---|---|---|
| 1 | Hero không có lớp overlay bố cục (category + tên + CTA "MUA NGAY" + watermark) trong điều kiện thực tế | **P1** |
| 2 | Thiếu hẳn dải 3 card sản phẩm nổi bật ngay dưới hero | **P1** |
| 3 | Mega menu sai kiến trúc: panel full-bleed phẳng thay vì sidebar danh mục + flyout | **P1** |
| 4 | Section "ITEM ĐẶC SẮC" chỉ hiển thị 1 sản phẩm, có tab "Chưa phân loại" | **P1 (DATA)** |
| 5 | Search overlay: sai heading/placeholder, sai khái niệm gợi ý, panel quá nhỏ | **P2** |
| 6 | Account dropdown khác hẳn thiết kế (không CTA đỏ/đen, icon không phải mũ bảo hiểm) | **P2** |
| 7 | Burger drawer thiếu lưới ảnh Instagram | **P2** |
| 8 | Menu chính sai số lượng & wording so với thiết kế | **P2 (DATA)** |
| 9 | Footer: cột phải trống nhiều, thiếu địa chỉ + logo thanh toán | **P2** |

Tổng: **3 × P1**, **1 × P1(DATA)**, **~10 × P2**, **~12 × P3**. Không phát hiện P0 (không khối nào vỡ flow chính / vỡ layout nặng).

---

## 2. Đối chiếu theo section

### A. Header / Navigation

**Đúng:**
- Nền header đen (`rgb(0,0,0)`), chiều cao **80px** đúng token `--bb-header-height: 5rem`.
- Logo emblem BigBike bên trái.
- Có đủ Search icon, Cart icon + badge số lượng, Account icon, Burger.
- Active state màu đỏ (mục "Trang chủ" đang đỏ).
- Z-index: mega menu / search / dropdown đều phủ trên nội dung, không bị header che (xác nhận qua screenshot).
- Sticky: header ẩn khi cuộn xuống, hiện lại khi cuộn lên (`data-header-hidden` / `data-header-scrolled`) — verified `state--sticky-scrollup.png`.

**Lệch:** xem issue **[P2] Menu chính sai số lượng & wording**, **[P2] Account icon không đúng thiết kế**, **[P3] Thiếu dấu phân tách ◆ đỏ giữa menu item**, **[P3] Header sticky ẩn-khi-cuộn-xuống**.

---

### B. Hero Slider — xem **[P1] Hero thiếu lớp overlay bố cục**

**Đúng:** chỉ số slide `01/06` góc dưới ✓, mũi tên trái/phải ✓, ô preview slide kế tiếp (khung crosshair) ✓, mã sản phẩm ở thanh dưới ✓, aspect 16/6 desktop & 4/5 mobile, không crop sai.

**Lệch:** lớp text bố cục (danh mục + tên sản phẩm + nút "MUA NGAY" + watermark mờ) **chỉ render khi slide được gắn sản phẩm**. Sliders thực tế không gắn sản phẩm → hero hiển thị như banner phẳng. Chi tiết ở mục 3.

---

### C. Dải 3 card sản phẩm dưới hero — xem **[P1] Thiếu dải product highlight dưới hero**

Thiết kế: ngay dưới hero có 3 card sản phẩm ngang (áo da nữ, mũ LS2 FF353, mũ LS2 FF800). Thực tế: hero đi thẳng xuống section "SHOP BẢO HỘ MOTO UY TÍN" — không có dải card này.

---

### D. Section "SHOP BẢO HỘ MOTO UY TÍN"

**Đúng:** heading **"SHOP BẢO HỘ MOTO UY TÍN"** khớp thiết kế (lấy từ setting `about_title`); có kicker "BIGBIKE"; đoạn mô tả tiếng Việt có dấu đầy đủ, readable.

**Lệch:** bố cục. Thực tế = 2 cột (ảnh logo lớn bên trái + text bên phải) kèm watermark "BIGBIKE" mờ góc phải. Thiết kế = **một cột canh giữa**, chỉ heading + đoạn mô tả, không có ảnh logo. → xem **[P3] Section uy tín sai bố cục**.

---

### E. Section "ITEM ĐẶC SẮC TẠI BIGBIKE"

**Lệch nặng — 2 issue:** xem **[P1] Section ITEM ĐẶC SẮC chỉ có 1 sản phẩm** và **[P2] Sai heading + sai dạng hiển thị (tab thay vì carousel)**.

Tóm tắt: heading thực tế "SẢN PHẨM NỔI BẬT TẠI BIGBIKE" ≠ thiết kế "ITEM ĐẶC SẮC TẠI BIGBIKE"; thực tế là **lưới có tab theo danh mục** (đang hiện tab "CHƯA PHÂN LOẠI") thay vì **carousel 4 card có mũi tên**; chỉ 1 sản phẩm hiển thị.

---

### F. Category Grid

**Đúng:** icon line-art ✓, label viết hoa ✓, có border ngăn ô ✓, mỗi ô link đúng tới trang category (`toCategoryPath`).

**Lệch:** xem **[P2] Category grid sai số lượng & tên danh mục** và **[P3] Không thấy ô active/hover nền đỏ texture**.

---

### G. Promo Banner Sale — xem **[P2-DATA] Ảnh promo banner không khớp thiết kế**

Thiết kế: banner đỏ "SALE OFF 30% / CHO 10 SẢN PHẨM CUỐI CÙNG" + áo khoác da + chữ TAICHI RS JJ19. Thực tế: ảnh promo (`promo_image_url` / fallback `/wp/banner-ads.jpg`) đang là "LS2 DUAL SPORT MX436 PIONEER – 20% OFF" + ảnh người lái. Banner hiển thị đúng tỉ lệ, không crop sai, có link bao ngoài.

---

### H. Section "PHỤ KIỆN ĐI PHƯỢT MOTO CAO CẤP"

**Đạt parity tốt.** Heading đúng ✓, kicker "GÓC TRẢI NGHIỆM CÙNG BIGBIKE" ✓, layout editorial 3 ảnh (ảnh giữa tông đỏ + mũ helmet lớn nổi giữa, 2 ảnh trái/phải grayscale) ✓, tên sản phẩm dưới ảnh ✓, có nút CTA ✓. Z-index/layering đúng.

**Lệch nhỏ:** nút ghi **"XEM CHI TIẾT"**, thiết kế ghi **"Xem tiếp"** → xem **[P3] Wording nút CTA**.

---

### I. Blog "CẬP NHẬT XU HƯỚNG CÙNG BIGBIKE"

**Đạt parity tốt — tốt hơn thiết kế ở phần dữ liệu.** Heading đúng ✓, kicker "TIN TỨC MỚI UPDATE" ✓, 3 card desktop ✓, ảnh card ✓, **date badge đỏ dạng tab chéo** ✓, title ✓, link "Đọc thêm" ✓. Dữ liệu **thật** (tiêu đề + ngày thật như 06/04/2026) thay vì lorem ipsum + "05 Feb 2020" như mock thiết kế. Có thêm nút "XEM TẤT CẢ TIN TỨC" (thiết kế không có — coi là cải thiện hợp lý).

**Lệch nhỏ:** card không hiển thị đoạn excerpt (thiết kế có) — do `article.excerpt` rỗng → xem **[P3] Blog card thiếu excerpt**.

---

### J. Video / Product Experience "TRẢI NGHIỆM SẢN PHẨM CÙNG BIGBIKE.VN"

**Đúng:** background đen/xám cinematic ✓, heading ✓, 3 video card với play icon ✓, overlay đọc được, carousel có chấm chỉ trang. Không auto-load video nặng (thumbnail tĩnh, chỉ play khi click) — tốt cho performance.

**Lệch:** xem **[P3] Video section thiếu nút "Xem thêm" + mũi tên carousel**.

---

### K. Brand logo strip

**Đúng:** dải logo brand canh giữa, spacing đều, logo màu. Render 5 logo (AGV, Alpinestars, X-Pro, AUGI, Bullfighter).

**Lệch:** thiết kế minh hoạ AGV / Alpinestars / Bell / BMW / Givi — bộ brand khác. **[DATA]**, mức **P3** — do danh sách brand admin cấu hình, không phải lỗi code.

---

### L. SEO content block

**Đạt parity tốt.** Có section text dài giới thiệu shop, **nội dung tiếng Việt thật** (không lorem ipsum), có 2 heading `<h2>`, có internal link đỏ tới category. Trang render **SSR + ISR** (`revalidate = 3600`) → tốt cho SEO. Readability ổn.

**Lệch nhỏ:** heading "Shop bán đồ phượt moto chuyên cung cấp phụ kiện phượt moto" ≈ thiết kế "Shop đồ phượt moto chuyên cung cấp phụ kiện đi phượt moto" — sai khác câu chữ nhỏ, **P3**, và là **[DATA]** (`home_content_bottom_html`).

---

### M. Footer

**Đúng:** footer nền tối + viền đỏ 3px trên ✓, newsletter heading **"BIGBIKE MONG ĐƯỢC LẮNG NGHE VÀ THẤU HIỂU BẠN HƠN"** ✓, input email + nút đỏ "GỬI" ✓, hotline + email có icon đỏ ✓, cột "THÔNG TIN" (chính sách) ✓, thanh dưới đen có logo + slogan + copyright "© 2026 BigBike" ✓.

**Lệch:** xem **[P2] Footer cột phải trống & thiếu thông tin** và **[P3] Social hiển thị dạng text link**.

---

### Interactive states

| State | Kết quả |
|---|---|
| Search overlay | Mở/đóng OK, ESC đóng OK, click backdrop đóng OK, input auto-focus OK, focus trap + lock scroll OK, debounce 250ms OK, recent search lưu `localStorage` OK, keyboard ↑↓↵ OK. **Lệch:** heading/placeholder/khái niệm gợi ý + kích thước panel — xem các issue P2/P3 mục 3. |
| Mega menu | Hover mở OK, đóng khi click ngoài / cuộn OK, có ARIA. **Lệch:** sai kiến trúc — xem **[P1]**. |
| Account dropdown (guest) | Hoạt động đúng (Đăng nhập / Đăng ký). |
| Account dropdown (logged-in) | Khác hẳn thiết kế — xem **[P2]** (đối chiếu qua đọc code, chưa chụp do cần đăng nhập). |
| Burger / off-canvas | Trượt từ phải OK, overlay tối OK, ESC + click overlay đóng OK, body scroll lock OK (Radix Sheet), focus trap OK. **Lệch:** thiếu lưới Instagram — xem **[P2]**. |

---

## 3. Danh sách issue chi tiết

### [P1] Hero không có lớp overlay bố cục (category + tên + CTA + watermark)

**Khu vực:** Hero
**Viewport:** All
**Trạng thái:** Default
**Thiết kế yêu cầu:** Mỗi slide hero là một composition: ảnh nền cinematic đỏ/đen + ảnh sản phẩm lớn (mũ) nổi bên trái + nhãn danh mục ("MŨ BẢO HIỂM") + tiêu đề lớn condensed uppercase ("LS2 DUAL SPORT MX436 PIONEER") + nút "MUA NGAY ›" + watermark chữ mờ khổng lồ ("HELMX436") + `01/03` + mã `MX436`.
**Hiện tại:** Hero render ảnh slider full-bleed + lớp gradient tối. Khối overlay (danh mục + tên + nút "Mua ngay" + watermark) **chỉ render khi `hasProduct === true`**, tức slide phải được gán 1 sản phẩm. Các slider thực tế (vd "S9X M Bluetooth Intercom") **không gắn sản phẩm** → hero hiện như banner phẳng, không có tiêu đề / CTA / watermark. Kể cả khi có sản phẩm, code chỉ phủ chữ lên ảnh — **không bố trí ảnh sản phẩm PNG rời** như thiết kế.
**Mức độ lệch:** Lớn — hero là khối đầu trang, ảnh hưởng brand & CTA.
**Nguyên nhân khả nghi trong code:** [components/home/HeroSlider.tsx](../../bigbike-web/components/home/HeroSlider.tsx) — `HeroSlideView`, điều kiện `hasProduct = Boolean(slide.productName)`; [app/page.tsx](../../bigbike-web/app/page.tsx) `toHeroSlide()` chỉ điền `productName/categoryName/productCode` khi slider có `productLink` parse được slug.
**Recommended fix (không thực thi phase này):**
1. Quyết định: hero là banner-tự-chứa-text (admin nhúng chữ vào ảnh) hay composition (web tự dựng overlay)? Đối chiếu `docs/business/MODULE_CATALOG.md` mục Homepage/Slider để xác định ý đồ.
2. Nếu là composition: yêu cầu admin gán sản phẩm cho mỗi slider (data), hoặc cho phép nhập thủ công tiêu đề/CTA/danh mục cho slider không gắn sản phẩm (cần mở rộng data contract `HomeSlider` — phải update `docs/engineering/DATA_CONTRACT.md` trước).
3. Nếu hero giữ ảnh tự-chứa-text: bỏ/giảm lớp gradient + overlay để khỏi đè chữ in sẵn trên ảnh.
**Ảnh chứng minh:** `desktop-1920--top.png`, `mobile-390--top.png`.

---

### [P1] Thiếu dải 3 card sản phẩm nổi bật ngay dưới hero

**Khu vực:** Product highlight (dưới hero)
**Viewport:** All
**Trạng thái:** Default
**Thiết kế yêu cầu:** Ngay dưới hero có hàng 3 card sản phẩm (ảnh + tên + giá + badge).
**Hiện tại:** Không hiển thị. Khối "Block 2: Featured Products" render có điều kiện `featuredProducts.length > 0`; thực tế danh sách rỗng (DOM `productCardCount = 0`) nên hero đi thẳng xuống section "SHOP BẢO HỘ MOTO UY TÍN".
**Mức độ lệch:** Lớn về mặt nội dung trang; code đúng (render có điều kiện) nhưng **không có sản phẩm nào gắn `homepageBlock = FEATURED_GRID`**.
**Nguyên nhân khả nghi trong code:** [app/page.tsx](../../bigbike-web/app/page.tsx) — `listProducts({ homepageBlock: "FEATURED_GRID", ... })` trả rỗng; khối JSX `{featuredProducts.length > 0 && (...)}`.
**Recommended fix:** Chủ yếu **[DATA]** — admin gán sản phẩm vào block `FEATURED_GRID`. Đối chiếu `docs/engineering/DATA_CONTRACT.md` (enum `homepageBlock`) và `docs/business/MODULE_CATALOG.md` để xác nhận block này đúng là dải dưới hero. Cân nhắc thêm empty-state hoặc fallback để tránh trang chủ "hụt" một khối khi chưa cấu hình.
**Ảnh chứng minh:** `desktop-1920--top.png` (hero → about, không có dải card).

---

### [P1] Mega menu sai kiến trúc layout

**Khu vực:** Header / Mega menu
**Viewport:** Desktop
**Trạng thái:** Open (hover "Danh mục sản phẩm")
**Thiết kế yêu cầu:** Panel dropdown **có kích thước giới hạn**, neo dưới mục menu: cột trái là **danh sách dọc các danh mục cấp 1** (mục đầu "KHUYẾN MÃI HOT" có icon ngọn lửa, mục đang chọn tô đỏ), cột phải là **flyout panel trắng** hiện danh mục con của mục đang hover.
**Hiện tại:** Mega menu là **panel trắng full-bleed** trải hết chiều ngang, bên trong là **lưới cột phẳng** (hàng quicklink đỏ ở trên + nhiều cột danh mục cạnh nhau hiện đồng thời). Không có tương tác sidebar → flyout.
**Mức độ lệch:** Lớn về cấu trúc tương tác; vẫn dùng được nhưng khác hẳn UX thiết kế.
**Nguyên nhân khả nghi trong code:** [components/layout/HeaderNavItem.tsx](../../bigbike-web/components/layout/HeaderNavItem.tsx) — `MegaMenuPanel` (render `quickLinks` + `columns` phẳng); CSS `.mega-panel` / `.mega-columns` trong `app/globals.css`.
**Recommended fix:** Thiết kế lại `MegaMenuPanel` theo mô hình master-detail: cột trái list danh mục cấp 1 + state "danh mục đang hover", cột phải render `children` của mục đó. Giới hạn `max-width` panel, neo theo vị trí trigger. Đây là thay đổi UI thuần — không đụng API/data contract.
**Ảnh chứng minh:** `state--megamenu.png`.

---

### [P1 — DATA] Section "ITEM ĐẶC SẮC" chỉ hiển thị 1 sản phẩm + có tab "Chưa phân loại"

**Khu vực:** Section sản phẩm đặc sắc
**Viewport:** All
**Trạng thái:** Default
**Thiết kế yêu cầu:** Carousel ~4 sản phẩm nổi bật, mỗi card có ảnh, badge sale, tên, giá, sao đánh giá, logo brand nhỏ.
**Hiện tại:** Lưới có tab lọc theo danh mục; tab đầu đang là **"CHƯA PHÂN LOẠI"** (tô đỏ) và chỉ có **1 sản phẩm** ("LS2 KOKU KIDNEY BELT"). Tab "CHƯA PHÂN LOẠI" lộ ra cho thấy sản phẩm chưa được gán danh mục.
**Mức độ lệch:** Lớn về nội dung. Code chạy đúng theo dữ liệu được trả; gốc rễ là **dữ liệu** (ít sản phẩm gắn `RECOMMENDED_CAROUSEL`, sản phẩm thiếu category).
**Nguyên nhân khả nghi trong code:** [app/page.tsx](../../bigbike-web/app/page.tsx) — `listProducts({ homepageBlock: "RECOMMENDED_CAROUSEL", size: 10 })`; [components/home/FeaturedProductsTabbedGrid.tsx](../../bigbike-web/components/home/FeaturedProductsTabbedGrid.tsx) gom tab theo `category` → sản phẩm không có category rơi vào "Chưa phân loại".
**Recommended fix:** **[DATA]** admin gán đủ sản phẩm cho block `RECOMMENDED_CAROUSEL` và gán category cho từng sản phẩm. **[CODE — cân nhắc]** ẩn tab "Chưa phân loại" hoặc đổi nhãn; cân nhắc đặt ngưỡng tối thiểu sản phẩm để hiện section. Đối chiếu `docs/business/MODULE_CATALOG.md` xem section này thiết kế là carousel hay grid-có-tab trước khi đổi.
**Ảnh chứng minh:** `sec-products.png`, `desktop-1920--scrolled-sticky.png`.

---

### [P2] Search overlay — sai heading, placeholder, khái niệm gợi ý & kích thước panel

**Khu vực:** Search overlay
**Viewport:** All
**Trạng thái:** Open (empty + có keyword)
**Thiết kế yêu cầu:**
- Placeholder: **"Vui lòng nhập từ khóa..."**
- Trạng thái chưa nhập: heading **"LỊCH SỬ TÌM KIẾM"** + danh sách từ khoá đã tìm (luôn hiện block).
- Trạng thái có keyword: heading **"GỢI Ý"** + danh sách **từ khoá/danh mục gợi ý** (vd "Mũ bảo hiểm fullface", "Mũ bảo hiểm nửa đầu"...).
- Overlay là **panel trắng lớn** thả xuống dưới thanh input.

**Hiện tại:**
- Placeholder: "Tìm sản phẩm, thương hiệu...".
- Chưa nhập: heading "Tìm kiếm gần đây"; **nếu chưa có lịch sử thì không hiện gì** (block ẩn khi `recent.length === 0`).
- Có keyword: heading "Sản phẩm gợi ý"; hiển thị **autocomplete sản phẩm** (ảnh thumbnail + giá), không phải gợi ý từ khoá/danh mục.
- Overlay là **thanh mảnh** dính dưới header, không phải panel trắng lớn.

**Mức độ lệch:** Vừa — chức năng đúng nhưng sai ngôn từ, sai mô hình gợi ý và sai hình khối.
**Nguyên nhân khả nghi trong code:** [components/layout/SearchToggle.tsx](../../bigbike-web/components/layout/SearchToggle.tsx) — placeholder dòng ~301, heading "Tìm kiếm gần đây" ~466, "Sản phẩm gợi ý" ~341, điều kiện `showRecent = recent.length > 0 && ...`; fetch `/api/search-suggest` trả product. CSS `.bb-search-shell` / `.bb-search-body` trong `globals.css`.
**Recommended fix:**
1. Đổi placeholder → "Vui lòng nhập từ khóa..."; heading → "LỊCH SỬ TÌM KIẾM" / "GỢI Ý".
2. Quyết định mô hình gợi ý: thiết kế là **gợi ý từ khoá/danh mục**, hiện tại là **autocomplete sản phẩm**. Nếu giữ autocomplete sản phẩm thì coi là nâng cấp có chủ đích — cần xác nhận với chủ sản phẩm; nếu theo thiết kế thì cần endpoint gợi ý từ khoá (đối chiếu `docs/engineering/API_CONTRACT.md` mục search trước khi đổi).
3. Khi chưa có lịch sử: vẫn hiện block "LỊCH SỬ TÌM KIẾM" (rỗng/placeholder) thay vì ẩn hẳn.
4. Mở rộng panel theo thiết kế (panel trắng lớn).
**Ảnh chứng minh:** `state--search-empty.png`, `state--search-typed.png`.

---

### [P2] Account dropdown khác thiết kế (cả icon trigger lẫn nội dung)

**Khu vực:** Header / Account
**Viewport:** Desktop
**Trạng thái:** Logged-in (và trigger ở mọi trạng thái)
**Thiết kế yêu cầu:**
- Trigger: **icon mũ bảo hiểm** + nhãn chữ ("HEY YO!..." / "Tài khoản") cạnh icon.
- Dropdown logged-in: dòng mô tả "Trải nghiệm mua sắm không giới hạn cùng Bigbike.vn" + **nút đỏ lớn "TÀI KHOẢN CỦA TÔI ›"** + **nút đen "ĐĂNG XUẤT ⇥"**.
**Hiện tại:**
- Trigger: icon user line-art chung (guest) / vòng tròn chữ cái viết tắt (logged-in) — **không có icon mũ, không có nhãn "Tài khoản"**.
- Dropdown logged-in: dạng shadcn menu chuẩn — "Xin chào, {tên}" + item "Tài khoản của tôi", "Đơn hàng", "Đăng xuất" — **không có nút CTA đỏ/đen**.
**Mức độ lệch:** Vừa — hành vi đúng (route, logout) nhưng visual khác hẳn.
**Nguyên nhân khả nghi trong code:** [components/layout/HeaderUserMenu.tsx](../../bigbike-web/components/layout/HeaderUserMenu.tsx) — `UserIcon` (svg user), nhánh `auth.status === "authenticated"` render `DropdownMenuItem` thường.
**Recommended fix:** Thay icon trigger bằng icon mũ bảo hiểm + nhãn "Tài khoản"; render lại nội dung dropdown logged-in theo thiết kế (dòng mô tả + 2 nút CTA đỏ/đen). UI thuần, không đụng auth logic. Lưu ý guard `[@media(max-width:420px)]:hidden` khi thêm nhãn chữ để mobile không tràn.
**Ảnh chứng minh:** `state--account-guest.png` (guest); logged-in đối chiếu qua code (chưa chụp do cần tài khoản đăng nhập).

---

### [P2] Burger / off-canvas thiếu lưới ảnh Instagram

**Khu vực:** Burger / off-canvas drawer
**Viewport:** Desktop
**Trạng thái:** Open
**Thiết kế yêu cầu:** Trong drawer có heading **"INSTAGRAM"** + lưới **4 ảnh thumbnail** Instagram.
**Hiện tại:** Drawer chỉ có logo, mô tả shop, "THÔNG TIN LIÊN HỆ" (giờ/địa chỉ/điện thoại), và **1 link chữ "Zalo"** ở cuối — **không có khối Instagram thumbnails**.
**Mức độ lệch:** Vừa.
**Nguyên nhân khả nghi trong code:** [components/layout/ShopInfoDrawer.tsx](../../bigbike-web/components/layout/ShopInfoDrawer.tsx) — chỉ render link `instagramUrl`/`zaloUrl` dạng text, không có grid ảnh.
**Recommended fix:** Thêm khối "INSTAGRAM" + lưới 4 ảnh. Nguồn ảnh: nếu chưa có trong data contract phải bổ sung (update `docs/engineering/DATA_CONTRACT.md` cho settings trước) hoặc dùng ảnh tĩnh curate. Cũng nên xem lại bề rộng drawer (`sm:max-w-md` ≈ 448px) so với thiết kế rộng hơn.
**Ảnh chứng minh:** `state--burger-drawer.png`.

---

### [P2] Footer — cột phải trống nhiều, thiếu địa chỉ & logo thanh toán

**Khu vực:** Footer
**Viewport:** Desktop
**Trạng thái:** Default
**Thiết kế yêu cầu:** Footer nhiều cột cân đối, có địa chỉ cửa hàng, cụm social, logo/badge thanh toán ở thanh dưới.
**Hiện tại:** Chỉ 2 cột hẹp ("THÔNG TIN", "MẠNG XÃ HỘI") → **nửa phải footer trống lớn**. Không có block địa chỉ. Thanh dưới không có logo thanh toán/BCT.
**Mức độ lệch:** Vừa.
**Nguyên nhân khả nghi trong code:** [components/layout/SiteFooter.tsx](../../bigbike-web/components/layout/SiteFooter.tsx); component [BctBadge.tsx](../../bigbike-web/components/layout/BctBadge.tsx) có sẵn nhưng chưa thấy render ở footer-bottom.
**Recommended fix:** Bổ sung cột địa chỉ/giờ mở cửa, cân lại grid cho lấp khoảng trống phải; cân nhắc đưa `BctBadge` / logo thanh toán vào thanh footer-bottom. Đối chiếu `docs/business/MODULE_CATALOG.md` mục Footer để biết các cụm bắt buộc.
**Ảnh chứng minh:** `sec-footer.png`.

---

### [P2] Section "ITEM ĐẶC SẮC" — sai heading & sai dạng hiển thị

**Khu vực:** Section sản phẩm đặc sắc
**Viewport:** All
**Trạng thái:** Default
**Thiết kế yêu cầu:** Heading "ITEM ĐẶC SẮC TẠI BIGBIKE"; dạng **carousel** sản phẩm có mũi tên trái/phải.
**Hiện tại:** Heading "SẢN PHẨM NỔI BẬT TẠI BIGBIKE" (kicker "SẢN PHẨM NỔI BẬT"); dạng **lưới có tab lọc danh mục**.
**Mức độ lệch:** Vừa.
**Nguyên nhân khả nghi trong code:** [app/page.tsx](../../bigbike-web/app/page.tsx) text heading hardcode dòng ~373–375; [components/home/FeaturedProductsTabbedGrid.tsx](../../bigbike-web/components/home/FeaturedProductsTabbedGrid.tsx) (dạng tab). Lưu ý repo còn [FeaturedProductsCarousel.tsx](../../bigbike-web/components/home/FeaturedProductsCarousel.tsx) — đúng dạng carousel nhưng không được dùng ở trang chủ.
**Recommended fix:** Đổi heading/kicker theo thiết kế; cân nhắc dùng `FeaturedProductsCarousel` thay `FeaturedProductsTabbedGrid` nếu thiết kế chốt là carousel. Xác nhận với `docs/business/MODULE_CATALOG.md` trước khi đổi component.
**Ảnh chứng minh:** `sec-products.png`.

---

### [P2 — DATA] Menu chính sai số lượng & wording

**Khu vực:** Header / Navigation
**Viewport:** Desktop
**Trạng thái:** Default
**Thiết kế yêu cầu:** 4 mục — "DANH MỤC SẢN PHẨM" (có mega menu), "VỀ BIGBIKE.VN", "BIGBIKE NEWS", "LIÊN HỆ".
**Hiện tại:** 5 mục — "TRANG CHỦ", "TẤT CẢ SẢN PHẨM" (có mega menu), "TIN TỨC", "GIỚI THIỆU", "LIÊN HỆ".
**Mức độ lệch:** Vừa — **[DATA]**: menu lấy từ backend (`getPublicMenu("primary")`), do admin cấu hình.
**Nguyên nhân khả nghi trong code:** [components/layout/SiteHeader.tsx](../../bigbike-web/components/layout/SiteHeader.tsx) — menu từ API, `FALLBACK_PRIMARY_MENU` chỉ dùng khi API lỗi.
**Recommended fix:** **[DATA]** admin sửa menu "primary" cho khớp wording thiết kế. Không sửa code.
**Ảnh chứng minh:** `desktop-1920--top.png`.

---

### [P2] Category grid — sai số lượng & tên danh mục

**Khu vực:** Category grid
**Viewport:** All
**Trạng thái:** Default
**Thiết kế yêu cầu:** 8 danh mục, lưới 2 hàng × 4 cột, label ngắn gọn (Áo–Quần bảo hộ, Balo các loại, Găng tay, Giáp bảo hộ, Giày bảo hộ, Mũ bảo hiểm, Tai nghe Bluetooth, Phụ kiện khác).
**Hiện tại:** 12 danh mục, lưới 3 hàng × 4 cột. Một số label dài bất thường ("GIÁP BẢO HỘ TAY CHÂN - ĐAI LƯNG - PHỤ KIỆN GIÁP" — wrap 2 dòng) hoặc giống tên sản phẩm ("NÓN FULLFACE LS2").
**Mức độ lệch:** Vừa — phần lớn **[DATA]** (12 danh mục bật `showOnHomepage`, đặt tên dài). Code render đúng.
**Nguyên nhân khả nghi trong code:** [app/page.tsx](../../bigbike-web/app/page.tsx) — `listCategories({ showOnHomepage: true, size: 100 })` + `WpCategoryListItem`.
**Recommended fix:** **[DATA]** admin giới hạn còn 8 danh mục `showOnHomepage` và đặt tên ngắn gọn. **[CODE — cân nhắc]** giới hạn cứng số ô (vd 8) ở trang chủ để layout không vỡ chủ đích.
**Ảnh chứng minh:** `sec-catgrid.png`, `sec-products.png`.

---

### [P2 — DATA] Ảnh promo banner không khớp thiết kế

**Khu vực:** Promo banner
**Viewport:** All
**Trạng thái:** Default
**Thiết kế yêu cầu:** Banner đỏ "SALE OFF 30% / CHO 10 SẢN PHẨM CUỐI CÙNG" + áo khoác da.
**Hiện tại:** Ảnh promo nội dung khác ("LS2 DUAL SPORT MX436 PIONEER – 20% OFF").
**Mức độ lệch:** Vừa — **[DATA]** (`promo_image_url` / fallback `/wp/banner-ads.jpg`).
**Nguyên nhân khả nghi trong code:** [app/page.tsx](../../bigbike-web/app/page.tsx) — `promoImageSrc`, khối "Block 6: Promo Banner".
**Recommended fix:** **[DATA]** admin cập nhật `promo_image_url` đúng ảnh thiết kế. Code không cần sửa.
**Ảnh chứng minh:** `sec-promo.png`.

---

### [P3] Section uy tín sai bố cục (2 cột thay vì canh giữa)

**Khu vực:** Section "SHOP BẢO HỘ MOTO UY TÍN"
**Viewport:** Desktop / Tablet
**Trạng thái:** Default
**Thiết kế yêu cầu:** Một cột canh giữa: heading + đoạn mô tả.
**Hiện tại:** 2 cột — ảnh logo lớn trái + text phải, kèm watermark "BIGBIKE" mờ.
**Mức độ lệch:** Nhỏ.
**Nguyên nhân khả nghi trong code:** [app/page.tsx](../../bigbike-web/app/page.tsx) khối `.bb-about` (`bb-about-inner`, `bb-about-mark`); CSS `.bb-about*` trong `globals.css`.
**Recommended fix:** Đổi `.bb-about` về layout một cột canh giữa, bỏ ảnh logo / watermark nếu muốn bám sát thiết kế.
**Ảnh chứng minh:** `sec-about.png`.

---

### [P3] Không thấy ô category active/hover nền đỏ texture

**Khu vực:** Category grid
**Viewport:** Desktop
**Trạng thái:** Hover
**Thiết kế yêu cầu:** Một ô danh mục có nền đỏ texture (trạng thái nổi bật/hover).
**Hiện tại:** Các ô nền trắng, chưa quan sát thấy state đỏ (cần kiểm tra CSS hover `.bb-cat-list-item:hover`).
**Mức độ lệch:** Nhỏ.
**Nguyên nhân khả nghi trong code:** CSS `.bb-cat-list-item` trong `globals.css`.
**Recommended fix:** Bổ sung/again hover state nền đỏ cho ô danh mục đúng thiết kế.
**Ảnh chứng minh:** `sec-catgrid.png`.

---

### [P3] Wording nút CTA section trải nghiệm

**Khu vực:** Section "PHỤ KIỆN ĐI PHƯỢT MOTO CAO CẤP"
**Viewport:** All · **Trạng thái:** Default
**Thiết kế yêu cầu:** Nút "Xem tiếp". **Hiện tại:** "XEM CHI TIẾT".
**Mức độ lệch:** Nhỏ.
**Nguyên nhân khả nghi trong code:** [components/home/ExperienceCarousel.tsx](../../bigbike-web/components/home/ExperienceCarousel.tsx).
**Recommended fix:** Đổi nhãn nút thành "Xem tiếp".

---

### [P3] Video section thiếu nút "Xem thêm" + mũi tên carousel

**Khu vực:** Video section · **Viewport:** All · **Trạng thái:** Default
**Thiết kế yêu cầu:** Có nút CTA "Xem thêm" dưới carousel + mũi tên trái/phải.
**Hiện tại:** Chỉ thấy chấm chỉ trang, không thấy nút "Xem thêm"; mũi tên cần kiểm tra thêm ở desktop.
**Mức độ lệch:** Nhỏ.
**Nguyên nhân khả nghi trong code:** [components/home/HomeVideoCarousel.tsx](../../bigbike-web/components/home/HomeVideoCarousel.tsx).
**Recommended fix:** Thêm nút "Xem thêm" + đảm bảo mũi tên điều hướng hiện trên desktop.
**Ảnh chứng minh:** `sec-video.png`.

---

### [P3] Blog card thiếu đoạn excerpt

**Khu vực:** Blog section · **Viewport:** All · **Trạng thái:** Default
**Thiết kế yêu cầu:** Card blog có tiêu đề + đoạn excerpt ngắn.
**Hiện tại:** Card hiện tiêu đề + "Đọc thêm", không có excerpt (`article.excerpt` rỗng).
**Mức độ lệch:** Nhỏ — **[DATA]**.
**Nguyên nhân khả nghi trong code:** [app/page.tsx](../../bigbike-web/app/page.tsx) `WpNewsCard` — `{article.excerpt && ...}`.
**Recommended fix:** **[DATA]** điền excerpt cho bài viết; hoặc **[CODE]** fallback cắt ngắn `content` khi excerpt rỗng.
**Ảnh chứng minh:** `sec-news.png`.

---

### [P3] Header thiếu dấu phân tách ◆ đỏ giữa menu item

**Khu vực:** Header · **Viewport:** Desktop · **Trạng thái:** Default
**Thiết kế yêu cầu:** Giữa các mục menu có dấu ◆ (kim cương) nhỏ màu đỏ.
**Hiện tại:** Các mục chỉ cách nhau bằng khoảng trắng.
**Mức độ lệch:** Nhỏ.
**Nguyên nhân khả nghi trong code:** `globals.css` `.bb-header-nav` / `.bb-navigation-item`.
**Recommended fix:** Thêm separator `◆` (vd `::after`) giữa các nav item.
**Ảnh chứng minh:** `desktop-1920--top.png`.

---

### [P3] Header sticky ẩn khi cuộn xuống

**Khu vực:** Header · **Viewport:** All · **Trạng thái:** Sticky
**Thiết kế yêu cầu:** Ảnh "header sticky" cho thấy header hiện khi trang đã cuộn.
**Hiện tại:** Header ẩn khi cuộn **xuống** (`HIDE_AFTER = 80`), hiện lại khi cuộn **lên** — đã verify reappear OK.
**Mức độ lệch:** Nhỏ — pattern auto-hide phổ biến, không hẳn là lỗi; chỉ cần xác nhận ý đồ thiết kế.
**Nguyên nhân khả nghi trong code:** [components/layout/StickyHeaderShell.tsx](../../bigbike-web/components/layout/StickyHeaderShell.tsx).
**Recommended fix:** Xác nhận với chủ sản phẩm: giữ auto-hide hay luôn hiện. Nếu thiết kế muốn luôn hiện → bỏ nhánh `data-header-hidden`.
**Ảnh chứng minh:** `desktop-1920--scrolled-sticky.png`, `state--sticky-scrollup.png`.

---

### [P3 — DATA] Brand strip & SEO heading khác câu chữ thiết kế

Bộ brand (AGV/Alpinestars/X-Pro/AUGI/Bullfighter vs AGV/Alpinestars/Bell/BMW/Givi) và heading SEO khác câu chữ — đều **[DATA]** (brand list + setting `home_content_bottom_html`). Không sửa code; admin cập nhật nội dung nếu cần bám thiết kế.

---

## 4. Responsive — kết quả theo viewport

| Viewport | Kết quả |
|---|---|
| Desktop 1920 | Không horizontal scroll (`scrollW = clientW = 1920`). Layout đủ khối. |
| Laptop 1440 | Không overflow. OK. |
| Tablet 768 | Không overflow. Header thu gọn về icon + burger (ẩn nav ngang); section "uy tín" về 1 cột; lưới danh mục giữ 4 cột; các section khác xếp dọc hợp lý. |
| Mobile 390 | Không overflow (`scrollW = clientW = 390`). Hero về tỉ lệ 4/5; các khối xếp 1 cột; footer đọc được. |

Không phát hiện lỗi vỡ layout / tràn chữ / méo card / scroll ngang ngoài ý muốn ở bất kỳ viewport nào. Mega menu mobile **không phụ thuộc hover-only** (dùng `MobileHeaderMenu` riêng).

---

## 5. Kiểm tra technical implementation

**Tốt:**
- **Tách component hợp lý** — không dồn vào một file khổng lồ. Có `SiteHeader`, `HeaderNavItem` (mega menu), `SearchToggle`, `HeaderUserMenu`, `ShopInfoDrawer`, `MobileHeaderMenu`, `SiteFooter`, `StickyHeaderShell`, `HeroSlider`, `BrandCarousel`, `FeaturedProductsTabbedGrid`, `ExperienceCarousel`, `HomeVideoCarousel`, `ProductCard`. `app/page.tsx` ~555 dòng nhưng chủ yếu là data-fetching + bố cục block + 2 helper component nhỏ — chấp nhận được.
- **Dữ liệu thật từ API** — không hardcode/lorem ở phần động (sliders, products, categories, articles, brands, videos, settings). Lorem ipsum chỉ nằm ở **ảnh thiết kế mock**, không phải ở web thật.
- **SSR + ISR** — `revalidate = 3600`; tốt cho SEO product/blog/SEO-content.
- **Fallback / điều kiện render** — mọi block bọc `length > 0`; có fallback text khi setting rỗng.
- **next/image** dùng cho ảnh tĩnh & ảnh card. `HeroSlider` dùng `<picture>/<img>` có chủ đích (art-direction desktop/mobile) — eslint-disable có ghi chú.
- **SEO** — JSON-LD (Organization, WebSite, LocalBusiness, FAQ), `<h1 class="sr-only">`, `generateMetadata()`.
- **Accessibility** — `aria-label`, `aria-haspopup`/`aria-expanded`, focus trap (search + Radix Sheet), keyboard nav (↑↓↵ Home End trong search; ArrowDown mở mega menu), `role="dialog"/"listbox"/"option"`, body scroll lock, semantic `<section>`/`<nav>`/`<h2>`.
- **Lazy-load** — section dưới fold (carousel, swiper) là client component; ảnh dùng lazy mặc định trừ hero (`loading="eager"`).

**Cần lưu ý:**
- **Console 401** — mọi viewport log 1 lỗi `Failed to load resource: 401`. Khả năng là một API gated (cart/profile) gọi khi chưa đăng nhập. Không vỡ trang nhưng nên xác minh và xử lý cho sạch console. → đề nghị tạo task điều tra riêng, **không fix trong phase audit**.
- **alt text** — phần lớn ảnh có `alt`; một số ảnh trang trí để `alt=""` đúng chuẩn (decorative). Search thumbnail `alt=""` (có tên ngay cạnh) — chấp nhận.
- Trùng lặp component: tồn tại cả `FeaturedProductsCarousel` (không dùng) và `FeaturedProductsTabbedGrid` (đang dùng) — liên quan issue [P2] về dạng hiển thị section đặc sắc.

---

## 6. Bảng tổng hợp mức độ

| Mức | Số lượng | Issue |
|---|---|---|
| **P0** | 0 | — |
| **P1** | 4 | Hero thiếu overlay bố cục · Thiếu dải product highlight dưới hero · Mega menu sai kiến trúc · Section ITEM ĐẶC SẮC chỉ 1 sản phẩm (DATA) |
| **P2** | 9 | Search overlay sai heading/placeholder/khái niệm · Account dropdown khác thiết kế · Burger thiếu Instagram · Footer cột phải trống · Section đặc sắc sai heading/dạng · Menu chính sai (DATA) · Category grid sai số lượng (DATA) · Promo banner sai ảnh (DATA) |
| **P3** | 9 | Section uy tín sai bố cục · Thiếu hover đỏ category · Wording "Xem tiếp" · Video thiếu "Xem thêm"/mũi tên · Blog thiếu excerpt · Thiếu ◆ separator · Header auto-hide · Brand list khác (DATA) · SEO heading khác (DATA) |

**Phân loại nguồn gốc:** ~8 issue gốc **[DATA]** (cấu hình admin) — fix bằng cập nhật nội dung, không đụng code; phần còn lại là **[CODE]** UI thuần (không issue nào cần đổi business logic / API contract / data contract, trừ khi mở rộng `HomeSlider`/settings cho hero & Instagram thì phải update `docs/engineering/DATA_CONTRACT.md` trước).

---

## 7. Khuyến nghị thứ tự xử lý (cho phase sau — KHÔNG thực thi ở đây)

1. **DATA trước (rẻ, tác động lớn):** gán sản phẩm `FEATURED_GRID` + `RECOMMENDED_CAROUSEL`, gán category cho sản phẩm, gọn lại 8 danh mục homepage, sửa menu "primary", cập nhật ảnh promo, gắn sản phẩm cho slider hero.
2. **P1 CODE:** dựng lại kiến trúc mega menu (sidebar + flyout); xử lý hero (chốt mô hình banner vs composition).
3. **P2 CODE:** search overlay (heading/placeholder/panel), account dropdown, burger Instagram, footer cột phải.
4. **P3 polish:** bố cục section uy tín, hover category, wording CTA, separator ◆, excerpt blog, nút video.
5. Trước mọi thay đổi: đối chiếu `docs/business/MODULE_CATALOG.md`, `docs/engineering/API_CONTRACT.md`, `docs/engineering/DATA_CONTRACT.md` theo Docs-First Contract; nếu phải mở rộng data contract (hero slider title/CTA, Instagram settings) → update docs trước.

---

*Hết báo cáo. Phase này chỉ AUDIT — không có thay đổi code nào được thực hiện. Script Playwright tạm đã bị xoá; chỉ giữ lại ảnh chứng minh trong `homepage-parity-shots/`.*
