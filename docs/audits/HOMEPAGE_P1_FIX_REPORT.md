# Homepage P1 Fix Report

> **Phase:** Xử lý các issue **P1** trong [HOMEPAGE_DESIGN_PARITY_AUDIT.md](HOMEPAGE_DESIGN_PARITY_AUDIT.md), theo phân loại tại [HOMEPAGE_P1_FIX_PLAN.md](HOMEPAGE_P1_FIX_PLAN.md).
> **Ngày:** 2026-05-18
> **Ràng buộc đã tuân thủ:** không refactor lớn · không đổi API/business/data contract · không hardcode dữ liệu · chỉ sửa CODE cho lỗi chắc chắn thuộc implementation · không đụng P2/P3.

---

## 1. Summary

### Đã sửa (CODE)
- **P1-3 — Mega menu sai kiến trúc.** Viết lại `MegaMenuPanel` từ "panel trắng full-bleed + lưới cột phẳng" thành **card bounded có cột trái danh mục cấp 1 + cột phải flyout** đúng thiết kế. Active item màu đỏ; flyout đổi theo mục đang hover/focus. Đây là issue P1 **duy nhất** chắc chắn thuộc về implementation FE.

### Không sửa — vì là DATA (môi trường thiếu dữ liệu)
Điều tra backend (`GET /api/v1/...`) cho thấy DB hiện tại chỉ có **3 sản phẩm**, và sliders trỏ tới `productId` của sản phẩm **không tồn tại**. Ba issue P1 còn lại có root cause là dữ liệu, **không phải bug code** — chi tiết & hướng dẫn cấu hình ở mục 3:
- **P1-1 — Hero hiển thị banner phẳng.** Code hero đã hỗ trợ đầy đủ overlay; chỉ thiếu sản phẩm liên kết.
- **P1-2 — Mất dải 3 card dưới hero.** Block `FEATURED_GRID` có 0 sản phẩm; code render có điều kiện đúng (không tạo khoảng trắng rỗng).
- **P1-4 — "Item đặc sắc" chỉ 1 sản phẩm.** Block `RECOMMENDED_CAROUSEL` chỉ có 2 sản phẩm; logic component đúng.

### Không sửa — cần xác nhận (NEEDS_CONFIRMATION)
- **Tab "Chưa phân loại"** trong section "Item đặc sắc": đây là **tên category có thật** trong DB (sản phẩm `LS2 KOKU KIDNEY BELT` được gán vào category tên đúng chữ "Chưa phân loại"). Việc ẩn cứng tab này bằng code có thể giấu sản phẩm hợp lệ ở các trang khác cũng dùng category đó → chỉ nên xử lý bằng DATA (đổi tên / gán lại category). Cần xác nhận với chủ sản phẩm trước khi đụng code.

---

## 2. Fixed CODE Issues

| Issue | Files Changed | Before | After | Screenshot |
|---|---|---|---|---|
| **P1-3** Mega menu sai kiến trúc | [`components/layout/HeaderNavItem.tsx`](../../bigbike-web/components/layout/HeaderNavItem.tsx) — viết lại hàm `MegaMenuPanel`; cập nhật selector focus `ArrowDown` từ `.mega-col-title` → `.mega-cat-item`. [`app/globals.css`](../../bigbike-web/app/globals.css) — thay block CSS `.mega-*` (bỏ `.mega-quicklinks/.mega-columns/.mega-col-*`, thêm `.mega-cat-*/.mega-flyout-*`). | Panel `position:fixed; left:0; right:0` trắng **trải hết chiều ngang màn hình**; bên trong là hàng pill quicklink + nhiều cột danh mục phẳng hiện đồng thời. | **Card bounded** (`width: min(100% - 48px, 60rem)`, centered, shadow, viền đỏ trên): cột trái 270px là **danh sách dọc danh mục cấp 1**, cột phải là **flyout** hiện danh mục con của mục đang hover/focus. Mục đang chọn + mục active path tô **đỏ**. | `megamenu-open.png`, `megamenu-hover-cat3.png` |

