# Dịch nhãn kích cỡ theo ngôn ngữ website

## Phạm vi và căn cứ

- Owner xác nhận cần sửa nhãn đang luôn hiển thị `Size`: VI = `Kích cỡ`, EN = `Size`; không đổi `XL`, `BXL`, `XXL`.
- `docs/engineering/API_CONTRACT.md`, mục “Variant option — admin round-trip field”, phần “Storefront size-group labels” đã cập nhật trước source code.
- Bản dịch có sẵn: `Catalog.filterSize` trong `bigbike-web/messages/vi.json` và `en.json`. Tái sử dụng, không sửa các file dịch đang có thay đổi khác.
- `bigbike-web/STYLEGUIDE.md`: typography/copy của nhãn chức năng giữ in hoa theo CSS hiện hữu.
- `docs/engineering/DEPLOYMENT_GUIDE.md`: build VPS dùng `.env.vps`.

## Nguyên nhân và sửa đổi

`VariantPicker` trước đó in trực tiếp tên nhóm lấy từ dữ liệu vào heading và `aria-label`. Việc gộp alias `Size` / `Kích cỡ` trong lượt trước chỉ sửa danh tính nhóm, không dịch nhãn. API của RSY271 giữ cùng tên thuộc tính ở VI/EN, nên cả hai bản cùng hiển thị `Size`.

Giờ nhãn nhóm được nhận diện là kích cỡ dùng `useTranslations("Catalog")("filterSize")`. Heading và tên truy cập của nhóm radio cùng đổi theo locale. `key`, `selectedOptions`, giá trị truyền `onPick`, ID biến thể, giá, còn/hết hàng và các nhãn không phải kích cỡ giữ nguyên. Không viết logic dịch tên trong cơ sở dữ liệu.

Tệp thay đổi:

- `bigbike-web/components/catalog/purchase/VariantPicker.tsx`.
- `bigbike-web/components/catalog/purchase/VariantPicker.test.tsx`.
- `bigbike-web/e2e/variant-selection.e2e.ts`: kiểm đúng nhãn từng ngôn ngữ và thêm thao tác bấm Việt → Anh → Việt ở 375/768/1440px.
- `docs/engineering/API_CONTRACT.md` và báo cáo này.

## Kiểm tra

- Trước sửa: hai kiểm tra dịch nhãn trượt đúng lỗi ở bản Việt/Anh.
- Sau sửa: 58/58 kiểm tra trong năm tệp đạt: `VariantPicker`, `PurchaseSection`, `variant-match`, `variant-link`, `BigBikeProductCard`. Kiểm tra nhãn dùng provider thật và các bản dịch thật, bao gồm đổi VI → EN → VI với cả khóa gốc `Size` lẫn `Kích cỡ`, giữ giá trị/khóa lựa chọn và không dịch nhầm thuộc tính khác.
- Quy trình `hygiene`: không thêm/sửa CSS; không phát hiện mojibake ở phần sửa; guard business-data runtime đạt. `npm run lint`, Prettier trên ba tệp source/kiểm thử vừa sửa và `git diff --check` phần sửa đều đạt.
- Không chạy lại toàn bộ Vitest trong lượt sửa nhãn nhỏ này. Lượt kiểm toàn bộ trước đó đã ghi lỗi chính tả địa chỉ không liên quan tại `__tests__/content/public-copy-audit.test.ts:33`; không sửa nội dung địa chỉ hoặc bỏ kiểm tra.

## Build và kiểm tra thực tế

- `docker compose --env-file .env.vps build bigbike-web`: đạt (biên dịch, TypeScript, tạo trang, đóng gói image).
- `docker compose --env-file .env.vps up -d --no-deps --wait --wait-timeout 90 bigbike-web`: đạt, container mới `healthy`.
- Image mới: `sha256:ee9d53a16da9e78e620f0de55dd787eeed060bedbf5a51ab5f854a5fce927bc6`. Image cũ `sha256:213b329a51a15f3e646fad193a8938afbdeb8a4dbc973e1a39338f3cfc259a08` được giữ, không prune.
- `docker inspect --format '{{.Name}} {{.Id}} {{.Image}} {{.State.Health.Status}}' bigbike-web bigbike-backend bigbike-admin`: backend/admin giữ nguyên container và image; chỉ thay web.
- Checksum `.env` và `.env.vps` trước build và trước cập nhật không đổi; không ghi giá trị cấu hình hay secret ra báo cáo.
- E2E trên container mới qua `http://localhost:3000`, backend thật `https://api.bigbike.vn`, VI/EN và 375/768/1440px: **8/9 đạt**. Cả ba kịch bản bấm VI → EN → VI đều đạt; các heading và `aria-label` đổi đúng, giá trị XL/BXL/XXL không đổi, link BXL chọn sẵn vẫn đúng, không tràn ngang.
- Ca chọn cỡ VI 768px qua mọi assertion chức năng nhưng **trượt guard cuối** vì Facebook tracking gửi form bị CSP `form-action 'self'` chặn. Không lọc lỗi, không nới CSP, không ghi nhận toàn bộ bộ E2E đạt. Đây là cảnh báo thống kê ngoài phạm vi nhãn, đã quan sát trong lượt trước.
- Đã xem ảnh `size-label-0-vi.png` và `size-label-1-en.png` ở 375px: chữ thực tế lần lượt `KÍCH CỠ` / `SIZE`, cùng ba ô cỡ và BXL được chọn. Không cập nhật ảnh chuẩn.
- Kiểm thêm đúng tên miền `https://bigbike.vn` ở 375px: bấm VI → EN → VI qua đủ ba bước, heading và tên truy cập đổi đúng, cỡ và link BXL giữ nguyên. Có đủ ba ảnh nhãn. **Ca vẫn trượt guard cuối** vì Cloudflare beacon bị CSP chặn, không phải assertion nhãn/ngôn ngữ. Không bỏ qua lỗi thống kê để ghi toàn bộ E2E đạt.

Lệnh kiểm tra trên bản mới:

```bash
PW_BASE_URL=http://localhost:3000 E2E_BASE_URL=http://localhost:3000 PW_BACKEND_ORIGIN=https://api.bigbike.vn npx playwright test e2e/variant-selection.e2e.ts --grep 'RSY271' --workers=1 --reporter=line --output=test-results/size-label-i18n-vps
PW_BASE_URL=https://bigbike.vn E2E_BASE_URL=https://bigbike.vn npx playwright test e2e/variant-selection.e2e.ts --grep 'RSY271.*375.*size heading' --workers=1 --reporter=line --output=test-results/size-label-i18n-public
```

## Giới hạn phạm vi

- Không sửa dữ liệu sản phẩm, backend/admin, tên màu, giá trị màu, cấu hình thống kê hay CSP.
- Đây là sửa nhãn, không thay cơ chế lưu lựa chọn khi chuyển route/ngôn ngữ. Kiểm tra đổi ngôn ngữ dùng link BXL có `?variant=` để xác minh nhãn và giữ đúng lựa chọn từ link. Quan sát trước lượt này cho thấy lựa chọn thủ công trên URL không có `variant` bị bỏ khi đổi ngôn ngữ; nếu URL còn ID BXL nhưng khách đã đổi thủ công sang XXL, chuyển ngôn ngữ có thể khôi phục BXL. Không khẳng định đã sửa các hành vi đó trong task dịch nhãn.
- Không commit/push, không sửa file môi trường hoặc dữ liệu thật để phục vụ kiểm thử.
