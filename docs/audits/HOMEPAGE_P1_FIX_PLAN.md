# HOMEPAGE P1 FIX PLAN — bigbike-web

> **Phase:** Phân loại & xử lý các issue **P1** trong [HOMEPAGE_DESIGN_PARITY_AUDIT.md](HOMEPAGE_DESIGN_PARITY_AUDIT.md).
> **Ngày:** 2026-05-18
> **Nguyên tắc:** Không refactor lớn · không đổi API/business/data contract · không hardcode dữ liệu nếu đã có data source · chỉ sửa CODE cho lỗi chắc chắn thuộc implementation · không đụng P2/P3.

---

## 1. Bằng chứng điều tra (query backend thật)

Backend Docker (`bigbike-backend`, `127.0.0.1:8080`) — trạng thái dữ liệu hiện tại:

| Kiểm tra | Lệnh | Kết quả |
|---|---|---|
| Tổng số sản phẩm | `GET /api/v1/products?size=1` | **`totalItems = 3`** — DB gần như rỗng |
| Sản phẩm block FEATURED_GRID | `GET /api/v1/products?homepage_block=FEATURED_GRID` | **`totalItems = 0`** |
| Sản phẩm block RECOMMENDED_CAROUSEL | `GET /api/v1/products?homepage_block=RECOMMENDED_CAROUSEL` | **2 sản phẩm**: `TÚI CHỐNG NƯỚC ILM BL01` (cat "BALÔ ĐEO LƯNG…"), `LS2 KOKU KIDNEY BELT` (cat **"Chưa phân loại"**) |
| Home sliders | `GET /api/v1/sliders?location=home` | **8 slider**; 7 slider có `productId` + `productLink` `/sp/<slug>.html`, 1 slider chỉ có category link |
| Sản phẩm mà slider trỏ tới | `GET /api/v1/products/<slug>` cho slug parse từ slider | **404 toàn bộ** — vd `wp-prod-38469`, slug `…s9xm…`, `mu-bao-hiem-fullface-ilm-racing-helmet-mf509` đều không tồn tại |

**Kết luận điều tra:** DB hiện tại là môi trường dev mới import dở — chỉ có 3 sản phẩm. Sliders được import từ WordPress (`scripts/extract-wp-data`) tham chiếu tới `productId` của các sản phẩm **chưa được import**. Vì vậy:

- Hero không hiện overlay vì `getProductBySlug()` trả 404 → `toHeroSlide()` nhận `product = null` → `hasProduct = false`. **Code chạy đúng**, chỉ thiếu dữ liệu sản phẩm.
- Dải 3 card dưới hero không render vì block `FEATURED_GRID` rỗng. **Code render có điều kiện đúng**.
- "Item đặc sắc" chỉ có 1–2 card vì block `RECOMMENDED_CAROUSEL` chỉ có 2 sản phẩm; tab "Chưa phân loại" là **tên category thật** trong DB (`LS2 KOKU KIDNEY BELT` được gán category tên đúng chữ "Chưa phân loại"). **Code không bịa tab này**.

---

## 2. Bảng phân loại P1

