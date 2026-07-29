---
name: workflow-audit-all
description: "Dùng khi cần audit toàn bộ các luồng nghiệp vụ đầu-cuối của BigBike, không phải một luồng lẻ và không chỉ riêng admin. Dựng danh sách luồng còn sống từ BUSINESS_PROCESS.md, WORKFLOW_OVERVIEW.md và API_FLOW_MAP.md; ưu tiên theo rủi ro tiền bạc; áp dụng feature-audit cho từng luồng qua web, admin và backend; cập nhật docs/audits/WORKFLOW_AUDIT_BOARD.md; và tổng kết phần còn nợ."
---

# workflow-audit-all — Quét audit toàn bộ luồng nghiệp vụ

Skill điều phối. **Không tự audit** — mỗi luồng áp dụng skill `feature-audit`. Việc của skill này: chốt danh sách luồng, xếp ưu tiên, giữ sổ tiến độ, không để luồng nào rơi.

> **Chọn đúng skill:** một luồng lẻ → dùng `feature-audit`. Hết **màn hình quản trị** → dùng `admin-audit-all`. Hết **luồng nghiệp vụ xuyên 3 app** → skill này. Ba cái bù nhau, không thay nhau: `admin-audit-all` soi từng màn hình, skill này soi đường đi của nghiệp vụ **xuyên qua** các màn hình đó.

## ⚠️ Chế độ chạy liên tục — KHÔNG dừng giữa chừng để xin duyệt

Một lần gọi = **chạy hết mọi luồng còn lại trong phiên**, xong luồng này sang thẳng luồng kế.

- **Cần owner quyết → hỏi user bằng 2–4 phương án cụ thể**, nêu phương án đề xuất và mô tả hậu quả vận hành. Dùng công cụ hỏi-chọn nếu môi trường có sẵn; nếu không có, đặt câu hỏi trong chat và chỉ tạm dừng phần phụ thuộc quyết định đó.
- Gom 2–4 câu một lần; mỗi phương án nói **hậu quả vận hành**, không nói thuật ngữ kỹ thuật.
- Vướng kỹ thuật (hệ thống chưa chạy, lỗi đã mang mã `AUD-xxx`) → ghi `Not run: <lý do>` hoặc trích mã AUD rồi chạy tiếp, **không hỏi**.
- **Chỉ dừng hẳn khi:** hết luồng, hoặc user bảo dừng.
- Sổ cập nhật **ngay sau mỗi luồng**, không dồn tới cuối.

## Bước 1 — Dựng lại danh sách luồng (mỗi lần chạy đều dựng lại)

Ba nguồn, đối chiếu cả ba — **luồng nào ghi `REMOVED` thì KHÔNG audit**:

1. `docs/business/BUSINESS_PROCESS.md` → bảng **Current Process Map** (cột Status).
2. `docs/business/WORKFLOW_OVERVIEW.md` → các section luồng.
3. `docs/engineering/API_FLOW_MAP.md` → phần **Flow Highlights** (chi tiết kỹ thuật từng chặng).

Danh sách tại thời điểm viết skill (POS đã gỡ 2026-06-23, không nằm trong đây):

| Luồng | Chạm app | Đợt |
|---|---|---|
| Đặt hàng (giỏ → điền thông tin → tạo đơn → email + báo admin) | web + máy chủ + admin | 1 |
| Giỏ hàng (khách vãng lai và khách đã đăng nhập) | web + máy chủ | 1 |
| Tồn kho & còn/hết hàng khi đặt | máy chủ + admin | 1 |
| Đăng nhập / ghi nhớ đăng nhập / đăng nhập qua mạng xã hội | web + máy chủ | 2 |
| Địa chỉ giao hàng (2 cấp tỉnh–phường) | web + máy chủ | 2 |
| Báo đơn mới về admin theo thời gian thực | máy chủ + admin | 2 |
| Duyệt danh mục & tìm kiếm (khách không đăng nhập) | web + máy chủ | 3 |
| Đăng ảnh/media của admin | admin + máy chủ | 3 |
| Soạn sản phẩm & xem trước bản thật | admin + web | 3 |
| Menu điều hướng đầu trang | admin + web | 4 |

**Bảng này chỉ là điểm khởi đầu — luôn dựng lại từ 3 nguồn trên.** Tài liệu có thể đã thêm/gỡ luồng.

## Bước 2 — Thứ tự ưu tiên

| Đợt | Vì sao trước |
|---|---|
| **1 — Tiền** | Sai là mất đơn, sai giá, bán hàng đã hết |
| **2 — Danh tính & giao nhận** | Sai là khách không vào được tài khoản, giao sai địa chỉ, nhân viên không biết có đơn |
| **3 — Nội dung khách thấy** | Sai là hiển thị sai hàng, mất ảnh |
| **4 — Điều hướng** | Rủi ro thấp nhất |

## Bước 3 — Sổ tiến độ

File: **`docs/audits/WORKFLOW_AUDIT_BOARD.md`** (`docs/` nằm trong git, commit cùng thay đổi code).

