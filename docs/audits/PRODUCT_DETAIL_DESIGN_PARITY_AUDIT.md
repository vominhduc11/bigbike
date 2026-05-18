# Product Detail Visual Parity Audit

Ngày audit: 2026-05-18

Scope: đối chiếu trang chi tiết sản phẩm hiện tại của `bigbike-web` với 3 thiết kế user cung cấp:

- `product detail_overview.png`
- `product detail_video gallery.png`
- `product detail_additional information(1).png`

## Runtime

- App frontend: `bigbike-web`
- Route PDP thực tế: `/product/[slug]/`
- Stack đang chạy bằng Docker Compose:
  - `bigbike-web` tại `127.0.0.1:3000`
  - `bigbike-backend` tại `127.0.0.1:8080`
  - `bigbike-postgres` tại `127.0.0.1:5432`
- Route được chụp: `/product/mu-bao-hiem-ls2-ff800-storm/`
- Lý do chọn route: sản phẩm FF327 đúng thiết kế vẫn đang `DRAFT`; FF800 là route helmet public gần bề mặt thiết kế nhất tại thời điểm chụp lại.

## Screenshot Artifacts

Đã lưu 15 ảnh tại:

```text
docs/audits/product-detail-parity-shots/
```

Viewports:

- `1920x1080`
- `1440x1200`
- `1024x1365`
- `768x1200`
- `390x1200`

States:

- `overview`
- `video-gallery`
- `additional-information`

Metadata chụp tự động:

```text
docs/audits/product-detail-parity-shots/metadata.json
```

## Data Blockers

Kết luận parity 100% bị chặn ngay ở data/runtime:

1. Product đúng thiết kế `MŨ BẢO HIỂM LS2 FF327 CHALLENGER CARBON` có trong DB nhưng đang `DRAFT`, không mở được qua public API/PDP.
2. Public API hiện có 15 sản phẩm `PUBLISHED`, nhưng không có FF327.
3. DB runtime hiện có:
   - `product_videos`: 0 rows
   - `product_specifications`: 0 rows
   - `content_bottom`: 0 products
   - `promotion_content`: 0 products
4. Do đó tab `Video` và tab `Thông số kỹ thuật` không tồn tại trong DOM ở runtime. Các screenshot `video-gallery` và `additional-information` ghi nhận trạng thái không click được tab tương ứng, không phải trạng thái thiết kế thật.

## Verdict

Không đạt 100% visual parity.

Trang hiện tại chỉ khớp một phần ý tưởng tổng quát: header đen, logo BigBike, breadcrumb, gallery trái, thông tin mua hàng phải, tab xéo đen/trắng, related products và footer tối. Tuy nhiên bố cục, dữ liệu, typography, spacing, tab states, footer, related carousel, mobile/tablet behavior và nội dung đều lệch đáng kể so với thiết kế.

## Major Mismatches

### P0 - Không thể audit đủ 3 tab bằng data hiện tại

Thiết kế yêu cầu 3 trạng thái tab riêng:

- Overview / Nội tả
- Video gallery
- Additional information / Thông số kỹ thuật

Runtime chỉ render 1 tab: `Mô tả sản phẩm`. Không có tab video hoặc specs vì backend không có dữ liệu tương ứng. Đây là blocker trước mọi chỉnh CSS.

### P0 - Product/design data không trùng

Thiết kế dùng helmet `MŨ BẢO HIỂM LS2 FF327 CHALLENGER CARBON`, giá `9.900.000,00 đ`, còn hàng, size `M/L/XL/XXL`, gallery helmet trắng.

Runtime public route chụp được là helmet `MŨ BẢO HIỂM LS2 FF800 STORM II ECE22.06`, giá `3.190.000 đ`, trạng thái `Hết hàng`, nhiều color selector, size `M/L/XL/XXL`, gallery helmet khác hoàn toàn. Related products vẫn chỉ còn 1 card do data public ít.

### P0 - Encoding check

Không phát hiện mojibake trong các file source PDP/header/footer được kiểm tra khi đọc bằng UTF-8 và scan bằng `rg`.

Lưu ý: PowerShell không truyền `-Encoding UTF8` có thể in tiếng Việt thành mojibake trong terminal, nhưng đó là lỗi cách đọc output, không phải bằng chứng file source bị hỏng.

### P1 - Header/navbar lệch thiết kế

Thiết kế:

- Logo treo lớn ở top-left, chạm xuống khỏi header.
- Nav gồm `Danh mục sản phẩm`, `Về Bigbike.vn`, `Bigbike News`, `Liên hệ`.
- Cart badge đỏ số 9.