**Chi tiết thay đổi `MegaMenuPanel`:**
- Thêm `useState` lưu chỉ số danh mục cấp 1 đang chọn; mặc định mở danh mục **đầu tiên có con** (tránh flyout trống).
- Cột trái render **toàn bộ** `nodes` cấp 1 (cả mục có/không có con) thành list dọc; `onMouseEnter`/`onFocus` cập nhật flyout.
- Cột phải render `children` (và `children` cấp sâu hơn) của danh mục đang chọn; nếu mục không có con hiển thị dòng gợi ý ngắn thay vì để trống.
- Giữ nguyên: cây menu `HeaderNavNode`, nguồn dữ liệu `getPublicMenu("primary")`, backdrop, đóng khi click ngoài / cuộn / Escape, ARIA, hook mở/đóng có delay.

**Phạm vi giới hạn:** chỉ 2 file, chỉ 1 component + 1 block CSS. Không đụng `SubMenu`, `MobileHeaderMenu`, `SiteHeader`, hay bất kỳ module nào khác.

---

## 3. DATA Issues To Configure In Admin

| Issue | Required Data / Admin Action | Expected Result |
|---|---|---|
| **P1-1** Hero banner phẳng | DB hiện chỉ có 3 sản phẩm; 7/8 home slider trỏ tới `productId` (`wp-prod-38469`, `wp-prod-37433`…) **không tồn tại**. → Import/khôi phục đầy đủ sản phẩm vào catalog, **hoặc** vào admin sửa từng home slider để gán lại sang sản phẩm đang tồn tại. | `getProductBySlug()` resolve được → `toHeroSlide()` có `productName/categoryName/productCode` → hero tự render overlay (danh mục + tên + nút "MUA NGAY" + watermark + mã slide). Không cần sửa code. |
| **P1-2** Mất dải 3 card dưới hero | Vào admin sản phẩm, gán **≥ 3 sản phẩm** vào homepage block **`FEATURED_GRID`** (hiện đang 0). | `listProducts({ homepageBlock: "FEATURED_GRID" })` trả ≥ 3 → Block 2 render lưới 3 card ngay dưới hero. |
| **P1-4** "Item đặc sắc" chỉ 1 sản phẩm | Gán thêm sản phẩm vào homepage block **`RECOMMENDED_CAROUSEL`** (hiện chỉ 2). Khuyến nghị ≥ 4 để mỗi tab đủ card như thiết kế. | Section "Item đặc sắc" hiển thị đủ card mỗi tab. |
| **P1-4** Tab "Chưa phân loại" | Sản phẩm `LS2 KOKU KIDNEY BELT` đang thuộc category tên **"Chưa phân loại"**. → Đổi tên category đó thành tên thật, **hoặc** gán sản phẩm sang category đúng (vd "Giáp bảo hộ"). | Tab hiển thị tên danh mục đúng, không còn "Chưa phân loại". |

> **Lưu ý:** Không có thay đổi data contract nào được yêu cầu. Tất cả hành động trên đều nằm trong khả năng cấu hình của admin với schema hiện tại (`homepageBlock` enum, slider `productId`, category name).

---

## 4. Verification

| Hạng mục | Kết quả |
|---|---|
| **Build** | ✅ PASS — `npm run build` (Next.js 16.2.4) hoàn tất, không lỗi compile; route list render đầy đủ. |
| **Lint** | ✅ PASS — `eslint components/layout/HeaderNavItem.tsx` exit 0, không warning. |
| **TypeScript** | ✅ PASS (build Next.js bao gồm type-check, không lỗi). |
| **Viewports kiểm tra** | Desktop 1920×1080, Laptop 1440×900, Tablet 768×1024, Mobile 390×844 — **không viewport nào có horizontal overflow** (`scrollW === clientW` cả 4). |
| **Mega menu** | Card bounded `x=480, width=960` (centered trong 1920) — **không full-bleed, không tràn viewport**. 9 mục cấp 1 ở cột trái; flyout đổi đúng khi hover sang danh mục khác (verified `megamenu-hover-cat3.png`); active item đỏ. |
| **Trang chủ** | Render bình thường sau khi sửa — header/hero/section không vỡ (`desktop-1920--top.png`). |

**Cách verify:** build production cục bộ → chạy `next start` trên cổng **3001** (không đụng container Docker đang chạy ở cổng 3000) → chụp Playwright (Chromium headless). Script tạm `_bbtmp-after.mjs` đã chạy rồi **xoá**; server cục bộ đã tắt.