| Priority | Issue | Type | Root Cause | Files / Data liên quan | Fix Strategy | Will Fix Now? |
|---|---|---|---|---|---|---|
| **P1-1** | Hero hiển thị banner phẳng — thiếu tên SP, CTA "MUA NGAY", watermark | **DATA** | 7/8 slider trỏ tới `productId` của sản phẩm không tồn tại trong DB (mới import 3/nhiều sản phẩm). `getProductBySlug` → 404 → `hasProduct=false`. Component hero đã hỗ trợ đầy đủ overlay. | `app/page.tsx` (`toHeroSlide`, `sliderProductSlug`), `components/home/HeroSlider.tsx`, backend product data, slider config | Không sửa code. Admin import/khôi phục các sản phẩm mà slider tham chiếu, **hoặc** gán lại slider sang sản phẩm đang tồn tại. Code overlay sẽ tự render khi product resolve được. | ❌ DATA |
| **P1-2** | Mất dải 3 card sản phẩm ngay dưới hero | **DATA** | Block `FEATURED_GRID` có 0 sản phẩm. Code: `{featuredProducts.length > 0 && (...)}` — render có điều kiện, không tạo khoảng trắng rỗng. | `app/page.tsx` Block 2, `components/catalog/ProductCard.tsx`, backend `homepage_block` data | Không sửa code (không hardcode sản phẩm). Admin gán ≥3 sản phẩm vào block `FEATURED_GRID`. | ❌ DATA |
| **P1-3** | Mega menu sai kiến trúc — panel trắng full-bleed, lưới cột phẳng thay vì sidebar danh mục + flyout | **CODE** | `MegaMenuPanel` render `quickLinks` (pill) + `columns` phẳng cạnh nhau, panel `position:fixed; left:0; right:0`. Đây là lựa chọn layout của FE component, độc lập với dữ liệu menu. | `components/layout/HeaderNavItem.tsx` (`MegaMenuPanel`), `app/globals.css` (`.mega-*`) | Viết lại `MegaMenuPanel`: cột trái = list danh mục cấp 1; cột phải = flyout danh mục con của mục đang hover/focus; active đỏ; panel bounded, không full-bleed. CSS thay block `.mega-*` cũ. Không đụng menu data / API. | ✅ **CODE** |
| **P1-4** | "Item đặc sắc" chỉ 1 sản phẩm + có tab "Chưa phân loại" | **DATA** | Block `RECOMMENDED_CAROUSEL` chỉ 2 sản phẩm. "Chưa phân loại" là **tên category có thật** trong DB; `FeaturedProductsTabbedGrid` tạo tab theo `p.category.name` — đúng logic, không bug. | `components/home/FeaturedProductsTabbedGrid.tsx`, `app/page.tsx` Block 4, backend product/category data | Không sửa code. Admin: (a) gán thêm sản phẩm vào `RECOMMENDED_CAROUSEL`; (b) đổi tên category "Chưa phân loại" hoặc gán sản phẩm `LS2 KOKU KIDNEY BELT` sang category đúng. Việc ẩn cứng tab "Chưa phân loại" trong code = **NEEDS_CONFIRMATION** (có thể giấu sản phẩm hợp lệ ở mọi nơi khác dùng category này). | ❌ DATA (1 phần NEEDS_CONFIRMATION) |

---

## 3. Quyết định phạm vi sửa CODE phase này

**Chỉ sửa 1 issue:** **P1-3 — Mega menu** (chắc chắn 100% là lỗi implementation FE).

**Không sửa code cho P1-1, P1-2, P1-4** vì:
- Tất cả đều có root cause là **thiếu/sai dữ liệu**, không phải bug code.
- Component liên quan đã render đúng theo dữ liệu được cấp; thêm code chỉ để "vá" trạng thái rỗng = nguy cơ hardcode (bị cấm).
- Hướng dẫn cấu hình admin được ghi đầy đủ trong [HOMEPAGE_P1_FIX_REPORT.md](HOMEPAGE_P1_FIX_REPORT.md) mục "DATA Issues To Configure In Admin".

**NEEDS_CONFIRMATION:** việc ẩn/đổi tab "Chưa phân loại" — chỉ nên xử lý bằng data (đổi tên category). Nếu sản phẩm muốn đó là việc của code, cần xác nhận với chủ sản phẩm vì category này có thể đang được dùng ở trang danh mục/catalog khác.

---

## 4. Ràng buộc khi sửa Mega menu (P1-3)

- Không đổi API contract: menu vẫn lấy từ `getPublicMenu("primary")`, cây `HeaderNavNode` giữ nguyên.
- Không đổi data contract / business logic.
- Không đụng `MobileHeaderMenu` (mega menu mobile dùng component riêng — không phụ thuộc hover).
- Giữ nguyên: backdrop, hành vi đóng khi click ngoài / cuộn / Escape, ARIA `aria-haspopup`/`aria-expanded`/`aria-controls`, hook mở/đóng có delay.
- Z-index: mega panel dưới header, trên nội dung; không xung đột search overlay / account dropdown.
- Giữ keyboard: `ArrowDown` mở menu và focus item đầu (cập nhật selector focus theo class mới).
- Chỉ thay `MegaMenuPanel` (1 hàm) + block CSS `.mega-*`. Không lan sang `SubMenu`, `HeaderNavItem` core, các module khác.
