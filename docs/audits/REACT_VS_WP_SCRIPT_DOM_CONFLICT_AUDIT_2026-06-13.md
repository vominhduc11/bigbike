# Audit: Xung đột thao tác DOM giữa React và script WordPress cũ (`home.min.js`)

> Phạm vi: `bigbike-web` (Next.js) ↔ `public/wp-content/themes/bigbike/dist/home.min.js`
> Ngày: 2026-06-13 · Loại: **AUDIT** (chỉ tìm + báo cáo + đề xuất, KHÔNG sửa code khi chưa duyệt)
> Verify runtime: Docker `bigbike-web` (prod cổng 3000, healthy) — Playwright 1.60 headless.
> Build prod đang chạy được build ~37 phút trước; mọi component dưới đây đã commit.

---

## 0. Kết luận nhanh

- **KHÔNG còn "an toàn tuyệt đối".** Có **12 điểm chồng lấn loại A/B cần xử lý hoặc theo dõi**, phần còn lại (≈19 selector) là **C — không chồng lấn**, đã đối chiếu hết bên dưới.
- **Cơ chế gốc đã được runtime xác nhận:** `home.min.js` chạy `front_app.init()` **đúng 1 lần mỗi lần tải nguyên trang** (gate `body.hasClass("js-loaded")`), và **KHÔNG chạy lại khi điều hướng SPA**.
  - **Reload (full-load):** script bind handler + sửa DOM **lên đúng phần tử React đang quản** → sinh xung đột.
  - **SPA nav:** script không chạy lại → **chỉ còn React, sạch**.
  - Bằng chứng (probe): sau SPA nav vào `/san-pham/`, `jQuery._data(.filter-mobile-wrapper, "events") = []` và `.woocommerce-ordering select` events `= []` — **không có handler WP nào bám**. Trên reload thì `= ["click"]` / `= ["change"]`.
- Vì vậy mọi điểm A dưới đây có chung đặc tính: **chỉ biểu hiện khi F5/tải nguyên trang, biến mất khi điều hướng nội bộ** (và ngược lại với 1 số điểm B — chỉ chạy đúng khi full-load).

---

## 1. Phương pháp

1. Giải nén `home.min.js` (258 KB minified), trích **từng** hàm chạm DOM trong `front_app`: `layoutFront`, `sideBarToggle`, `wooTabs`, `toggleCategories`, `makeAvailableToBuy`, `processSubmitFormFront`, và các module `woocommerce` / `shop` / `home`, cùng `$(document).ready` + `ajaxComplete`.
2. Với **mỗi selector**, grep toàn bộ `bigbike-web/{app,components}` tìm component React render class/cấu trúc khớp.
3. Verify runtime 2 đường (reload vs SPA) bằng `jQuery._data(el,"events")` — đọc **trực tiếp registry sự kiện jQuery** để chứng minh handler WP có thực sự bám vào DOM React hay không (chứ không suy đoán).

---

## 2. Sự thật nền tảng (đã verify runtime)

| Quan sát | Giá trị runtime |
|---|---|
| `window.jQuery` tồn tại | ✅ (bundle tự chứa) |
| `body.js-loaded` sau load | ✅ → `front_app.init()` đã chạy |
| `obj_ajax.ajaxurl` | `""` (rỗng) → mọi AJAX theme trỏ về URL hiện tại, fail im lặng |
| Endpoint AJAX theme (`remove_item_from_cart`, `custom_add_to_cart`, `find_variation_product`…) | **không tồn tại** (WordPress đã bỏ) |
| Plugin `$.fn.validate`, `.select2`, `.starRating` | **không nạp** → các call tương ứng là no-op |
| `$.fn.sticky` | được polyfill tối thiểu trong `WpThemeScripts.tsx` (position:sticky) |

Hệ quả: nhiều handler WP "chạm" được DOM nhưng **hành vi cuối bị vô hiệu một phần** vì backend AJAX + plugin đã biến mất. Đây là lý do nhiều điểm A có mức độ **Low** thay vì Critical.

---

## 3. Bảng tổng hợp điểm chồng lấn

Phân loại: **A** = React sở hữu, script WP không được chạm · **B** = script WP sở hữu, React chỉ render markup tĩnh · **C** = không chồng lấn / đã né.
Risk type: **1** = duplicate event binding · **2** = imperative (jQuery) vs declarative (React) · **3** = markup phụ thuộc script (chỉ đúng full-load hoặc chỉ đúng SPA).

