# Product Detail Visual Parity Audit

Ngày audit: 2026-05-18

Scope: đối chiếu trang chi tiết sản phẩm hiện tại của `bigbike-web` với 3 thiết kế user cung cấp:

- `product detail_overview.png`
- `product detail_video gallery.png`
- `product detail_additional information(1).png`

Phase cập nhật này chỉ xử lý data/contract blocker để audit visual parity chính xác hơn. Không sửa CSS/UI hàng loạt.

## Contract Evidence

Căn cứ docs đã đọc trước khi đổi dữ liệu:

- `docs/business/BUSINESS_RULES.md`: public catalog/cart/checkout chỉ dùng sản phẩm `PUBLISHED`; web không tự bán sản phẩm không public.
- `docs/business/STATE_MACHINES.md`: product state `DRAFT -> PUBLISHED` là transition hợp lệ; public read filter chỉ thấy `PUBLISHED`.
- `docs/engineering/API_CONTRACT.md`: public product list/detail trả dữ liệu PDP từ `/api/v1/products` và `/api/v1/products/{slug}`; detail có các field rich content như `description`, `promotionContent`, `contentBottom`.
- `docs/engineering/DATA_CONTRACT.md`: `contentBottom` là vùng SEO/copy phía dưới PDP; `description`/`promotionContent` là rich text content của PDP.

## Runtime

- App frontend: `bigbike-web`
- Route PDP thực tế: `/product/[slug]/`
- Route đã chụp lại: `/product/mu-bao-hiem-ls2-ff327-challenger-carbon/`
- Stack đang chạy bằng Docker Compose:
  - `bigbike-web` tại `127.0.0.1:3000`
  - `bigbike-backend` tại `127.0.0.1:8080`
  - `bigbike-postgres` tại `127.0.0.1:5432`

## Data/Contract Blocker Status

Kết luận phase này: data/contract blocker đã được gỡ ở local/dev.

Thay đổi đã làm:

- Thêm migration dev-only: `bigbike-backend/src/main/resources/db/migration-dev/V1010__seed_product_detail_parity_dev.sql`.
- Publish đúng sản phẩm thiết kế `MŨ BẢO HIỂM LS2 FF327 CHALLENGER CARBON`.
- Set stock local/dev thành `IN_STOCK`, quantity `48`, `force_out_of_stock=false`.
- Set 4 variants size `M/L/XL/XXL` thành available/in-stock.
- Thêm 4 video rows cho tab Video.
- Thêm 5 specification rows cho tab Thông số kỹ thuật.
- Thêm `content_bottom`.
- Publish 4 sản phẩm FF327 sibling để related products có đủ dữ liệu.
- Revalidate Next cache tag `products` và `product:mu-bao-hiem-ls2-ff327-challenger-carbon` trước lần chụp cuối.

Lưu ý asset:

- Product gallery đang dùng asset FF327 có sẵn trong DB/MinIO. Asset này là helmet carbon đen có watermark BigBike, không trùng 100% ảnh helmet trắng trong design.
- Video tab dùng URL video có sẵn gần nhất từ runtime/local data, không phải video asset chính xác từ design vì repo/runtime chưa có asset video đó.

## Current Runtime Evidence

DB local/dev:

```text
slug|publish_status|stock_state|stock_quantity|force_out_of_stock|variants|videos|specs|content_bottom_len
mu-bao-hiem-ls2-ff327-challenger-carbon|PUBLISHED|IN_STOCK|48|f|4|4|5|343
```

Public API:

```json
{
  "status": 200,
  "slug": "mu-bao-hiem-ls2-ff327-challenger-carbon",
  "name": "MŨ BẢO HIỂM LS2 FF327 CHALLENGER CARBON",
  "price": 9900000,
  "stockState": "IN_STOCK",
  "gallery": 5,
  "videos": 4,
  "specifications": 5,
  "variants": 4,
  "hasContentBottom": true,
  "categorySlug": "non-bao-hiem-moto"
}
```

Frontend route:

- `GET http://localhost:3000/product/mu-bao-hiem-ls2-ff327-challenger-carbon/` trả `200`.
- HTML có exact product title, `Video`, `Thông số`.
- Related section render 6 product links trong DOM sau revalidate.

## Screenshot Artifacts

Đã lưu lại 15 ảnh tại:

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

Metadata cuối:

```json
{
  "generatedAt": "2026-05-18T13:36:23.157Z",
  "route": "/product/mu-bao-hiem-ls2-ff327-challenger-carbon/",
  "captureCount": 15,
  "allCapturesOk": true,
  "relatedCounts": [6]
}
```

Toàn bộ 15 capture đều:

- `httpStatus = 200`
- Có đủ 3 tab: `Mô tả sản phẩm`, `Video`, `Thông số kỹ thuật`
- Click đúng tab state cần chụp
- Related DOM có 6 sản phẩm

## Verdict

Data/contract blocker: đã xử lý xong ở local/dev.

Visual parity: vẫn chưa đạt 100%. Sau phase này audit không còn bị chặn bởi product `DRAFT` hoặc thiếu tabs, nhưng giao diện hiện tại vẫn khác thiết kế ở nhiều điểm cần một phase UI riêng.

## Remaining Visual Mismatches

### P1 - Header/navbar chưa khớp thiết kế

Thiết kế có nav `Danh mục sản phẩm`, `Về Bigbike.vn`, `Bigbike News`, `Liên hệ` và cart badge đỏ số 9. Runtime đang là `Trang chủ`, `Tất cả sản phẩm`, `Tin tức`, `Giới thiệu`, `Liên hệ`, badge cart `0`, icon/header mobile khác thiết kế.

### P1 - Product hero chưa khớp thiết kế

Runtime đã mở đúng product FF327 nhưng gallery asset là helmet carbon đen có watermark, không phải ảnh helmet trắng trong design. Layout desktop cũng khác: ảnh chính lớn hơn, thumbnail strip có nút up/down, price màu đỏ lớn, CTA đang ở trạng thái `Vui lòng chọn biến thể` thay vì button đỏ giống design.

### P1 - Tab content chưa khớp layout thiết kế

Tabs đã tồn tại đủ 3 state, nhưng layout nội dung còn khác:

- Overview runtime render rich text dài, trong design là block mô tả + image grid cô đọng.
- Video runtime dùng YouTube iframe/playlist từ data có sẵn, không phải gallery video đúng asset thiết kế.
- Additional information runtime là table đơn giản; design có diagram kích thước W/H, ảnh sản phẩm và thumbnails.

### P1 - Related carousel mới đạt data, chưa đạt visual

Sau revalidate, runtime có 6 related products và desktop hiện 4 card đầu. Tuy nhiên card style vẫn khác design: ảnh/card spacing, sale ribbon, typography, rating/price alignment và arrow/dot position chưa khớp 100%.

### P1 - Footer/content bottom chưa khớp thiết kế

`content_bottom` đã render, footer newsletter/contact links render được, nhưng copy, layout footer, BCT/license placement, copyright và spacing vẫn khác design.

### P1 - Mobile/tablet polish còn lệch

Ở viewport `390x1200`, sticky purchase bar và chat widget vẫn che một phần nội dung. Header mobile có nhiều icon/menu và layout khác thiết kế desktop reference. Cần thiết kế mobile/tablet cụ thể hoặc một pass responsive riêng để kết luận parity.

## Residual Runtime Notes

- Playwright vẫn ghi nhận console `401` trong vài lần load. Chưa trace endpoint trong phase này vì không nằm trong blocker data/tabs.
- Không phát hiện mojibake trong text mới khi đọc/ghi bằng UTF-8. Các chuỗi tiếng Việt trong migration/report được viết thẳng UTF-8, không dùng unicode escape thủ công.

## Evidence Commands

- `docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"`
- DB query against `bigbike-postgres` để verify publish/stock/video/spec/content bottom.
- `GET http://localhost:8080/api/v1/products/mu-bao-hiem-ls2-ff327-challenger-carbon`
- `POST http://localhost:3000/api/revalidate` với tags `products` và `product:mu-bao-hiem-ls2-ff327-challenger-carbon`
- Playwright capture script từ `bigbike-web`, lưu ảnh vào `docs/audits/product-detail-parity-shots/`

## Recommended Next Steps

1. Bắt đầu phase UI visual parity trên route FF327 thật, dùng bộ screenshot mới làm baseline.
2. Quyết định asset policy: dùng đúng asset design hay chấp nhận asset FF327 hiện có trong DB/MinIO.
3. Fix UI theo từng cụm: header, hero/gallery, tab layouts, related carousel, footer, mobile overlays.
4. Sau mỗi cụm, re-run 5 viewport x 3 states và cập nhật metadata.