**Screenshots path:** [`docs/audits/homepage-p1-after-shots/`](homepage-p1-after-shots/)
- `desktop-1920--{top,full}.png`, `laptop-1440--*`, `tablet-768--*`, `mobile-390--*`
- `megamenu-open.png`, `megamenu-hover-cat3.png` — mega menu sau khi sửa
- `hero-default.png`, `featured-products.png`
- `_after-log.txt` — log overflow + kích thước panel

---

## 5. Remaining Issues

**P1 còn lại (DATA — chờ admin cấu hình, không phải việc code):**
- P1-1 Hero, P1-2 dải 3 card, P1-4 "Item đặc sắc" — xem mục 3. Sau khi admin cấu hình dữ liệu, các khối này tự hiển thị đúng nhờ code sẵn có; nên chụp lại để xác nhận parity.

**NEEDS_CONFIRMATION:**
- Tab "Chưa phân loại" — chờ xác nhận hướng xử lý (khuyến nghị: DATA, đổi tên/gán lại category).

**P2/P3 chưa xử lý (ngoài phạm vi phase này — vẫn nằm trong audit gốc):**
- P2: search overlay (heading/placeholder/khái niệm gợi ý), account dropdown, burger thiếu Instagram, footer cột phải trống, heading "Item đặc sắc" sai chữ, menu chính sai wording, category grid 12 ô, ảnh promo.
- P3: bố cục section uy tín, hover đỏ category, wording "Xem tiếp", nút "Xem thêm" video, excerpt blog, separator ◆, header auto-hide, brand list, SEO heading.

**Console 401 — CHƯA xử lý, để phase riêng:**
- Mọi viewport vẫn log 1 lỗi `Failed to load resource: 401` (nghi là API tài khoản/giỏ hàng gọi khi chưa đăng nhập). Không vỡ trang. Cần task điều tra riêng.

**Ghi chú phụ (không phải P1, không sửa phase này):**
- `app/page.tsx` gọi `getProductBySlug()` cho **mọi** slider; với dữ liệu hiện tại là 7 lần × 404 mỗi lần ISR revalidate — lãng phí nhẹ, không vỡ gì. Sẽ tự hết khi P1-1 được cấu hình data đúng.
- `globals.css` còn mojibake ở **comment** vùng lân cận (di sản cũ); phần CSS mới thêm là UTF-8 sạch. Không sửa mojibake cũ trong phase này để giữ phạm vi hẹp.

---

## 6. Risk Notes

| Khu vực | Đánh giá rủi ro |
|---|---|
| **SEO** | ✅ Không ảnh hưởng. Không đổi `app/page.tsx`, `revalidate`, metadata, JSON-LD, heading. Chỉ sửa component menu client + CSS. |
| **ISR / SSR** | ✅ Không ảnh hưởng. Không đổi data-fetching, `revalidate = 3600`, hay cấu hình render. `MegaMenuPanel` vẫn là client component như trước. |
| **Header / menu behavior** | ⚠️ Thấp. Đã thay layout mega menu nhưng **giữ nguyên**: hook mở/đóng (`openMenu`/`closeMenu`/delay), backdrop, đóng khi click ngoài / cuộn / Escape, ARIA (`aria-haspopup`/`aria-expanded`/`aria-controls`), điều hướng `ArrowDown` (đã cập nhật selector focus theo class mới). Verified mở/hover/đổi danh mục hoạt động. |
| **Category navigation** | ✅ Không ảnh hưởng. Mọi link danh mục vẫn dùng `normalizeMenuUrl(node.url)` từ cùng cây menu; không đổi URL, không đổi nguồn dữ liệu menu. |
| **Product data rendering** | ✅ Không ảnh hưởng. Không đụng `ProductCard`, `FeaturedProductsTabbedGrid`, `HeroSlider`, hay query sản phẩm. Các issue dữ liệu được xử lý bằng cấu hình admin, không bằng code. |
| **Mobile** | ✅ Không ảnh hưởng. Mega menu mobile dùng `MobileHeaderMenu` riêng — không bị đụng; mega panel desktop không hiển thị ở mobile. |
| **Dead CSS** | ✅ Đã gỡ sạch các class `.mega-quicklinks/.mega-columns/.mega-col-*` không còn dùng cùng lúc với việc thay component — không để lại CSS chết. |

---

*Hết báo cáo. Phase này chỉ sửa CODE cho 1 issue P1 (mega menu); 3 issue P1 còn lại được xác định là DATA và ghi hướng dẫn cấu hình admin, không vá bằng hardcode.*