| # | Selector WP (hành động) | Component React | Loại | Risk | Mức | Verify runtime |
|--:|---|---|:--:|:--:|:--:|---|
| 15 | `.woocommerce-ordering select` `.change → form.submit()` | `WpCategorySort` | **A** | 1 | **Med** | reload: `change` bound; SPA: `[]` |
| 17 | `.sidebar-wrap-product ul:not(.product-categories)` >10 li → append/bind `.show-more` | `WpCategorySidebar` (ToggleList) | **A** | 1,2,3 | **Med** | reload: `.show-more` click bound; brand ul = **46 li** |
| 18 | `.woocommerce-tabs .tabs-nav .nav-item a` click (đổi tab) | `WpProductTabs` | **A** | 1,2 | **Med** | reload: handler bám tab nav React |
| 19 | `.filter-mobile-wrapper` click → `html.overlay` + drawer active/in | `WpMobileFilterTrigger` + `WpCategorySidebar` | **A** | 1,2,3 | **Med** | reload: `click` bound; SPA: `[]` |
| 20 | `.sidebar-wrap-product .close-btn` / `.overlay` click → đóng drawer | `WpCategorySidebar` | **A** | 1,2,3 | **Med** | reload: cả 2 `click` bound; SPA: `[]` |
| 2 | `.js-quickby` click → toggle `.js-quickbuy-box` | `WpPurchaseSection` (nút Mua ngay) | **A** | 1 | Low | nút có class; `.js-quickbuy-box` vắng (no-op) |
| 6b | `.menu-item-has-children` (`.bb-has-mega`) → append `.arrow` + slideToggle | `WpMegaNavItem` | **A** | 2,3 | Low | reload: `.bb-has-mega > .arrow = 1` (jQuery chèn) |
| 13 | `.product-list-filter` `.sticky()` | `WpCatalogResults` | **A** | 3 | Low | reload: sticky áp; SPA: không re-run |
| 22 | `.product-categories .current-cat` `.addClass("active")` | `WpCategorySidebar` | **A** | 2 | Low | một lần addClass lên li React |
| 25 | `.js-quantity-wrap .js-plus/.js-minus` (DIRECT bind) | `WpCartClient` | **A** | 1,2 | Low | reload: `.js-plus` **vắng** (giỏ load sau) → thường né được |
| 28 | `.variations_form` change `.variation-radios input` → find_variation_product | `WpPurchaseSection` | **A** | 1,2 | Low | reload: `change` bound; chỉ bắn AJAX rỗng fail |
| 35 | `.partner-slide .swiper-container` → `new Swiper()` | `BrandCarousel` | **A** | 1,2 | Low | reload: 1 init/1 wrapper/12 slide, **0 console error** |
| 5 | `.hammer-menu-mb` click → mở off-canvas | `WpHeader` (layout) | **B** | 3 | Low | jQuery sở hữu MỞ; React sở hữu ĐÓNG (`WpMobileMenuController`) |
| 6a | `.menu-item-has-children` (submenu lồng) → `.arrow` + slideToggle | `WpHeader`/`WpMenu` | **B** | 3 | Low | off-canvas mobile; persist trong layout |
| 7 | `.hammer-menu-desktop` mở / `.information-slide-bigbike .close` đóng | `WpHeader` (layout) | **B** | 3 | Low | drawer thuần jQuery, persist layout |
| 10 | `.toggle--item .toggle--item-title` click → slideToggle | `WpFooter` (layout) | **B** | 3 | Low | accordion footer thuần jQuery |
| 11 | `.scrollToTop` click → animate top | `WpFooter` (layout) | **B** | 3 | Low | persist layout; `ScrollToTopButton` là **dead code** |
| 14 | `$(document).on("scroll")` → `header.headroom--not-top` | `WpHeader` | **B** | 3 | Low | handler ở document, persist |
| 4 | `.fb-share` / `.twitter-share` click → popup share | `app/tin-tuc/[slug]` (`<a>`) | **B** | 3 | Low | reload: popup; SPA: chỉ mở link cùng tab |

