# Product List Body Design Parity Audit

Ngày audit: 2026-05-18  
Phạm vi: chỉ phần body trang category/product listing của `bigbike-web`; không đánh giá header/footer.  
Reference requested: `docs/design/product-list.png`  
Reference thực tế dùng để đối chiếu: `C:/Users/vomin/Downloads/Big Bike/product list.png` vì `docs/design/product-list.png` không tồn tại trong repo tại thời điểm audit.

## Kết Luận

**KHÔNG ĐẠT 100% BODY VISUAL PARITY.**

Body hiện tại render được trang category “MŨ BẢO HIỂM”, nhưng khác reference ở hầu hết các khối lớn: hero, sidebar, card, hover, pagination và data. Desktop có đúng 3 cột, SEO block có tồn tại, responsive không horizontal overflow; tuy nhiên các tiêu chí acceptance quan trọng không đạt.

## Runtime Audit

- App audited trên browser thật bằng Playwright.
- Docker stack trước audit: `bigbike-web` chạy `127.0.0.1:3000`, `bigbike-backend` chạy `127.0.0.1:8080`, DB healthy.
- Route body đúng để audit: `/danh-muc-san-pham/non-bao-hiem-moto/`.
- Runtime re-check bằng `http://localhost:3000/danh-muc-san-pham/non-bao-hiem-moto/`: 0 console errors, 0 page errors, 0 request failures. Evidence: `docs/audits/product-list-body-parity-shots/localhost-runtime-summary.json`.
- API product/category trả data thật từ backend, không mock. Evidence: `docs/audits/product-list-body-parity-shots/audit-runtime-summary.json`.

## Route Đã Kiểm Tra

| Route | Kết quả | Ghi chú |
|---|---:|---|
| `/san-pham/` | 200 | Generic product listing, title “Sản phẩm”, không phải category reference. |
| `/danh-muc-san-pham/` | 200 | Category index, không phải product listing category. |
| `/danh-muc-san-pham/mu-bao-hiem/` | 200 | App render trang “Không tìm thấy danh mục”, không phải route đúng. |
| `/danh-muc-san-pham/non-bao-hiem-moto/` | 200 | Route đúng cho category “MŨ BẢO HIỂM”. |
| `/danh-muc-san-pham/mu-bao-hiem-fullface/` | 200 | Sub-category, không phải reference root category. |
| `/product-category/mu-bao-hiem/` | 404 | Legacy/WP-style route không tồn tại. |

## API / Data Findings

| API | Kết quả |
|---|---|
| `GET /api/v1/categories/non-bao-hiem-moto` | 200, category name `MŨ BẢO HIỂM`, description HTML present, image URL present. |
| `GET /api/v1/products?category=non-bao-hiem-moto&size=24` | 200, `totalItems=7`, `totalPages=1`. |
| `GET /api/v1/catalog/facets?category=non-bao-hiem-moto` | 401 `Authentication required`; sidebar count facets unavailable. |
| `GET /api/v1/sliders?location=category_sidebar` | 200, empty array; no sidebar promo banner data. |

**DATA BLOCKER:** reference shows `60 sản phẩm`, pagination `1 - 10`, count diamonds on filters, and a sidebar promo banner. Runtime backend currently provides only 7 products, no pagination page range, unauthorized facets, and no sidebar banner.

## Visual Parity Score

| Khu vực | Score | Verdict |
|---|---:|---|
| Hero category banner | 15/100 | Sai major. |
| Main layout | 55/100 | Container/grid base có, nhưng spacing/extra strip khác. |
| Sidebar filter | 35/100 | Structure có, visual/count/banner/collapse sai. |
| Product count + sort | 40/100 | Có hàng count/sort, nhưng data/style/content sai. |
| Product grid | 65/100 | Desktop 3 cột đúng, nhưng data/card/gap/flow khác. |
| Product card | 20/100 | Structure gần như khác reference. |
| Product card hover | 10/100 | Chỉ border đỏ; thiếu overlay add-to-cart. |
| Pagination | 0/100 | Không render do data chỉ 1 page. |
| SEO/content block | 55/100 | Có block, nhưng style/content/spacing khác. |
| Responsive body | 35/100 | Không overflow, nhưng hero/filter/card flow sai đáng kể. |
| Data correctness | 20/100 | Category đúng, nhưng product/facet/banner/pagination data không đủ. |

Overall visual parity estimate: **32/100**.

## Issue Table

