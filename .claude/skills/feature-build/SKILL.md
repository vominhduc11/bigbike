---
name: feature-build
description: "Dùng khi cần làm mới hoặc mở rộng một tính năng kinh doanh đi hết chặng qua nhiều lớp của BigBike: tài liệu chuẩn, backend, quyền, màn quản trị, trang khách hàng, song ngữ, kiểm thử từng lớp và đầu-cuối. Điều phối các skill backend-endpoint, admin-screen, web-page, e2e, hygiene và preflight. Khác feature-audit vì đây là xây hoặc mở rộng tính năng."
---

# feature-build — Làm một tính năng từ đầu tới cuối

Skill **điều phối**: nó không thay các quy trình lẻ, mà xếp chúng đúng thứ tự và không cho bỏ sót lớp nào.

> **Chọn đúng skill:** tính năng **đã có** mà nghi sai/lệch → dùng `feature-audit`. Chỉ dựng **một** màn hình / trang / endpoint đơn lẻ → dùng thẳng `admin-screen`, `web-page`, `backend-endpoint`. Tính năng chạm **nhiều lớp** → dùng skill này.

## ⚠️ Chế độ chạy liên tục

Một lần gọi = **làm tới xong trong phiên**. Không hỏi "có làm tiếp không?", không dừng giữa các lớp để chờ duyệt.

- Gặp điểm **cần owner quyết** (rule kinh doanh chưa có, ảnh hưởng tiền/trạng thái đơn, docs ghi `NEEDS_VERIFICATION`/`CONFLICTING_EVIDENCE`) → hỏi user bằng 2–4 phương án cụ thể, nêu phương án đề xuất, rồi làm tiếp sau khi có trả lời.
- Gom 2–4 câu hỏi một lần; mỗi phương án mô tả bằng **hậu quả vận hành** chứ không bằng thuật ngữ kỹ thuật.
- Vướng kỹ thuật (hệ thống chưa chạy, thiếu dữ liệu) → ghi `Not run: <lý do>` rồi làm tiếp.
- Sau mỗi lớp in 1 dòng tiến độ rồi **sang lớp kế ngay**.

## ⚠️ Thứ tự bắt buộc — không làm ngược

```
Tài liệu → Máy chủ → (Admin ∥ Web) → Kiểm thử → Cổng kiểm tra
```

Lý do: giao diện phụ thuộc hợp đồng dữ liệu. Làm màn hình trước rồi mới nghĩ ra API sẽ phải làm lại. **Không bao giờ** viết giao diện dựa trên dữ liệu tưởng tượng rồi "chờ backend theo sau".

Tính năng chỉ chạm 1 lớp (ví dụ đổi cách hiển thị trên web, không đổi dữ liệu) → **bỏ qua các lớp không liên quan và nói rõ trong báo cáo** là đã bỏ vì sao.

## Bước 0 — Chốt phạm vi bằng ngôn ngữ kinh doanh

Viết ra 3 dòng, đọc lại cho user trước khi đụng file:

1. **Ai dùng, để làm gì** — "nhân viên đánh dấu đơn ưu tiên để xử lý trước".
2. **Khách hàng có thấy không** — có thì trang web cũng phải sửa; không thì bỏ lớp web.
3. **Chạm gì** — dữ liệu mới? trạng thái mới? quyền mới? tiền bạc? Chạm bất kỳ cái nào → tài liệu chuẩn phải sửa trước.

Nếu phạm vi mơ hồ tới mức làm sai hướng là hỏng cả phiên → hỏi bằng bảng chọn phương án ngay tại đây, rồi chạy tiếp.

## Bước 1 — Tài liệu chuẩn trước (bắt buộc nếu chạm rule/dữ liệu/quyền/trạng thái)

Tra bảng "sửa cái này thì đọc docs nào" trong `CLAUDE.md` (đầy đủ ở `AGENTS.md` §3–§4), đọc **đúng section**, rồi cập nhật:

| Chạm gì | Sửa tài liệu nào |
|---|---|
| Quy tắc kinh doanh mới | `docs/business/BUSINESS_RULES.md` — cấp mã rule mới đúng tiền tố module |
| Trạng thái / chuyển trạng thái | `docs/business/STATE_MACHINES.md` |
| Trường dữ liệu, bảng, kiểu | `docs/engineering/DATA_CONTRACT.md` |
| API mới hoặc đổi shape | `docs/engineering/API_CONTRACT.md` + `bigbike-openapi.json` |
| Quyền / vai trò | `docs/engineering/PERMISSION_MATRIX.md` + `docs/business/USER_ROLES.md` |
| Tính năng mới hẳn | `docs/business/MODULE_CATALOG.md` — thêm dòng, ghi Surface + Status |