**Loại C — đã đối chiếu, không chồng lấn** (chi tiết §5): `.js-minus/plus-quantity`+`.quantity-block`, `body.single-product`/`makeAvailableToBuy`, `.skeleton-element`, `.rating-star`+`starRating`, `.select-2`, `.search-icon`/`.icon-close` (đã né có chủ đích trong `WpSearchIcon`), `.product-categories .current-cat-parent .arrow`, `.icon-cart`/`.popup-cart`/`.btnclose`, `.js-cart-box`/`.js-remove-cart`/`.js-increase-quantity`/`.js-decrease-quantity`, `#ship-to-different-address-checkbox`/`.js-other-shipping`/`.js-shipping-address-wrap`, `.js-add-to-cart-btn` (đã đổi tên `js-bb-add-to-cart` trên PDP live), `.js-change-filter`/`.js-form-filter`, `#main-banner`/`#main-product-slide`/`.content-carousel`/`.videos-slide` `.swiper-container`, `ajaxComplete` handlers.

---

## 4. Chi tiết từng điểm A/B (rủi ro + reload-vs-SPA + cách sửa tối thiểu)

### A-15 · Sort danh mục bị submit-trùng → reload nguyên trang
- **Markup:** `WpCategorySort` render `form.woocommerce-ordering > select[name=orderby]`, có `onChange` (React `router.push`) + `onSubmit preventDefault`.
- **WP:** `layoutFront` bind `$(".woocommerce-ordering select").change(function(){ this.form.submit() })`.
- **Rủi ro (type 1):** trên reload, đổi sort kích **cả hai** — React `router.push` (SPA) **và** `this.form.submit()` **native** (bypass `onSubmit preventDefault` của React) → **tải lại nguyên trang** thay vì điều hướng SPA, double-work, mất state CSR.
- **Reload vs SPA:** reload = full reload ngoài ý muốn; SPA nav vào danh mục = chỉ React, sạch (verify: events `[]`).
- **Fix tối thiểu:** bỏ class `woocommerce-ordering` trên `<form>` (đổi sang class trung tính, style giữ qua selector khác) để selector WP không bắt; React `onChange` vẫn nguyên.

### A-17 · `.show-more` / clamp danh sách lọc bị script WP chiếm
- **Markup:** `WpCategorySidebar > ToggleList` tự clamp + nút "Xem thêm" bằng Tailwind, **cố ý không dùng class `show-more`** và giữ ≤10 `<li>` để `sideBarToggle` bỏ qua (theo comment trong file).
- **WP:** `sideBarToggle` — mọi `ul` (trừ `.product-categories`) có **>10 li** → `addClass("visible")` + append `<div class="show-more">` rồi bind `$(".show-more").click → removeClass visible + hide`.
- **Phát hiện runtime quan trọng:** trên build đang chạy, **widget thương hiệu render 46 `<li>`** (probe: `siblingUlLi=46`) và **có `.show-more` được bind click** → **mitigation ≤10 ĐANG BỊ VÔ HIỆU**. Cần xác minh: build cũ (stale) hay clamp `collapseAt=10` của brand không có tác dụng trên runtime. (Kèm bug phụ: i18n leak — nút hiện literal `Catalog.showMore` do thiếu message `Catalog.showMore (vi)`.)
- **Rủi ro (1,2,3):** jQuery chèn nút + `visible` (imperative) vào `ul` mà React quản (declarative) và bind click "thu gọn" đối nghịch state React; khi filter đổi → React re-render `ul` có lẫn node `.show-more` lạ.
- **Reload vs SPA:** reload = double-control; SPA = sạch (events `[]`).
- **Fix tối thiểu:** (a) đảm bảo brand/color ToggleList **thực sự clamp render thu gọn ≤10 li** trong build (verify lại), HOẶC (b) đổi class `.show-more`/`.visible` của React sang Tailwind trung tính (đúng cách đã làm cho các list khác) để selector WP trượt; (c) fix message `Catalog.showMore`.

