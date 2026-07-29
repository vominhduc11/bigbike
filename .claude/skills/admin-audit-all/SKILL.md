---
name: admin-audit-all
description: "Dùng khi cần audit toàn bộ các module của bigbike-admin, không phải một module lẻ: dựng lại danh sách module từ App.jsx, MODULE_CATALOG.md và src/screens; ưu tiên theo rủi ro kinh doanh; áp dụng quy trình admin-module-audit cho từng module; cập nhật docs/audits/ADMIN_AUDIT_BOARD.md sau mỗi module; và tổng kết phần còn nợ."
---

# admin-audit-all — Quét audit toàn bộ admin

Skill điều phối. **Không tự audit** — mỗi module áp dụng skill `admin-module-audit` cho module đó. Việc của skill này: chốt danh sách module, xếp ưu tiên, giữ sổ tiến độ, và không để module nào rơi.

## ⚠️ Chế độ chạy liên tục — KHÔNG dừng giữa chừng để xin duyệt

Một lần gọi = **chạy hết mọi module còn lại trong phiên**, làm xong module này sang thẳng module kế, **không hỏi user để được phép đi tiếp**. User đã ra lệnh chạy — hỏi lại "có làm tiếp không?" là làm sai ý.

- **Xử lý từng module một, tuần tự** (không mở 2 module cùng lúc — audit vội = báo cáo đẹp, code không đổi), nhưng **không nghỉ giữa các module**.
- Sau mỗi module: in tiến độ + cập nhật sổ, rồi **đi ngay** module kế. Dòng tiến độ là để báo cáo, không phải để chờ trả lời.
- **Gặp vướng cần owner quyết → hỏi user bằng 2–4 phương án cụ thể**. Dùng công cụ hỏi-chọn nếu môi trường có sẵn; nếu không có, đặt câu hỏi ngắn gọn trong chat và chỉ tạm dừng phần phụ thuộc quyết định đó.
  - Gom 2–4 câu một lần thay vì hỏi lắt nhắt; hỏi ngay nếu phần còn lại phụ thuộc vào câu đó.
  - Mỗi câu 2–4 phương án cụ thể, phương án đề xuất để đầu ghi "(Đề xuất)", mô tả bằng **hậu quả vận hành** (đơn hàng, khách, nhân viên) chứ không bằng thuật ngữ kỹ thuật.
  - Trả lời xong: áp dụng ngay, cập nhật docs nếu là rule, ghi vào sổ, **đi tiếp** — không hỏi lại "có tiếp không?".
  - Owner chọn "để sau" → đánh `⛔ Chặn` cho đúng món đó và chạy tiếp module.
- Vướng **kỹ thuật** không cần owner quyết (container chưa chạy, thiếu dữ liệu mẫu, lỗi đã mang mã `AUD-xxx`) → ghi `Not run: <lý do>` hoặc trích mã AUD, **không hỏi**, chạy tiếp.
- **Chỉ dừng hẳn khi:** hết module, hoặc user bảo dừng.
- Cuối phiên trình **một lần duy nhất** toàn bộ những gì còn treo (Bước 7).
- Sổ tiến độ phải cập nhật **ngay sau mỗi module**, không dồn tới cuối — để phiên bị ngắt giữa chừng vẫn chạy tiếp đúng chỗ.

## Cách gọi

| Lệnh | Hành động |
|---|---|
| `/admin-audit-all` | Chạy liên tục **mọi** module còn `⬜ Chưa`/`🟡 Dở` theo thứ tự ưu tiên, tới hết |
| `/admin-audit-all tiếp tục` | Như trên (giữ cho quen tay) |
| `/admin-audit-all tên module` | Chỉ chạy đúng module đó rồi dừng |
| `/admin-audit-all tổng kết` | Chỉ đọc sổ + in báo cáo tổng, không sửa gì |

## Bước 1 — Dựng lại danh sách module (mỗi lần chạy đều dựng lại, đừng tin sổ cũ)

Ba nguồn, đối chiếu cả ba:

1. **`bigbike-admin/src/App.jsx`** — mảng `NAV`: đây là danh sách route + **permission key thật**. Module không có trong `NAV` thì hoặc là màn phụ (Login, Nhận lời mời) hoặc là tab nằm trong màn khác (Banner nằm trong Cài đặt).
2. **`docs/business/MODULE_CATALOG.md`** — cột `Status`. **Module ghi `REMOVED` thì KHÔNG audit** (POS, Bảo hành, Vận chuyển, Công nợ, Trang tĩnh CMS, Kho hàng độc lập… đã gỡ). Đừng "khôi phục" chúng.
3. **`bigbike-admin/src/screens/`** — có đủ cặp List+Detail hay chỉ một màn.

Nếu `NAV` có route mà `MODULE_CATALOG.md` không nhắc, hoặc ngược lại → **ghi vào sổ như một finding**, không tự quyết.

## Bước 2 — Thứ tự ưu tiên (theo rủi ro kinh doanh, không theo bảng chữ cái)

| Đợt | Module | Permission | Lý do ưu tiên |
|---|---|---|---|
| **1 — Tiền & khách** | Đơn hàng, Sản phẩm, Khách hàng, Đánh giá | `orders.read`, `products.read`, `customers.read`, `reviews.read` | Sai là mất tiền, sai đơn, lộ dữ liệu khách |
| **2 — Danh mục** | Danh mục, Thương hiệu, Sản phẩm nổi bật | `catalog.read`, `products.update` | Sai là hàng hiển thị sai chỗ trên web |
| **3 — Nội dung web** | Tin tức, Slider, Video trang chủ, Nổi bật trang chủ, Menu, Thư viện ảnh, Chuyển hướng | `content.read`, `sliders.read`, `home_videos.read`, `home_highlights.read`, `menus.read`, `media.read`, `redirects.read` | Sai là web hiện sai nội dung / hỏng link |
| **4 — Hệ thống** | Cài đặt (gồm tab Banner trang), Người dùng quản trị, Vai trò, Nhật ký hoạt động | `settings.read`, `admin-users.read`, `roles.read`, `audit-logs.read` | Sai là hở quyền |
| **5 — Xem số** | Tổng quan, Báo cáo | `orders.read`, `reports.read` | Chỉ đọc, rủi ro thấp nhất |

Trong cùng một đợt thì làm module chưa từng đụng trước, module đã sửa dở sau.

## Bước 3 — Sổ tiến độ

File: **`docs/audits/ADMIN_AUDIT_BOARD.md`** (`docs/` nằm trong git — sổ này commit cùng thay đổi code).

Chưa có thì tạo. Format bắt buộc:

```markdown
# Bảng theo dõi audit bigbike-admin

Cập nhật lần cuối: <YYYY-MM-DD>

| Module | Màn hình | Đợt | Trạng thái | Ai đang làm | Ngày | Vitest | E2E | Ghi chú / nợ lại |
|---|---|---|---|---|---|---|---|---|
| Đơn hàng | OrderList + OrderDetail | 1 | ⬜ Chưa | — | — | — | — | |
| Thương hiệu | BrandList + BrandDetail | 2 | ✅ Xong | claude | 2026-07-20 | ✅ | ✅ | |
```

Cột **Ai đang làm**: ghi tên agent khi bắt đầu (`claude`, `codex`…), xóa khi xong. Thấy module đã có tên agent **khác** → **bỏ qua, lấy module kế** (xem AGENTS.md §19 về chạy nhiều agent song song).

Ký hiệu trạng thái: `⬜ Chưa` · `🟡 Dở` (đã sửa nhưng còn nợ, ghi rõ nợ gì) · `✅ Xong` (đạt đủ Definition of Done của skill `admin-module-audit`) · `⛔ Chặn` (đã hỏi, owner chọn để sau) · `➖ Bỏ` (MODULE_CATALOG ghi REMOVED).

**Đừng tin sổ mù quáng — mỗi lần chạy phải kiểm chứng lại bằng code:**
- Có `src/screens/<Module>*.test.jsx` không → cột Vitest.
- Có `e2e/specs/<module>-*.spec.ts` không → cột E2E.
- Sổ ghi ✅ mà không có file test → sửa lại thành `🟡 Dở`, ghi nợ "thiếu test". Đã xảy ra thật với Danh mục.

## Bước 4 — Chạy một module