Runtime:

- Logo có style treo nhưng kích thước/vị trí khác.
- Nav là `Trang chủ`, `Tất cả sản phẩm`, `Tin tức`, `Giới thiệu`, `Liên hệ`.
- Cart badge là 0.
- Ở viewport `768x1200`, nav bị tràn/cắt ở mép trái.
- Ở viewport `390x1200`, header có 2 icon menu/hamburger.

### P1 - Product hero layout lệch thiết kế

Thiết kế:

- Container khoảng 1200px, product image và info cân đối, ảnh helmet lớn nhưng còn nhiều khoảng trắng.
- Thumbnail 3 item, nền xám nhạt, không có nút up/down rõ.
- Price màu đen trong design overview/video, badge còn hàng đen.

Runtime:

- Container rộng hơn, gallery main rất lớn ở desktop/tablet.
- Thumbnail strip có nút up/down và border đỏ active.
- Price đỏ lớn, badge `Hết hàng` xám.
- Add-to-cart disabled/pink, không giống CTA đỏ trong design.

### P1 - Tab area lệch thiết kế

Thiết kế:

- Có 3 tab xéo cùng hàng, label ngắn: `Khuyến mãi`, `Video`, `Thông số kỹ thuật` hoặc `Mô tả`, `Video`, `Thông số kỹ thuật`.
- Active tab đen, inactive xám trắng.
- Nội dung tab có layout đặc thù từng state.

Runtime:

- Chỉ có 1 tab `Mô tả sản phẩm`.
- Nội dung tab nằm trong box border lớn, khác layout design overview vốn có image/text grid và additional info có diagram/spec layout.
- Không có video gallery layout.
- Không có additional information table/diagram.

### P1 - Related products carousel lệch thiết kế

Thiết kế:

- 4 card helmet trên desktop.
- Có arrow hai bên và pagination dots.
- Product card compact, ảnh vuông, sale ribbon đỏ, rating/price ngang.

Runtime:

- Chỉ 1 related product card do data.
- Không có carousel arrows/dots khi locked.
- Card spacing/kích thước khác, thiếu sale ribbon.

### P1 - Footer lệch thiết kế

Thiết kế:

- Footer top dark gray, content chia 3 cột với newsletter lớn bên trái.
- Bottom black strip có logo, copyright, BCT badge và license text.

Runtime:

- Footer có nội dung khác, copyright năm 2026.
- Không có BCT badge/license trong screenshot chụp.
- Mobile footer chuyển accordion, khác thiết kế desktop full links.

### P1 - Mobile/tablet behavior có lỗi layout

Viewport `768x1200`:

- Header nav bị cắt ở mép trái.
- Product title xuống dưới gallery nhưng bị chat widget che một phần.

Viewport `390x1200`:

- Sticky purchase bar phủ lên vùng tab/content.
- Chat widget và nút nổi che nội dung.
- Header hiện 2 hamburger/menu icon.
- Không có thiết kế mobile tương ứng để chứng minh parity; theo ảnh hiện tại vẫn chưa đạt polish.

## Secondary Mismatches

- Breadcrumb text/category không giống design.
- Short description của product hiện không có ở route chụp, trong design có paragraph ngắn dưới rating.
- Share icon style khác: runtime dùng button border vuông, design là icon xám nhẹ không border rõ.
- Back-to-top button trong design là nút vuông đỏ; runtime screenshot không thấy nút đỏ tương ứng, chỉ thấy widget nổi/chat.
- Footer newsletter copy, phone/email, social links khác design.
- Long text block phía dưới trong design không xuất hiện vì `content_bottom` trống.
- Console có lỗi `401` khi Playwright load trang, cần trace endpoint nếu muốn audit runtime sạch hơn.

## Evidence Commands

- `docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"`
- `GET http://localhost:8080/api/v1/products?size=20&page=1&sort=createdAt:desc`
- `GET http://localhost:8080/api/v1/products/<slug>`
- Read-only DB queries against `bigbike-postgres`:
  - `select publish_status, count(*) from products group by publish_status`
  - `select count(*) from product_videos`
  - `select count(*) from product_specifications`
  - `select ... where lower(name) like '%ff327%'`

## Recommended Next Steps

1. Fix/confirm data first: publish or seed the exact FF327 product with gallery, videos, specs, content bottom, stock and related products matching the design.
2. Khi kiểm tra text bằng terminal, luôn đọc file với UTF-8 để tránh kết luận nhầm do output mojibake.
3. Re-run screenshots on the exact FF327 route.
4. Only after data parity exists, perform CSS/component-level visual parity pass.