### A-18 · Tabs sản phẩm bị bind 2 handler
- **Markup:** `WpProductTabs` render `.woocommerce-tabs .tabs-nav .nav-item a` + React `onClick(preventDefault → setActive)`; class `.active`/`show` của panel **suy ra từ state** (`active===id`).
- **WP:** `wooTabs` bind click cùng `a` → `removeClass active` các `a`, `addClass active`, ẩn `.tab-panel`, `addClass active` rồi `setTimeout(...addClass "show",200)` lên panel đích.
- **Rủi ro (1,2):** trên reload click tab chạy cả hai; jQuery sửa class `active/show` imperative trên đúng node React điều khiển → React thường "thắng" ở render kế, nhưng `show` chèn trễ 200ms có thể để lại class rác / nhấp nháy.
- **Reload vs SPA:** reload = redundant + nguy cơ nhấp nháy; SPA = sạch.
- **Fix tối thiểu:** đổi class bao tab (`tabs-nav`/`nav-item`) sang trung tính để `wooTabs` trượt; React đã tự quản tab. **Cần verify thêm bằng tay trên PDP** (đổi tab sau F5, soi class rác `show`).

### A-19 + A-20 · Drawer lọc mobile bị điều khiển kép + mất scroll-lock trên SPA
- **Markup:** `WpMobileFilterTrigger` (`.filter-mobile-wrapper`, click → CustomEvent `wp:catfilter-open`) + `WpCategorySidebar` (state `active/in`, `.close-btn`/`.overlay` có React `onClick=close`).
- **WP:** `toggleCategories` bind `.filter-mobile-wrapper` (toggle `html.overlay` + `.sidebar-wrap-product` active/in) và `.close-btn`/`.overlay` (đóng + toggle `html.overlay`).
- **Rủi ro (1,2,3):** reload → tap "BỘ LỌC" chạy **cả React (CustomEvent→state) lẫn jQuery (toggleClass imperative)** trên cùng `.sidebar-wrap-product` → hai bên giành lớp `active/in` (jQuery `toggleClass` có thể gỡ đúng cái React vừa set) → drawer mở/đóng chập chờn. **`html.overlay` (khóa cuộn nền) CHỈ do jQuery quản** → SPA nav vào danh mục thì React mở drawer nhưng **nền vẫn cuộn được** (không có overlay).
- **Reload vs SPA:** reload = double-toggle, dễ kẹt; SPA = mở/đóng đúng nhưng thiếu scroll-lock nền.
- **Fix tối thiểu:** đổi tên `.filter-mobile-wrapper` / `.close-btn` / `.overlay` (giữ handler React) để jQuery trượt, **và** cho React tự quản khóa cuộn (vd `data-scroll-locked` / class trên `html`) thay vì dựa `html.overlay` của jQuery.

### A-2 · `.js-quickby` (nút Mua ngay PDP)
- React `onClick` mở `QuickBuyModal`; jQuery `.js-quickby` click → `preventDefault` + toggle `.js-quickbuy-box` (không tồn tại → no-op). **Reload:** modal mở + jQuery no-op; **SPA:** chỉ React. **Fix:** đổi `js-quickby` → class non-WP (vd `bb-buy-now`).

### A-6b · `.arrow` chèn vào item mega menu (React state-driven)
- `WpMegaNavItem` (`li.bb-has-mega`) vẫn mang `menu-item-has-children` → `layoutFront` chèn `.arrow` (verify: `.bb-has-mega > .arrow = 1`) + bind slideToggle. `<li>` này React mount/unmount `<MegaMenu>` theo state → **node `.arrow` lạ nằm trong subtree React** (nguy cơ type-2 khi reconcile; có thể hiện chevron thừa).
- Item submenu lồng (A-6a) thì jQuery sở hữu hợp lệ (off-canvas mobile, đã phối hợp với `WpMobileMenuController` bỏ qua click `.arrow`).
- **Reload vs SPA:** reload chèn arrow; SPA không chèn nhưng header persist nên arrow từ load đầu vẫn còn.
- **Fix tối thiểu:** loại `.bb-has-mega` khỏi diện chèn arrow — bỏ `menu-item-has-children` trên li mega (giữ style bằng class khác) **hoặc** `WpMegaNavItem` tự gỡ `.arrow` injected. **Cần verify hover** (soi console `removeChild` khi hover item "Tất cả sản phẩm" sau F5).

### A-13 · `.product-list-filter` sticky chỉ chạy khi reload
- `WpCatalogResults` render `.product-list-filter`. jQuery (qua polyfill) set `position:sticky` 1 lần khi full-load. **SPA nav** vào danh mục → không re-run → thanh lọc **không dính**. **Fix:** cho dính bằng Tailwind (`sticky top-20`) thay vì dựa `.sticky()`.