1. Cập nhật sổ: module → `🟡 Dở`, ghi ngày bắt đầu.
2. Áp dụng skill `admin-module-audit` cho module đó và **theo đúng quy trình** (P0→P3, Definition of Done, `hygiene`, `preflight`).
3. Xong thì cập nhật sổ: trạng thái thật (`✅` chỉ khi tick đủ Definition of Done), cột Vitest/E2E, và **ghi rõ nợ lại** nếu có.
4. In báo cáo module cho user, kèm 1 dòng: "Còn lại: X module (đợt 1: a, đợt 2: b…)".
5. **Sang thẳng module kế tiếp** — không hỏi, không chờ. Chỉ dừng khi hết module hoặc user bảo dừng.

## Bước 5 — Màn hình không phải cặp List+Detail

Skill `admin-module-audit` mặc định giả định có cặp List + Detail. Với màn đơn (Tổng quan, Báo cáo, Cài đặt, Thư viện ảnh, Menu, Vai trò, Người dùng quản trị, Nhật ký hoạt động, Slider, Video trang chủ, Nổi bật trang chủ, Sản phẩm nổi bật, Chuyển hướng), áp dụng bản rút gọn:

- **Bỏ** Bước 5 (Detail screen) nếu không có màn chi tiết.
- **Giữ nguyên** Bước 0–3 (docs, lifecycle, song ngữ, đối chiếu backend), Bước 4 (list/bảng/lọc/state/quyền), Bước 6 (i18n), Bước 7 (test), Bước 9–10 (ảnh, gate).
- Màn **chỉ đọc** (Tổng quan, Báo cáo, Nhật ký hoạt động): trọng tâm là **đúng số** — công thức tổng, khoảng thời gian, múi giờ, làm tròn, định dạng tiền VND, trạng thái rỗng/lỗi/đang tải, và quyền xuất file nếu có (`reports.export`).
- Màn **cấu hình** (Cài đặt, Vai trò, Người dùng quản trị): trọng tâm là **không hở quyền** — ai sửa được gì, có chặn tự nâng quyền không, có xác nhận trước thao tác nguy hiểm không.

## Bước 6 — Việc xuyên module thì KHÔNG tự làm

Trong lúc quét sẽ gặp lỗi nằm ở component dùng chung (`AdminTable`, `FilterBar`, `SectionCard`, `adminApi.js`, `admin-tokens.css`…) hoặc ở nhiều module cùng lúc. Khi đó:

- **Không sửa lan** trong lượt audit module đang chạy — sửa component dùng chung sẽ ảnh hưởng module chưa audit và làm hỏng phạm vi.
- Ghi vào mục "Việc xuyên module" cuối sổ, kèm module nào bị ảnh hưởng.
- **Chạy tiếp module kế ngay**, không dừng chờ. Nếu việc đó đủ lớn để đổi hướng cả đợt quét thì hỏi bằng bảng chọn phương án rồi đi tiếp; còn lại gom vào báo cáo cuối phiên.

Tương tự: lỗi đã có trong `docs/audits/` (mã `AUD-xxx`) thì **không tự sửa**, chỉ đối chiếu và ghi "đã có mã AUD-xxx".

## Bước 7 — Báo cáo tổng (khi gọi `tổng kết`, hoặc khi quét xong hết)

```text
Tiến độ audit admin — <ngày>

Đã xong:   X/Y module
Đang dở:   <danh sách + nợ gì>
Chưa đụng: <danh sách theo đợt>
Owner hoãn: <module + món đã hỏi nhưng chọn để sau>

Phủ test:  Vitest a/Y module · E2E b/Y module

Việc xuyên module còn treo:
- <mô tả> — ảnh hưởng: <module A, B>

Đề xuất module kế tiếp: <tên> (đợt <n>, lý do)
```

## Quy tắc tuyệt đối

- ❌ Không audit module `MODULE_CATALOG.md` ghi `REMOVED`.
- ❌ Không đánh `✅ Xong` khi chưa đủ Definition of Done — thiếu test thì là `🟡 Dở`.
- ❌ Không xử lý nhiều module song song cùng lúc (tuần tự từng cái) — nhưng cũng ❌ không dừng lại xin phép giữa các module.
- ❌ Không hỏi "có chạy tiếp không?". User gọi skill này nghĩa là đã đồng ý chạy hết.
- ❌ Không sửa component dùng chung giữa lượt audit một module.
- ❌ Không tự commit/push nếu user không yêu cầu; khi commit thì `docs/` (kể cả sổ tiến độ) đi **cùng** thay đổi code, không tách rời.
