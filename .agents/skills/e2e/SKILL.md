---
name: e2e
description: "Dùng khi cần viết hoặc chạy kịch bản kiểm thử đầu-cuối Playwright cho bigbike-admin hoặc bigbike-web. Tự động đi qua luồng như người dùng thật trên hệ thống đang chạy, bắt lỗi console và API, so ảnh giao diện khi cần, kiểm nhiều kích thước màn hình, dùng đúng fixture đăng nhập, helper chất lượng UI và quy ước dữ liệu thử E2E của repo."
---

# e2e — Kiểm thử đầu-cuối trên hệ thống thật

Khác test đơn vị (Vitest, chạy trong bộ nhớ, dữ liệu giả): kịch bản ở đây **chạy trên hệ thống thật, backend thật, dữ liệu thật**. Vì vậy luật số một là **không được làm hỏng dữ liệu shop**.

## ⚠️ Chế độ chạy liên tục

Một lần gọi = viết xong + chạy xong + báo cáo trong phiên. Không dừng giữa chừng xin duyệt. Cần owner quyết → hỏi user bằng 2–4 phương án cụ thể rồi tiếp tục sau khi có trả lời. Hệ thống chưa chạy → ghi `Not run: <lý do>` rồi làm nốt phần viết kịch bản, **không dừng phiên**.

## Bước 0 — Xác định phạm vi

1. Luồng cần kiểm là gì, **nói bằng ngôn ngữ người dùng**: "khách thêm hàng vào giỏ → đặt đơn → đơn hiện trong admin".
2. App nào?
   - **admin** — bộ kiểm thử đã trưởng thành: `bigbike-admin/e2e/` có fixture đăng nhập, helper chất lượng giao diện, ma trận 8 kích thước màn hình, ảnh so sánh.
   - **web** — mới có `bigbike-web/e2e/` với 3 kịch bản, chưa có fixture chung. Viết mới thì tự dựng phần chuẩn bị dữ liệu.
3. Luồng đi qua **cả hai** → viết 2 kịch bản riêng (mỗi app một cấu hình khác nhau), nối bằng dữ liệu chung (mã đơn, email khách).

## Bước 1 — Hệ thống phải đang chạy

**Admin** — hai cách, chọn theo mục đích:

| Cách | Khi nào | Lệnh (PowerShell, chạy trong `bigbike-admin/`) |
|---|---|---|
| Tự dựng bản xem thử (mặc định) | Kiểm code trong thư mục làm việc, chưa build container | `npx playwright test <spec>` — tự build rồi phục vụ ở cổng 4280 |
| Trỏ vào container thật | Kiểm đúng cái đang chạy ở `:4000` | `$env:E2E_BASE_URL="http://localhost:4000"; $env:E2E_NO_WEBSERVER="1"; npx playwright test <spec>` |

**Web:** cấu hình riêng, địa chỉ lấy từ `PW_BASE_URL`, mặc định `http://localhost:3001` (bản chạy để phát triển; bản container là `:3000`).

**Không tự bật/tắt/khởi động lại Docker** — hệ thống dùng chung. Container cần dùng chưa chạy → báo 1 dòng, ghi `Not run`, làm tiếp phần khác.

Dùng `localhost`, **không** dùng `127.0.0.1` — máy chủ chỉ chấp nhận `localhost`, dùng IP sẽ kẹt ở màn đăng nhập.

## Bước 2 — Đọc mẫu trước khi viết

| Cần gì | File mẫu (trong `bigbike-admin/e2e/`) |
|---|---|
| Luồng vòng đời đầy đủ (tạo → sửa → ẩn → xoá → khôi phục) | `specs/brand-lifecycle.spec.ts`, `specs/category-lifecycle.spec.ts` |
| Quét nhanh mọi màn hình còn sống | `specs/smoke-routes.spec.ts` |
| Kiểm nhiều kích thước màn hình | `specs/responsive.spec.ts` |
| So ảnh giao diện | `specs/visual.spec.ts` |
| Đăng nhập + bắt lỗi runtime | `fixtures/admin-test.ts` |
| Helper chất lượng giao diện | `utils/quality.ts` |
| Danh sách route + ma trận màn hình | `utils/routes.ts`, `utils/viewports.ts` |

## Bước 3 — Viết kịch bản: dùng đồ có sẵn, đừng dựng lại

```ts
import { test, expect, expectRuntimeClean } from '../fixtures/admin-test'
import { navigateSpa, waitForScreenReady, expectNoHorizontalOverflow } from '../utils/quality'
import { VIEWPORTS } from '../utils/viewports'
```

Những thứ fixture đã lo sẵn — **không tự viết lại**:

- `adminPage` — trang đã đăng nhập sẵn (quyền cao nhất), đứng ở Tổng quan, bộ đếm lỗi đã reset. Không phải gõ form đăng nhập.
- `collect` — tự gom lỗi console, lỗi trang, lỗi API 4xx/5xx, lỗi kết nối đẩy tin. Tiếng ồn vô hại (React DevTools, favicon…) đã lọc sẵn.
- `expectRuntimeClean(collect)` — chốt cứng: không lỗi trang, không lỗi console, không lỗi API. **Mọi kịch bản nên gọi hàm này ở cuối.**
- `testAnon` — bản chưa đăng nhập, dùng khi cần kiểm luồng khách/màn đăng nhập.
- Helper trong `utils/quality.ts`: `gotoAdmin`, `navigateSpa` (chuyển trang trong ứng dụng, không tải lại — tiết kiệm lượt làm mới phiên), `waitForScreenReady`, `expectNoHorizontalOverflow`, `expectHeaderNotOverlappingContent`, `auditScreen`, `openSidebarDrawer`.

Kích thước màn hình lấy hằng số từ `utils/viewports.ts` (`375x812`, `768x1024`, `1440x900`…), **không gõ số thẳng**.

## Bước 4 — Dữ liệu thử: luật cứng, không được phá

- Mọi bản ghi kịch bản tạo ra phải mang tiền tố **`E2E_<MODULE>_`** + mã lần chạy, theo đúng mẫu `E2E_BRAND_`/`E2E_CATEGORY_`.
- Dọn dẹp **chỉ** được đụng bản ghi có tiền tố đó. Lọc bằng ô tìm kiếm trước khi thao tác, không bao giờ xoá theo vị trí dòng.
- **Không sửa/xoá dữ liệu shop thật.** Không đụng đơn hàng thật, khách thật, sản phẩm thật.
- **Không tạo dữ liệu giả trong ứng dụng** để kịch bản chạy được — bộ chặn `check:no-admin-runtime-mock` sẽ báo lỗi. Cần dữ liệu thì tạo qua giao diện hoặc API thật.
- Kịch bản phải chạy lại được nhiều lần: mã lần chạy khác nhau mỗi lần, không giả định "chưa có bản ghi nào".

## Bước 5 — Chạy

```powershell
# một kịch bản
npx playwright test brand-lifecycle.spec.ts

# lọc theo tên phép kiểm
npx playwright test visual.spec.ts -g "danh sách"

# xem danh sách mà không chạy
npx playwright test --list
```

- **Chạy tuần tự một luồng, đừng tăng song song.** Đăng nhập bị giới hạn 5 lần/phút, làm mới phiên 30 lần/phút — chạy song song sẽ bị chặn và kết quả trượt giả.
- Đừng chạy cả bộ liên tục nhiều lần vì lý do trên. Sửa xong thì chạy đúng kịch bản liên quan.
- Trượt thì có sẵn video, dấu vết thao tác và ảnh chụp trong `e2e/.artifacts`; báo cáo dạng trang web ở `e2e/report`.

## Bước 6 — Ảnh so sánh giao diện

Ảnh chuẩn nằm ở `e2e/__screenshots__`, ngưỡng lệch cho phép 2%.

- Ảnh lệch mà **giao diện không cố ý đổi** → đây là lỗi, đi sửa code, **không** cập nhật ảnh chuẩn.
- Ảnh lệch vì **vừa cố ý đổi giao diện** → cập nhật ảnh chuẩn (`--update-snapshots`) và **nói rõ trong báo cáo** là đã cập nhật, kèm lý do.
- Không bao giờ cập nhật ảnh chuẩn chỉ để kịch bản hết đỏ.

## Bước 7 — Báo cáo

```text
Luồng kiểm: <mô tả bằng ngôn ngữ người dùng>
App:        admin | web
Chạy trên:  bản xem thử tự dựng | container :4000

Kết quả:
- <tên kịch bản> — Đậu / Trượt: <nguyên nhân> / Not run: <lý do>

Kích thước đã kiểm: 1440 / 768 / 375
Ảnh so sánh: khớp | đã cập nhật ảnh chuẩn (lý do: …)
Dữ liệu thử: tiền tố E2E_<MODULE>_, đã dọn sạch
```

## Quy tắc tuyệt đối

- ❌ Không tự bật/tắt/khởi động lại Docker.
- ❌ Không đụng dữ liệu shop thật; dọn dẹp chỉ theo tiền tố `E2E_`.
- ❌ Không tăng số luồng chạy song song.
- ❌ Không tạo dữ liệu giả trong ứng dụng để kịch bản chạy được.
- ❌ Không cập nhật ảnh chuẩn để che lỗi.
- ❌ Không ghi một kịch bản là đậu nếu chưa thật sự chạy — ghi `Not run: <lý do>`.