```markdown
# Bảng theo dõi audit luồng nghiệp vụ BigBike

Cập nhật lần cuối: <YYYY-MM-DD>

| Luồng | Chạm app | Đợt | Trạng thái | Ai đang làm | Ngày | Kịch bản đầu-cuối | Finding mở | Ghi chú |
|---|---|---|---|---|---|---|---|---|
| Đặt hàng | web+máy chủ+admin | 1 | ⬜ Chưa | — | — | — | — | |
```

Ký hiệu: `⬜ Chưa` · `🟡 Dở` · `✅ Xong` · `⛔ Chặn` (đã hỏi, owner chọn để sau) · `➖ Bỏ` (tài liệu ghi REMOVED).

Cột **Ai đang làm**: ghi tên agent khi bắt đầu, xoá khi xong. Thấy tên agent khác → bỏ qua, lấy luồng kế (AGENTS.md §19).

**Không tin sổ mù quáng** — mỗi lần chạy kiểm lại: có file báo cáo `docs/audits/FEATURE_*` cho luồng đó không, có kịch bản đầu-cuối trong `e2e/specs/` không. Sổ ghi ✅ mà không có gì → hạ xuống `🟡 Dở`.

## Bước 4 — Chạy một luồng

1. Cập nhật sổ: `🟡 Dở` + tên agent + ngày.
2. Áp dụng skill `feature-audit` cho luồng đó và theo đúng quy trình (10 phép đối chiếu xuyên app, đi thử kịch bản thật, ghi finding có mức độ).
3. Luồng thuộc **đợt 1 hoặc 2** → dựng thêm kịch bản kiểm thử đầu-cuối theo skill `e2e`; đợt 3–4 thì tuỳ mức rủi ro tìm thấy.
4. Cập nhật sổ: trạng thái thật, số finding còn mở, có kịch bản đầu-cuối chưa.
5. In tiến độ rồi **sang thẳng luồng kế**.

## Bước 5 — Hai bẫy riêng của việc quét theo luồng

**Bẫy 1 — Tài liệu mâu thuẫn lẫn nhau.** Các file tài liệu được viết ở thời điểm khác nhau, có chỗ đã lệch. Ví dụ đã xác nhận: `BUSINESS_PROCESS.md` ghi "điều chỉnh tồn kho tạo bản ghi biến động kho", nhưng `MODULE_CATALOG.md` ghi phần biến động kho đã **ngủ đông** từ V261 (tồn kho giờ chỉ là công tắc Còn/Hết, không ghi biến động). Gặp kiểu này → **ghi thành finding về tài liệu**, hỏi owner chốt bản nào đúng, sửa tài liệu sai. Đừng chọn bừa một bên rồi đi tiếp.

**Bẫy 2 — Luồng chồng lên nhau.** "Đặt hàng" và "Tồn kho" cùng đi qua bước kiểm còn hàng; "Đăng nhập" và "Giỏ hàng" cùng đụng việc gộp giỏ khi khách đăng nhập. Khi audit luồng sau mà gặp lại chỗ đã soi ở luồng trước → **trích lại finding cũ, không đẻ mã mới**, và ghi rõ hai luồng cùng dính.

## Bước 6 — Việc xuyên luồng thì không tự làm

Lỗi nằm ở chỗ dùng chung (cách tính tiền, tên trạng thái đơn, cơ chế phân quyền, lớp gọi dữ liệu) sẽ ảnh hưởng nhiều luồng cùng lúc. Ghi vào mục "Việc xuyên luồng" cuối sổ kèm danh sách luồng bị ảnh hưởng, **chạy tiếp luồng kế**. Đủ lớn để đổi hướng cả đợt quét → hỏi bằng bảng chọn rồi đi tiếp.

## Bước 7 — Báo cáo tổng

```text
Tiến độ audit luồng nghiệp vụ — <ngày>

Đã xong:    X/Y luồng
Đang dở:    <danh sách + nợ gì>
Chưa đụng:  <danh sách theo đợt>
Owner hoãn: <luồng + món đã hỏi nhưng chọn để sau>

Finding còn mở: <n> (Blocker a / High b / Medium c / Low d)
Phủ kiểm thử đầu-cuối: <n>/Y luồng

Việc xuyên luồng còn treo:
- <mô tả> — ảnh hưởng: <luồng A, B>

Mâu thuẫn tài liệu phát hiện được:
- <file A> nói X, <file B> nói Y — đã hỏi owner: <kết quả>

Đề xuất luồng kế tiếp: <tên> (đợt <n>, lý do)
```

## Quy tắc tuyệt đối

- ❌ Không audit luồng tài liệu ghi `REMOVED` (POS, bảo hành, vận chuyển, công nợ, trả hàng…).
- ❌ Không đánh `✅ Xong` khi chưa có báo cáo finding cho luồng đó.
- ❌ Không xử lý nhiều luồng song song — nhưng cũng không dừng xin phép giữa các luồng.
- ❌ Không tự quyết khi 2 đầu lệch nhau hoặc 2 tài liệu mâu thuẫn — hỏi bằng bảng chọn rồi chạy tiếp.
- ❌ Không tự sửa lỗi đã mang mã `AUD-xxx` trong `docs/audits/`.
- ❌ Không tự bật/tắt/khởi động lại Docker; trong container mặc định chỉ đọc.
- ❌ Không tự commit/push nếu user không yêu cầu; khi commit thì `docs/` đi cùng thay đổi code.