### A-22 · `.current-cat` bị addClass("active")
- jQuery một lần thêm `active` lên li `.current-cat` (React chỉ quản `current-cat`). Tác động phụ thuộc CSS `.current-cat.active`; khi filter đổi có thể để lại `active` rác. Mức Low. **Fix:** thấp ưu tiên; đổi/né nếu có CSS phụ thuộc.

### A-25 · Stepper số lượng giỏ hàng
- `WpCartClient` render `.js-quantity-wrap .js-plus/.js-minus`. `change_cart_quantity` **bind trực tiếp** (không delegation) lúc `layoutFront`. Runtime: hàng giỏ mount **sau** `fetchCart` (async sau mount) → `.js-plus` vắng lúc bind → **thường né được**. Nếu giỏ ấm render nhanh trước script thì jQuery ghi `.val()` đè input React-controlled (type 2). **Fix:** đổi tên `.js-quantity-wrap`/`.js-plus`/`.js-minus` (marker thừa) cho chắc.

### A-28 · `.variations_form` change → AJAX rỗng
- `WpPurchaseSection` render `.variations_form` + `.variation-radios` (đã đổi nút add-to-cart sang `js-bb-add-to-cart`, **không** có `js-quickbuyform`/`product_id`/`data-product_variations`). `choose_color_and_size` bind change (verify: `change` bound). Chọn đủ option → `find_variation_product` bắn **AJAX về URL rỗng → fail im lặng**; các ghi `.js-add-to-cart-btn`/`.js-single-price` là no-op (đã đổi tên/thiếu attr). **Reload:** 1 request thừa vô hại; **SPA:** sạch. **Fix:** đổi tên `.variations_form`/`.variation-radios`/`.single_variation_wrap`/`.js-single-price` sang non-WP (low ưu tiên).

### A-35 · `.partner-slide .swiper-container` double-init Swiper
- `BrandCarousel` set `className="swiper-container"` → trùng selector `home.partnerSlide()` `new Swiper(".partner-slide .swiper-container")`. Có **hai thư viện Swiper** (Swiper global trong bundle theme vs `swiper/react`) cùng nhắm 1 element trên reload home.
- **Runtime:** `1 container / 1 initialized / 1 wrapper / 12 slides`, **0 console error/warning** → headless **chưa thấy lỗi**; nhưng instance Swiper cũ có thể thêm transform cạnh tranh (jank thị giác chưa loại trừ).
- **Reload vs SPA:** reload home = nguy cơ; SPA vào home = chỉ React.
- **Fix tối thiểu:** bỏ class `swiper-container` ở `<Swiper>` của `BrandCarousel` (dùng class trung tính) — đúng kiểu HeroSlider đã bỏ `id="main-banner"`. **Cần verify thị giác** dải logo trên reload home.

### B (script WP sở hữu — cần full-load để đúng)
- **B-5/6a/7/10/11/14:** Header hamburger + off-canvas + submenu arrow + drawer `information-slide-bigbike` + footer accordion + scrollToTop + headroom scroll — đều render trong **layout (persist qua SPA)**, script bind 1 lần lúc load đầu và **giữ nguyên** suốt phiên → hoạt động cả reload lẫn SPA. Rủi ro type-3 thấp: **phụ thuộc binding của lần full-load đầu tiên còn sống** (đúng theo thiết kế đã ghi trong `WpThemeScripts.tsx`). `ScrollToTopButton` và `FooterCollapsible` là **dead code** (không nơi nào import).
- **B-4:** `.fb-share`/`.twitter-share` trong trang bài viết là `<a href>`; jQuery mở popup. **Reload:** popup; **SPA nav vào bài viết:** click chỉ mở link share cùng tab (degrade). **Fix (tùy chọn):** React `onClick → window.open`, hoặc chấp nhận.

---

## 5. Loại C — đã đối chiếu hết, KHÔNG chồng lấn (chứng minh không bỏ sót)

