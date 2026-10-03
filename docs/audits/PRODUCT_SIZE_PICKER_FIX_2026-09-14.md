# Sửa nhóm kích cỡ bị tách — Taichi RSY271

## Phạm vi và căn cứ

- Trang `/product/quan-moto-mua-he-taichi-rsy271/` và trang canonical tiếng Anh của cùng sản phẩm.
- `docs/engineering/API_CONTRACT.md`, mục “Variant option — admin round-trip field”: tên `Size` / `Kích cỡ` dùng chung một lựa chọn khi đọc dữ liệu.
- `docs/engineering/DATA_CONTRACT.md`, mục “Variant display name”: giữ nhãn hiển thị cũ, không sửa liên kết từ điển hay giá trị kích cỡ.
- `docs/business/BUSINESS_RULES.md`: `STOCK_RULE_005` và `GMC_RULE_004`.
- Build VPS theo `docs/engineering/DEPLOYMENT_GUIDE.md`: chỉ dùng `.env.vps`, không sửa file môi trường.

## Bằng chứng runtime và nguyên nhân

Đã xác nhận `bigbike-web`, `bigbike-backend`, `bigbike-postgres` đang chạy bằng `docker ps` trước khi đọc.

- `GET http://localhost:8080/api/v1/products/quan-moto-mua-he-taichi-rsy271`: XL/XXL có tên thuộc tính `Size`; BXL có tên `Kích cỡ`.
- `docker exec -i bigbike-postgres … psql` với `BEGIN READ ONLY; SELECT …; ROLLBACK;`, nối `product_variants`, `product_variant_options`, `attributes`, `attribute_values` theo sản phẩm này: cả ba cùng `attribute_id=wp-attr-6662`, `code=size`, tên từ điển `Size`. Riêng BXL có `legacy_display_name=Kích cỡ`; XL/XXL không có snapshot tên cũ.
- Chạy hàm chọn biến thể trên payload thật trước sửa: hai nhóm `Size` / `Kích cỡ`; chọn riêng từng cỡ trả đúng SKU, nhưng chọn đồng thời `XXL` và `BXL` như ảnh trả về không có biến thể phù hợp.

Nguyên nhân là storefront chưa coi hai tên kích cỡ này là cùng một nhóm. Bản sửa màu trước đó không bao gồm alias kích cỡ. Không có bằng chứng các cỡ bị gán nhầm nhóm trong cơ sở dữ liệu.

Truy vấn kiểm chứng rút gọn, chỉ đọc trong `bigbike-postgres`:

```sql
SELECT v.sku, o.attribute_id, a.code, a.name, av.label,
       o.legacy_display_name, o.legacy_display_value
FROM product_variant_options o
JOIN product_variants v ON v.id = o.variant_id
JOIN attributes a ON a.id = o.attribute_id
JOIN attribute_values av ON av.id = o.attribute_value_id
WHERE v.product_id = 'prod_d6a45f4a86f64ac8a4a13ed3c2a8bd86'
ORDER BY v.sku, o.sort_order;
```

## Thay đổi

- Mở rộng `normalizeAttributeName` để `Size` / `Kích cỡ` dùng chung khóa, theo chuẩn hóa dấu, hoa/thường và khoảng cách hiện hữu.
- Tái sử dụng luồng gom nhóm, tìm biến thể, giá, còn/hết hàng và khởi tạo link chọn sẵn đã có; chỉ giữ một lựa chọn kích cỡ tại một thời điểm.
- Giữ nguyên `BXL`, nhãn đầu tiên, thứ tự lựa chọn, ảnh xem trước chỉ theo màu và các thuộc tính không liên quan. Không tự gộp `Kích thước` hoặc `Pack size`.
- Thêm kiểm tra hồi quy cho đổi cỡ, link BXL chọn sẵn, gửi đúng ID vào giỏ, bỏ chọn và chặn cỡ hết hàng. Thao tác thêm giỏ chỉ chạy trong kiểm thử đơn vị với hàm giả; không thêm giỏ hoặc đặt đơn trên hệ thống thật.
- Mở rộng E2E hiện hữu cho VI/EN ở 375/768/1440px, lấy sản phẩm thật; helper CORS chỉ nhận thêm origin API tùy chọn để kiểm bản VPS qua cổng localhost. Mọi response dữ liệu vẫn lấy từ backend thật; không đổi CORS server.

Tệp thay đổi trong lượt này: `bigbike-web/lib/utils/variant-match.ts`; ba tệp kiểm thử `__tests__/utils/variant-match.test.ts`, `__tests__/merchant/variant-link.test.ts`, `components/catalog/PurchaseSection.test.tsx`; `e2e/variant-selection.e2e.ts`, `e2e/helpers/preview-backend.ts`; `docs/engineering/API_CONTRACT.md` và báo cáo này. Các đường dẫn kiểm thử nêu trên thuộc `bigbike-web/`. Giữ nguyên các thay đổi có sẵn, kể cả bản sửa nhóm màu trước đó.

## Kiểm tra