| ID | Severity | Khu vực body | Design expected | Current actual | Evidence screenshot path | Root cause probable | Recommended fix | Có nên fix ngay? |
|---|---|---|---|---|---|---|---|---|
| PLB-P1-001 | P1 | Hero category banner | Road/mountain hero đỏ, title “MŨ BẢO HIỂM” lớn bên trái, breadcrumb nhỏ dưới title, helmet lớn bên phải, slanted white cut dưới hero. | Hero dùng category image tối/blur, full SEO description đẩy title/breadcrumb khỏi vùng nhìn thấy; không có helmet illustration, không slanted cut. | `docs/audits/product-list-body-parity-shots/1920x1080-hero.png`, `docs/audits/product-list-body-parity-shots/390x844-hero.png` | `bigbike-web/app/danh-muc-san-pham/[slug]/page.tsx` truyền `category.image` + full description vào `PageHero`; `PageHero` chỉ render helmet fallback khi không có custom image; CSS không có diagonal cut. | Tách hero description khỏi SEO content, dùng WP hero background/helmet asset cho category này hoặc rule parity riêng; thêm diagonal white cut. | Fix ngay nếu mục tiêu là parity. |
| PLB-P1-002 | P1 | Main layout | Sau hero đi thẳng vào sidebar + product grid như design. | Có strip “DANH MỤC CON” giữa hero và content; top spacing/visual flow khác. | `docs/audits/product-list-body-parity-shots/1920x1080-full-page.png` | `[slug]/page.tsx` render `childCategories` chip strip. | Ẩn hoặc restyle strip theo design; nếu cần giữ UX thì cần xác nhận design mới. | Cần xác nhận nếu strip là yêu cầu business mới; nếu parity thì fix. |
| PLB-P1-003 | P1 | Sidebar filter | Groups “NHÓM SẢN PHẨM”, “GIÁ BÁN”, “THƯƠNG HIỆU”, “MÀU SẮC”; có minus/collapse, count diamond bên phải, active red marker, brand icons, promo banner LS2. | Có group cơ bản nhưng thêm heading “Bộ lọc”, không có minus/collapse desktop, không có count diamond, không active red marker, có brand search extra, không banner. | `docs/audits/product-list-body-parity-shots/1920x1080-sidebar.png`, `docs/audits/product-list-body-parity-shots/390x844-sidebar-open.png` | `CatalogFilters.tsx` dùng filter UI hiện đại; facets API 401 nên không có counts; slider `category_sidebar` empty. | Rebuild sidebar markup/style theo WP reference; publicize/allow facets endpoint; seed sidebar banner data. | Fix ngay, nhưng data endpoint/banner cần backend/admin data xác nhận. |
| PLB-P1-004 | P1 | Product count + sort | `60 sản phẩm`; sort default “GIÁ BÁN TĂNG DẦN”, right aligned, compact bordered dropdown. | `7 sản phẩm`; sort default “Mới nhất”; dropdown style/height/text khác. | `docs/audits/product-list-body-parity-shots/1920x1080-product-count-sort.png`, `docs/audits/product-list-body-parity-shots/390x844-product-count-sort.png` | Backend data only 7 products; `CatalogSortSelect.tsx` default label/options differ from design. | Align default sort to design if still canonical; seed/migrate enough category products or treat 7 as current data truth. | Needs data/design confirmation. |
| PLB-P1-005 | P1 | Product grid / data | Desktop list shows many rows and pagination. | Grid has only 7 cards, last row incomplete, no pagination. | `docs/audits/product-list-body-parity-shots/1920x1080-product-grid.png`, `docs/audits/product-list-body-parity-shots/1920x1080-full-page.png` | Backend `totalItems=7`, `totalPages=1`; `PaginationNav` returns null for one page. | Fix data migration/publication if reference expects 60; otherwise update design expectation. | Needs data confirmation; parity cannot be reached with current data. |
| PLB-P1-006 | P1 | Product card | Grey image box, red `-10%` ribbon, category/tag red, compact title, rating row, current + old price, no stock badge/wishlist in reference. | White image area, real helmet photos with watermark, no discount ribbon/old price, wishlist heart, stock badge bar, card borders and proportions differ. | `docs/audits/product-list-body-parity-shots/1920x1080-product-card-normal.png` | `ProductCard.tsx` uses current ecommerce card structure and live product data; CSS sets image background white. | Add/listing-specific WP parity variant or refactor compact card to match reference; decide whether wishlist/stock remain. | Fix ngay for parity; wishlist/stock need product decision. |
| PLB-P1-007 | P1 | Product card hover | Hover shows black bottom overlay with cart icon and `THÊM VÀO GIỎ HÀNG`, no layout shift. | Hover only changes border to red; add-to-cart bar remains off-card/clipped; first product text is `TẠM HẾT HÀNG` because stock data is out of stock. | `docs/audits/product-list-body-parity-shots/1920x1080-product-card-hover.png` | `ProductCardAddBar.tsx` button has `translate-y-full` but no `bb-product-addbar` class or parent hover utility; product stock state disables first cards. | Add class/parent group hover behavior; ensure in-stock test product exists for hover parity; add cart icon. | Fix ngay after card design decision. |
| PLB-P1-008 | P1 | Pagination | Bottom right/under grid pagination with arrows and `1 - 10` style. | Pagination absent across all viewports. | `docs/audits/product-list-body-parity-shots/1920x1080-full-page.png`, `docs/audits/product-list-body-parity-shots/390x844-full-page.png` | `PaginationNav` hides when `totalPages <= 1`; API only has 7 products. | Seed enough products or implement reference-style range pagination when data has multiple pages. | Data blocker first. |
| PLB-P2-001 | P2 | Product grid spacing | 3 desktop columns with reference card width/gap and image scale. | 3 desktop columns exists, but cards are bordered, taller, 24px gap, real images scale/crop unlike reference. | `docs/audits/product-list-body-parity-shots/1440x1200-product-grid.png` | Current CSS in `globals.css` and live image assets differ from reference. | Tune grid/card dimensions after final card variant is chosen. | Fix with card pass. |
| PLB-P2-002 | P2 | SEO/content block | Light grey/white lower text block matching reference paragraphs, width and line-height similar. | SEO block exists but has real heading and content, larger vertical gap, white page tone, different typography/spacing. | `docs/audits/product-list-body-parity-shots/1920x1080-seo-text-block.png`, `docs/audits/product-list-body-parity-shots/390x844-seo-text-block.png` | Category HTML description rendered through `.bb-cat-seo`; design reference uses different sample content/style. | Style `.bb-cat-seo` to match reference and confirm whether real SEO heading should remain. | Needs content/design confirmation. |
| PLB-P2-003 | P2 | Responsive body | Tablet/mobile hero remains readable; filters become drawer/accordion or stack without pushing content excessively. | Mobile hero title is not visible; 768 filter is fully expanded and pushes product grid far down; 390 collapses filter but open state is a very tall inline accordion. | `docs/audits/product-list-body-parity-shots/768x1024-full-page.png`, `docs/audits/product-list-body-parity-shots/390x844-full-page.png`, `docs/audits/product-list-body-parity-shots/390x844-sidebar-open.png` | Hero description overflow; Tailwind max breakpoint behavior differs at 768; filter mobile pattern not tuned. | Cap hero content, move description to SEO, implement mobile filter drawer/accordion with tested breakpoint behavior. | Fix with hero/sidebar pass. |
| PLB-P2-004 | P2 | Runtime/API body support | Public listing facets should load counts without auth. | Direct `/api/v1/catalog/facets?category=non-bao-hiem-moto` returns 401; UI falls back to no sidebar counts. | `docs/audits/product-list-body-parity-shots/audit-runtime-summary.json` | Backend permission/CORS/security config or endpoint contract mismatch. | Make facets public if category listing requires it, or pass server-authenticated data; verify API contract first. | Needs backend/API confirmation. |
| PLB-P3-001 | P3 | Text encoding/entity display | Text should show `&` and Vietnamese correctly. | Some labels render entity text such as `Mũ Bảo Hiểm Cào Cào &amp; Dual Sport`. | `docs/audits/product-list-body-parity-shots/1920x1080-sidebar.png`, `docs/audits/product-list-body-parity-shots/390x844-full-page.png` | API/category names contain escaped HTML entity or frontend does not decode safe display text. | Normalize category names at import/API or decode safe entities in display helper. | Fix with data cleanup or formatter. |