| Selector WP | Lý do an toàn |
|---|---|
| `.js-minus-quantity`/`.js-plus-quantity` trong `.quantity-block` | Không component nào render (PDP/giỏ dùng nút riêng) |
| `body.single-product` → `makeAvailableToBuy()` | `body` của layout = `bb-theme …`, **không** có `single-product` → không tự chạy |
| `.skeleton-element` `.hide()` | React skeleton dùng `animate-skeleton-shimmer`, không có class này |
| `.rating-star` `.starRating()` | Không render class `rating-star` (chỉ token `fill-rating-star`); plugin cũng không nạp |
| `.select-2 select` `.select2()` | Không render; plugin không nạp |
| `.search-icon` / `.icon-close` | `WpSearchIcon` **cố ý né** class `search-icon` (đã ghi comment) |
| `.product-categories .current-cat-parent .arrow` | React dùng `.cat-parent`/`.current-cat`, **không** `current-cat-parent` (verify: `exists:false`) |
| `.icon-cart`/`.popup-cart`/`.btnclose` | Không render |
| `.js-cart-box`/`.js-remove-cart`/`.js-increase-quantity`/`.js-decrease-quantity` | `WpCartClient` dùng `.remove`, không `js-cart-box` (delegation trượt) |
| `#ship-to-different-address-checkbox`/`.js-other-shipping`/`.js-shipping-address-wrap` | `WpCheckoutClient` không render |
| `.js-add-to-cart-btn` (add_to_cart) | PDP live (`WpPurchaseSection`) đã đổi `js-bb-add-to-cart`; `PurchaseSectionClient` (còn class này) **không** được route nào mount |
| `.js-change-filter`/`.js-form-filter` | `WpCategorySidebar` dùng `<Link href>`, không dùng filter-form WP |
| `#main-banner .swiper-container` | `HeroSlider` đã bỏ `id="main-banner"` + dùng `.swiper` mặc định |
| `#main-product-slide .swiper-container` | `FeaturedProductsCarousel` **không dùng Swiper** (paging tay) |
| `.content-carousel .swiper-container` | `ExperienceCarousel` dùng `.swiper` mặc định (không `swiper-container`) |
| `.videos-slide .swiper-container` | Section video không dùng class `.videos-slide` |
| `.js-home-banner`/`.skeleton.banner` (home.init) | `removeClass`/`hide` vô hại; `.skeleton.banner` vắng |
| `ajaxComplete` (replace/append/redirect…) | Không có AJAX theme nào hoàn tất hợp lệ (ajaxurl rỗng, endpoint đã bỏ) → dormant |

---

## 6. Đề xuất ưu tiên (chờ duyệt từng điểm)

**Nên xử lý (Med):** A-15 (sort), A-19+A-20 (drawer lọc mobile + scroll-lock), A-17 (show-more/clamp + i18n leak), A-18 (tabs).
**Nên xử lý (Low, gọn):** A-2, A-6b, A-13, A-35 — đều là "đổi/né class để selector WP trượt", rủi ro thấp, không phá hành vi đang đúng.
**Theo dõi/tùy chọn:** A-22, A-25, A-28, B-4; B-5..14 giữ nguyên (đúng thiết kế persist-layout).

**Khuôn mẫu sửa thống nhất** (đã được dùng thành công cho `show-more`, `search-icon`, `js-add-to-cart-btn`, `#main-banner`): *giữ React làm chủ hành vi, đổi/bỏ class mà `home.min.js` bắt được sang Tailwind/class trung tính, tái tạo bằng React nếu cần chạy cả khi SPA.* Mọi thay đổi đụng UI `bigbike-web` phải theo CLAUDE.md §UI Stack (Tailwind inline, không thêm class `.css`).

## 7. Hạng mục cần verify thêm bằng tay (browser thật, ngoài headless)
1. **A-35** dải logo `partner-slide` trên **reload home** — soi jank/transform double.
2. **A-6b** hover item "Tất cả sản phẩm" sau F5 — soi console lỗi `removeChild`/chevron thừa.
3. **A-18** đổi tab PDP sau F5 — soi class `show` rác.
4. **A-17** xác minh brand widget thực render bao nhiêu `<li>` trên **build mới nhất** (46 hay ≤10) để biết clamp còn hiệu lực không.

---
*Evidence script: `s:\tmp\wp-conflict-probe.mjs`, `wp-conflict-probe2.mjs` (Playwright, chạy với `bigbike-web` prod cổng 3000).*