- Trước sửa: 11 kiểm tra hồi quy mới trượt đúng lỗi tên nhóm, khớp biến thể và link chọn sẵn.
- Sau sửa: 51/51 kiểm tra trong `variant-match`, `variant-link`, `PurchaseSection` đạt. Lượt kiểm cuối thêm `VariantPicker`, hai tệp bị timeout trong lượt toàn bộ, chạy `--maxWorkers=1`: 58/58 đạt (sáu tệp).
- `npm run lint`, Prettier trên sáu tệp mã/kiểm thử và `git diff --check` phần sửa: đạt. Quy trình `hygiene` không phát hiện mojibake hay business-data hardcode; không thêm/sửa CSS hoặc chuỗi giao diện.
- Toàn bộ `npm run test`: 736/739 đạt, ba lỗi. Hai lỗi timeout ở `english-copy-audit` và `CheckoutAddressFields` đạt khi chạy lại riêng trong lượt 58/58. Lỗi còn lại ngoài phạm vi tại `__tests__/content/public-copy-audit.test.ts:33`: địa chỉ footer hiện có `Hoà` nhưng kiểm tra đòi `Hòa`; không sửa nội dung địa chỉ hoặc bỏ qua kiểm tra.
- E2E trên container VPS vừa cập nhật, truy cập `http://localhost:3000` với backend thật `https://api.bigbike.vn`: lượt 12 kịch bản màu + cỡ, VI/EN, 375/768/1440px có 10 đạt, hai trượt. Một ca EN 375px dừng ở chờ `networkidle` dù snapshot trang đã có một nhóm và BXL chọn sẵn; sửa cách chờ của kịch bản kích cỡ sang `load` rồi kiểm trạng thái điều khiển, chạy lại ca đó đạt 1/1. Không bỏ assertion hoặc guard runtime.
- Ca VI 1440px đã qua toàn bộ assertion chọn cỡ, bỏ chọn, link BXL, đổi sang XXL, nút mua và không tràn ngang, nhưng **trượt guard cuối** vì công cụ thống kê Facebook gửi form tới `https://www.facebook.com/tr/` bị CSP `form-action 'self'` chặn (nguồn script Google Tag Manager). Không sửa CSP, không tắt công cụ thống kê, không lọc bỏ cảnh báo để lấy kết quả xanh. Không ghi nhận cả bộ E2E đạt.
- Đã xem ảnh kết quả VI 375px: chỉ một hàng `SIZE` chứa `XL`, `BXL`, `XXL`, một cỡ được chọn. Không cập nhật ảnh chuẩn và không sửa CSS.
- Xác minh thêm qua tên miền thật `https://bigbike.vn` ở VI/EN 375px: cả hai ca đều qua toàn bộ assertion nhóm cỡ, đổi cỡ, link chọn sẵn, nút mua và không tràn ngang. **Kết quả tổng vẫn là hai ca trượt** tại guard cuối vì Cloudflare beacon bị CSP chặn và Facebook tracking bị `form-action` chặn. Quy trình `e2e` giữ các lỗi này trong báo cáo; không nới CSP hoặc sửa thống kê ngoài phạm vi.

Lệnh E2E sau cập nhật:

```bash
PW_BASE_URL=http://localhost:3000 E2E_BASE_URL=http://localhost:3000 PW_BACKEND_ORIGIN=https://api.bigbike.vn npx playwright test e2e/variant-selection.e2e.ts --workers=1 --reporter=line --output=test-results/size-picker-vps-local
PW_BASE_URL=http://localhost:3000 E2E_BASE_URL=http://localhost:3000 PW_BACKEND_ORIGIN=https://api.bigbike.vn npx playwright test e2e/variant-selection.e2e.ts --grep 'RSY271.*375.*\(en\)' --workers=1 --reporter=line --output=test-results/size-picker-vps-recheck
PW_BASE_URL=https://bigbike.vn E2E_BASE_URL=https://bigbike.vn npx playwright test e2e/variant-selection.e2e.ts --grep 'RSY271.*375' --workers=1 --reporter=line --output=test-results/size-picker-public
```

## Build và cập nhật VPS

- `docker compose --env-file .env.vps build bigbike-web`: đạt, gồm biên dịch, TypeScript và tạo trang.
- `docker compose --env-file .env.vps up -d --no-deps --wait --wait-timeout 90 bigbike-web`: đạt, chỉ tạo lại web, kiểm tra sức khỏe đạt.
- `docker inspect --format '{{.Name}} {{.Image}} {{.State.Health.Status}}' bigbike-web bigbike-backend bigbike-admin`: web chạy image `sha256:213b329a51a15f3e646fad193a8938afbdeb8a4dbc973e1a39338f3cfc259a08`, trạng thái `healthy`. Backend/admin giữ nguyên image và container đang chạy; không khởi động lại dịch vụ khác.
- Image web trước cập nhật `sha256:02732b4023a7769e09ffd5e90c3e63ffbff74ac7ffddd9bdda0a52dc9137770f` vẫn được giữ, không prune.
- Đối chiếu checksum `.env` và `.env.vps` trước build, trước cập nhật: không thay đổi. Không ghi giá trị cấu hình hay secret vào báo cáo.

Không thay đổi sản phẩm, giá, tồn kho, dữ liệu khách hàng, API response, database schema hoặc cấu hình triển khai. Không commit/push.