## Screenshot Evidence

| Viewport | Full page | Hero | Main/sidebar/grid | Card normal | Card hover | Count/sort | SEO | Notes |
|---|---|---|---|---|---|---|---|---|
| 1920x1080 | `docs/audits/product-list-body-parity-shots/1920x1080-full-page.png` | `docs/audits/product-list-body-parity-shots/1920x1080-hero.png` | `1920x1080-main-layout.png`, `1920x1080-sidebar.png`, `1920x1080-product-grid.png` | `1920x1080-product-card-normal.png` | `1920x1080-product-card-hover.png` | `1920x1080-product-count-sort.png` | `1920x1080-seo-text-block.png` | Pagination absent. |
| 1440x1200 | `docs/audits/product-list-body-parity-shots/1440x1200-full-page.png` | `1440x1200-hero.png` | `1440x1200-main-layout.png`, `1440x1200-sidebar.png`, `1440x1200-product-grid.png` | `1440x1200-product-card-normal.png` | `1440x1200-product-card-hover.png` | `1440x1200-product-count-sort.png` | `1440x1200-seo-text-block.png` | Pagination absent. |
| 1024x1366 | `docs/audits/product-list-body-parity-shots/1024x1366-full-page.png` | `1024x1366-hero.png` | `1024x1366-main-layout.png`, `1024x1366-sidebar.png`, `1024x1366-product-grid.png` | `1024x1366-product-card-normal.png` | `1024x1366-product-card-hover.png` | `1024x1366-product-count-sort.png` | `1024x1366-seo-text-block.png` | Pagination absent. |
| 768x1024 | `docs/audits/product-list-body-parity-shots/768x1024-full-page.png` | `768x1024-hero.png` | `768x1024-main-layout.png`, `768x1024-sidebar.png`, `768x1024-product-grid.png` | `768x1024-product-card-normal.png` | `768x1024-product-card-hover.png` | `768x1024-product-count-sort.png` | `768x1024-seo-text-block.png` | Filter expanded before grid. |
| 390x844 | `docs/audits/product-list-body-parity-shots/390x844-full-page.png` | `390x844-hero.png` | `390x844-main-layout.png`, `390x844-sidebar.png`, `390x844-sidebar-open.png`, `390x844-product-grid.png` | `390x844-product-card-normal.png` | `390x844-product-card-hover.png` | `390x844-product-count-sort.png` | `390x844-seo-text-block.png` | Filter collapsed by default, open state captured. |