**Không bịa rule.** Docs im lặng về điều cần biết → hỏi bằng bảng chọn, ghi câu trả lời thành rule có mã, rồi làm tiếp.

## Bước 2 — Máy chủ (theo skill `backend-endpoint`)

- Bảng dữ liệu: migration Flyway `V<số>__*.sql`, số kế tiếp liền mạch. **Chỉ thêm, tránh xoá** — dữ liệu cũ phải đọc được.
- API: controller bọc qua `ApiResponseFactory`, DTO có `@Valid`, mapper MapStruct, quyền qua `requirePermission` (không dùng `@PreAuthorize`).
- Kiểm thử máy chủ cho: luồng thành công, thiếu tham số, sai quyền (403), không tìm thấy (404), xung đột (409).
- Cập nhật `bigbike-openapi.json` cho khớp — file này hay lệch code thật, đừng tin nó, sửa nó.

## Bước 3 — Màn quản trị (theo skill `admin-screen`, hoặc `admin-module-audit` nếu sửa module đã có)

- Wire đủ **5 điểm** trong `App.jsx` — thiếu 1 điểm là màn không chạy hoặc báo không đủ quyền.
- Quyền đúng khoá đã ghi ở Bước 1; chỉ có quyền đọc → `ReadOnlyBanner` + khoá thao tác ghi.
- **Song ngữ giao diện: thêm khoá vào CẢ HAI** `src/locales/vi.json` và `en.json`. Không viết chữ thẳng vào màn hình.
- Đủ trạng thái: đang tải, trống, lỗi, đang lưu, lưu xong, lưu hỏng, không đủ quyền.

## Bước 4 — Trang khách hàng (theo skill `web-page`)

- Chỉ làm nếu Bước 0 xác định khách có thấy.
- SEO: tiêu đề + mô tả + đường dẫn chuẩn qua `buildPublicMetadata`; trang lọc/phân trang đặt `noIndex`.
- Song ngữ dữ liệu: nội dung tiếng Anh lấy từ đâu, thiếu thì rơi về tiếng Việt như thế nào — phải quyết rõ, không để trang tiếng Anh trả về tiếng Việt mà không ai biết.
- Ảnh do admin quản lý phải nằm trong kho ảnh nội bộ MinIO, không trỏ link ngoài.

## Bước 5 — Kiểm thử

| Lớp | Làm gì |
|---|---|
| Máy chủ | Đã làm ở Bước 2 |
| Admin | Vitest cho màn mới, bám mẫu `src/screens/BrandListScreen.test.jsx` |
| Web | Vitest nếu có logic; trang thuần hiển thị thì bỏ qua, ghi rõ |
| Đầu-cuối | Dùng skill `e2e` cho **luồng chính** của tính năng — dữ liệu thử có tiền tố `E2E_`, không đụng dữ liệu shop |

Tính năng chạm tiền, trạng thái đơn, hoặc quyền → **bắt buộc** có kiểm thử đầu-cuối, không được bỏ.

## Bước 6 — Đóng cổng

1. Dùng skill `hygiene` — CSS chết, chữ vỡ mã hoặc mất dấu, dữ liệu kinh doanh viết cứng.
2. Dùng skill `preflight` — chạy đúng bộ kiểm tra của từng app đã đổi, xuất tóm tắt PR.

## Definition of Done

- [ ] Tài liệu chuẩn đã cập nhật **trước** code, có mã rule để trích dẫn
- [ ] Máy chủ: migration + API + quyền + kiểm thử
- [ ] Admin: 5 điểm wire đủ, quyền đúng, song ngữ 2 file, đủ trạng thái
- [ ] Web (nếu có): SEO + song ngữ + ảnh đúng nơi lưu
- [ ] Kiểm thử từng lớp + đầu-cuối cho luồng chính
- [ ] `hygiene` + `preflight` đậu, hoặc ghi `Not run: <lý do>`
- [ ] **Ba app nói cùng một chuyện** — cùng tên trạng thái, cùng con số, cùng quy tắc. Lệch nhau nghĩa là **chưa xong**.

## Báo cáo cuối

- Tính năng đã làm, mô tả bằng ngôn ngữ kinh doanh.
- Tài liệu đã sửa + mã rule mới cấp.
- File đã đổi, chia theo lớp.
- Lớp nào bỏ qua và vì sao.
- Kết quả từng bộ kiểm tra (`Not run: <lý do>` nếu không chạy được, không bịa đậu).
- Ảnh màn hình 1440 / 768 / 375 (qua skill `run-bigbike-admin` cho admin).
- Việc còn nợ + điều owner đã chốt trong phiên.
