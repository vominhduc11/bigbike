# Product List Body Design Parity Fix Report

Ngày: 2026-05-18  
Route target: `/danh-muc-san-pham/non-bao-hiem-moto/`  
Phạm vi yêu cầu: chỉ BODY product listing/category page.

## Kết Luận

**BODY CHƯA ĐẠT 100% VISUAL PARITY.**

Visual implementation đã **dừng ở Phase 1** vì thiếu file reference bắt buộc trong repo:

`Missing reference design: docs/design/product-list.png`

Theo yêu cầu task, khi file `docs/design/product-list.png` chưa tồn tại thì không được dùng path local ngoài repo và không được sửa UI. Vì vậy report này chỉ ghi blocker/fix plan; không có code UI/API/backend nào được chỉnh trong phase này.

## Reference Check

| Check | Result |
|---|---|
| `docs/design/product-list.png` exists | **No** |
| Local ngoài repo `C:/Users/vomin/Downloads/...` | Không dùng cho implementation |
| Visual implementation | Dừng |

## Audit Report Đã Đọc

Đã đọc `docs/audits/PRODUCT_LIST_BODY_DESIGN_PARITY_AUDIT.md`.

Các issue P1/P2 cần xử lý sau khi reference được đặt vào repo:

| ID | Severity | Khu vực | Tóm tắt |
|---|---|---|---|
| PLB-P1-001 | P1 | Hero category banner | Hero sai major: ảnh/overlay/title/breadcrumb/helmet/slanted cut không khớp. |
| PLB-P1-002 | P1 | Main layout | Có strip “Danh mục con” giữa hero và content, khác flow reference. |
| PLB-P1-003 | P1 | Sidebar filter | Thiếu count diamond, active marker, collapse/minus desktop, banner; visual khác. |
| PLB-P1-004 | P1 | Product count + sort | Count là `7 sản phẩm`, sort mặc định “Mới nhất”, khác reference. |
| PLB-P1-005 | P1 | Product grid/data | Chỉ có 7 cards, không có pagination. |
| PLB-P1-006 | P1 | Product card | Card structure khác: thiếu ribbon/old price/grey image box; có wishlist/stock badge. |
| PLB-P1-007 | P1 | Product card hover | Hover thiếu black add-to-cart overlay đúng design. |
| PLB-P1-008 | P1 | Pagination | Không render pagination vì API chỉ có 1 page. |
| PLB-P2-001 | P2 | Grid spacing | Desktop 3 cột có, nhưng spacing/card/image scale khác. |
| PLB-P2-002 | P2 | SEO/content block | Có block nhưng typography/spacing/content khác. |
| PLB-P2-003 | P2 | Responsive body | Mobile/tablet hero/filter/card flow sai đáng kể. |
| PLB-P2-004 | P2 | API facets | Public facets endpoint trả 401 trong audit. |

## Blockers Hiện Tại

| Type | Blocker | Impact |
|---|---|---|
| REFERENCE BLOCKER | `docs/design/product-list.png` không tồn tại | Không thể bắt đầu visual implementation hoặc kết luận parity. |
| DATA BLOCKER | Backend hiện chỉ trả 7 sản phẩm cho category trong audit | Không thể match reference count/pagination nếu design vẫn yêu cầu 60 sản phẩm. |
| API AUTH BLOCKER | Facets endpoint trả 401 trong audit | Sidebar filter count/diamond không có data public. |
| DATA/ASSET BLOCKER | `category_sidebar` slider rỗng trong audit | Không có sidebar promo banner theo design. |
| UI IMPLEMENTATION GAP | Hero, sidebar, card, hover, SEO, responsive khác reference | Cần sửa sau khi reference chuẩn có trong repo. |

## Files Changed

Chỉ tạo report này:

- `docs/audits/PRODUCT_LIST_BODY_DESIGN_PARITY_FIX_REPORT.md`

Không sửa:

- `bigbike-web/app/danh-muc-san-pham/[slug]/page.tsx`
- `bigbike-web/components/layout/PageHero.tsx`
- `bigbike-web/components/catalog/CatalogFilters.tsx`
- `bigbike-web/components/catalog/ProductCard.tsx`
- `bigbike-web/app/globals.css`
- Backend/API/security/data files

## Tests / Build / Browser Verification

Không chạy typecheck/lint/build/Playwright fix screenshots trong phase này, vì chưa có implementation được phép khi thiếu reference design trong repo.

Không tạo `docs/audits/product-list-body-fix-shots/` vì chưa có UI fix để capture.

## Next Steps Sau Khi Gỡ Blocker

1. Đặt file reference chuẩn vào `docs/design/product-list.png`.
2. Re-run Phase 1 để xác nhận reference có trong repo.
3. Trace backend facets endpoint và sửa public read nếu đúng là dữ liệu filter public-safe.
4. Kiểm tra product count/pagination data thật; không hardcode `60 sản phẩm`.
5. Kiểm tra asset/sidebar banner có trong repo hoặc seed data hợp lệ.
6. Sau đó mới sửa UI body theo thứ tự: hero, layout, sidebar, count/sort, grid/card, hover, pagination, SEO, responsive.
7. Capture evidence mới vào `docs/audits/product-list-body-fix-shots/` và cập nhật report này.