Runtime/metrics artifacts:

- `docs/audits/product-list-body-parity-shots/audit-runtime-summary.json`
- `docs/audits/product-list-body-parity-shots/localhost-runtime-summary.json`
- `docs/audits/product-list-body-parity-shots/mobile-sidebar-open-summary.json`

## Files / Components Liên Quan Nhưng Không Sửa

- `bigbike-web/app/danh-muc-san-pham/[slug]/page.tsx`
- `bigbike-web/components/layout/PageHero.tsx`
- `bigbike-web/components/catalog/CatalogFilters.tsx`
- `bigbike-web/components/catalog/CatalogSortSelect.tsx`
- `bigbike-web/components/catalog/ProductCard.tsx`
- `bigbike-web/components/catalog/ProductCardAddBar.tsx`
- `bigbike-web/components/ui/PaginationNav.tsx`
- `bigbike-web/lib/api/public-api.ts`
- `bigbike-web/app/globals.css`
- `bigbike-web/STYLEGUIDE.md`

## Blockers

1. `docs/design/product-list.png` không tồn tại trong repo. Audit dùng file reference local/attached `C:/Users/vomin/Downloads/Big Bike/product list.png`.
2. Data blocker: backend chỉ có 7 sản phẩm cho category, không thể chứng minh pagination/count 60 như design.
3. Facets endpoint trả 401 khi gọi public direct, làm filter count diamonds không có data.
4. Sidebar banner placement `category_sidebar` không có slider data.
5. Hero hiện tại lấy full category description vào hero, khiến visual parity không thể đạt chỉ bằng spacing tweak.

## Recommended Next Implementation Plan

1. **Confirm source of truth for category listing design.** Nếu reference 2020 là mục tiêu hiện tại, cần chốt rằng child category strip, wishlist, stock badge, real SEO heading có được giữ hay phải bỏ.
2. **Fix data/API blockers first.** Seed/publish đủ product data cho `non-bao-hiem-moto`, expose facets counts publicly, seed `category_sidebar` banner.
3. **Rebuild hero to reference.** Use road red overlay + helmet illustration + slanted white cut; move long description out of hero into SEO block.
4. **Rebuild listing sidebar.** Match group headings, collapse/minus markers, diamond counts, active red item, brand logos, promo banner.
5. **Create listing-specific product card parity variant.** Add discount ribbon, grey image box, category/tag, rating/price/old price layout, and remove or visually suppress wishlist/stock if reference wins.
6. **Fix hover add-to-cart.** Add cart icon + black overlay; ensure `.ProductCardAddBar` class/parent hover selector works and no layout shift occurs.
7. **Implement reference pagination style.** Only after data has multiple pages; match `1 - 10` range and arrows.
8. **Responsive QA loop.** Re-capture all required viewports after each pass and verify hero/readability/filter/card behavior.

