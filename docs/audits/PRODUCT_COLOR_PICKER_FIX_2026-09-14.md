# Sửa nhóm chọn màu bị lặp — LS2 MX702 Pioneer II

## Phạm vi và căn cứ

- Trang `/product/ls2-mx702-pioneer-ii/` và trang tiếng Anh canonical của cùng sản phẩm.
- `docs/engineering/API_CONTRACT.md`, mục “Variant option — admin round-trip field”, phần tương thích lựa chọn storefront ngày 2026-09-14.
- `docs/engineering/DATA_CONTRACT.md`, mục “Variant display name”: nhãn hiển thị legacy được giữ khi đọc dữ liệu.
- `docs/business/BUSINESS_RULES.md`: `STOCK_RULE_005` (khả năng mua theo biến thể) và `GMC_RULE_004` (chọn sẵn đúng biến thể).

## Nguyên nhân và thay đổi

Đọc `GET http://localhost:8080/api/v1/products/ls2-mx702-pioneer-ii` từ dịch vụ `bigbike-backend` đang chạy xác nhận màu đen dùng nhãn `màu sắc`, màu namib đỏ dùng `Màu sắc`. Bản `?lang=en` còn trộn `color` với `Màu sắc`.

Giao diện gom nhóm bằng chuỗi nguyên bản, nhưng tra giá trị bằng chuỗi đã chuẩn hóa. Vì vậy hai nhóm cùng chứa các lựa chọn màu và có thể giữ hai lựa chọn trái nhau. Điều kiện chọn đủ thuộc tính lại đọc khóa nguyên bản, nên chỉ xóa nhóm trùng vẫn có thể làm nút mua không nhận đúng biến thể.

Thay đổi dùng cùng danh tính thuộc tính cho gom nhóm, tra giá trị, kiểm tra chọn đủ và khởi tạo lựa chọn từ link. Các tên màu đã được bộ nhận diện hiện hữu hỗ trợ dùng chung danh tính; thuộc tính khác vẫn dùng cách chuẩn hóa hiện hữu. Giữ nhãn đầu tiên và thứ tự nhóm. Không sửa dữ liệu, giá, tồn kho, schema hay API response.

Tệp mã nguồn:

- `bigbike-web/lib/utils/variant-match.ts`
- `bigbike-web/lib/utils/product-variant-link.ts`
- `bigbike-web/components/catalog/PurchaseSection.tsx`

## Kiểm tra

- 40/40 kiểm tra liên quan đạt: `variant-match`, `PurchaseSection`, `variant-link`, `VariantPicker`.
- `npm run lint`, kiểm tra định dạng các tệp thay đổi, guard dữ liệu runtime và `git diff --check` đạt. Không thêm CSS hoặc chuỗi giao diện; không phát hiện lỗi mã hóa ở phần sửa.
- Bản đóng gói kiểm thử: `npm run build` đạt.
- Trình duyệt trên bản đóng gói tại `localhost:3100`, dùng backend thật: 6/6 kịch bản đạt trên VI/EN và 375/768/1440px. Kiểm tra một nhóm màu, đổi ảnh, chọn đủ màu–cỡ, mở link chọn sẵn, đổi tiếp màu và không tràn ngang. Không thêm hàng vào giỏ, đặt đơn hay sửa dữ liệu sản phẩm.
- Toàn bộ Vitest: 724 đạt, 2 trượt trong lần chạy cùng build. Chạy lại riêng hai tệp: kiểm tra địa chỉ thanh toán đạt; còn lỗi ngoài phần sửa ở `__tests__/content/public-copy-audit.test.ts:33` do `Hoà`/`Hòa` trong địa chỉ footer.

## Quan sát ngoài phạm vi

- Chế độ phát triển báo thiếu React key trong `AccordionPanel`; không xuất hiện trong kiểm tra trình duyệt bản production. Không sửa thành phần này.
- Alias tiếng Anh dùng slug Việt trả `308` sang slug tiếng Anh và bỏ query `variant`. Link canonical tiếng Anh giữ đúng lựa chọn; kịch bản dùng slug canonical từ dữ liệu thật. Không sửa proxy/registry chuyển hướng trong task chọn màu này.
- Trên tên miền thật qua Cloudflare sau cập nhật: cả 6 kịch bản đi qua toàn bộ assertion chọn màu, ảnh tải thành công, màu–cỡ, link chọn sẵn và không tràn ngang. Tuy nhiên **kết quả tổng của cả 6 kịch bản là trượt** tại guard cuối do script `static.cloudflareinsights.com/beacon.min.js` bị CSP chặn. Không bỏ qua guard hay sửa CSP trong task này.
- Thử riêng cách nối trực tiếp origin bằng quy tắc phân giải tên miền trong Chromium không cho kết quả kiểm chứng ứng dụng: nhiều tài nguyên JavaScript trả `503`, nút radio vẫn ở HTML ban đầu và chưa tương tác được. Đây không phải cách truy cập public đã kiểm ở trên; cấu hình thử tạm đã được gỡ. Không thay cấu hình mạng/Nginx.

## Build VPS

Đã hoàn tất theo yêu cầu dùng `.env.vps`:

1. `docker compose --env-file .env.vps build bigbike-web` — đạt.
2. `docker compose --env-file .env.vps up -d --no-deps bigbike-web` — chỉ tạo lại web.
3. `docker ps --filter name=bigbike-web --filter name=bigbike-backend --format 'table {{.Names}}\t{{.Status}}'` — cả web và backend đều `healthy`; backend giữ thời gian chạy cũ.
4. `docker inspect bigbike-web --format '{{.Image}}'` — image mới `sha256:02732b4023a7769e09ffd5e90c3e63ffbff74ac7ffddd9bdda0a52dc9137770f`.
5. `PW_BASE_URL=https://bigbike.vn E2E_BASE_URL=https://bigbike.vn npx playwright test e2e/variant-selection.e2e.ts --workers=1 --reporter=line` — các kiểm tra chức năng màu/ảnh đạt, guard toàn trang trượt vì Cloudflare beacon như ghi ở trên; không ghi nhận toàn bộ lượt chạy là đạt.

Không sửa `.env.vps`, không khởi động lại backend/admin/database và không commit/push.
