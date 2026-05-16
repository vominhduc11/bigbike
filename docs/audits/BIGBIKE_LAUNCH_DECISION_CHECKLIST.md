# BigBike — Launch Decision Checklist

> **Cập nhật:** 2026-05-16 — sau Final Review `BIGBIKE_FULL_E2E_WORKFLOW_AUDIT.md §14`
> **Đọc bởi:** Chủ shop / PM / Kế toán — không yêu cầu kiến thức lập trình.
> **Mục đích:** Tổng hợp các quyết định còn cần chốt, phân loại theo mức độ ưu tiên trước/sau launch.

---

## Trạng thái launch tổng thể

| Bề mặt | Trạng thái | Ghi chú |
|---|---|---|
| **Website bán hàng (bigbike-web)** | 🟢 **Sẵn sàng** | Toàn bộ luồng mua hàng, tài khoản, bảo hành, blog đã test. |
| **Trang quản trị (bigbike-admin)** | 🟢 **Sẵn sàng** | Đơn hàng, POS, kho, serial, nhân viên, nội dung đã test. |
| **Backend / API** | 🟢 **Sẵn sàng** | Không còn bug chặn. Tiền, kho, phân quyền, hoàn tiền đều an toàn. |
| **App mobile** | 🟡 **Launch được, còn thiếu 2 tính năng** | Xác nhận email đã có. Thiếu wishlist UI và mục home-videos. |

**Kết luận: Không có mục kỹ thuật nào chặn launch.** Các mục dưới đây là quyết định nghiệp vụ và pháp lý mà chủ shop / PM cần chốt.

---

## A. Phải quyết định trước launch (pháp lý — cần xác nhận của chủ shop / kế toán)

### A-1. Hoá đơn điện tử (VAT invoice)

| Mục | Nội dung |
|---|---|
| **Quyết định cần có** | Hệ thống có cần xuất hoá đơn điện tử theo Nghị định 123/2020 không? |
| **Hệ thống hiện tại** | Chưa tích hợp nhà cung cấp hoá đơn điện tử. Admin có thể xuất CSV đơn hàng để xử lý thủ công bên ngoài. |
| **Ảnh hưởng nghiệp vụ** | Nếu bán hàng cho khách có nhu cầu xuất VAT (doanh nghiệp), thiếu tính năng này có thể vi phạm NĐ 123/2020 và gây khiếu nại khách hàng. |
| **Phương án đề xuất** | (a) Tích hợp nhà cung cấp (InvoiceHub, MISA, VNPT-Invoice…) — cần sprint riêng. (b) Chốt với kế toán là phase sau launch. (c) Launch dưới danh nghĩa "bán lẻ cá nhân" chưa bắt buộc hoá đơn VAT — cần xác nhận pháp lý. |
| **Owner** | Chủ shop / Kế toán |
| **Deadline** | Trước ngày go-live nếu chọn (a) hoặc có khách hàng doanh nghiệp. |
| **Chặn launch?** | **Tuỳ quyết định pháp lý của shop.** Kỹ thuật không chặn. |

---

### A-2. Bảo vệ dữ liệu cá nhân khách hàng (Nghị định 13/2023)

| Mục | Nội dung |
|---|---|
| **Quyết định cần có** | Có cần cung cấp cho khách tính năng tải về hoặc xoá dữ liệu cá nhân của họ không? |
| **Hệ thống hiện tại** | Không có endpoint xuất/xoá dữ liệu cá nhân. Khách có thể xoá địa chỉ và cập nhật hồ sơ. Admin có thể xoá tài khoản thủ công qua DB. |
| **Ảnh hưởng nghiệp vụ** | NĐ 13/2023 yêu cầu có cơ chế để chủ thể dữ liệu yêu cầu xoá/chỉnh sửa thông tin. Thiếu cơ chế tự động có thể xử lý thủ công, nhưng cần quy trình rõ ràng. |
| **Phương án đề xuất** | (a) Xây endpoint xuất/xoá dữ liệu — cần sprint riêng. (b) Làm thủ công + ghi quy trình nội bộ (đủ cho giai đoạn đầu với quy mô nhỏ). Cần luật sư hoặc tư vấn pháp lý xác nhận. |
| **Owner** | Chủ shop / Tư vấn pháp lý |
| **Deadline** | Trước go-live nếu có cơ sở khách hàng đáng kể; có thể dùng quy trình thủ công ban đầu. |
| **Chặn launch?** | **Tuỳ quyết định pháp lý của shop.** Kỹ thuật không chặn. |

---

## B. Nên quyết định trước launch (ảnh hưởng vận hành, không chặn kỹ thuật)

### B-1. Gửi thông báo khi review được duyệt (FULL-04)

| Mục | Nội dung |
|---|---|
| **Quyết định cần có** | Khi admin duyệt review của khách, có gửi email thông báo cho khách không? |
| **Hệ thống hiện tại** | Không gửi — admin duyệt, trang sản phẩm tự cập nhật, khách không nhận thông báo. |
| **Ảnh hưởng nghiệp vụ** | Khách không biết review đã được đăng. Ảnh hưởng nhẹ đến trải nghiệm và khả năng khách quay lại. |
| **Phương án đề xuất** | **(b) Không gửi** — đơn giản, đủ cho shop nhỏ. Nếu muốn tăng engagement, chọn (a) bổ sung email sau launch. |
| **Owner** | Chủ shop / Marketing |
| **Deadline** | Có thể chốt sau launch. |
| **Chặn launch?** | ❌ Không |

---

### B-2. Workflow nhập kho theo phiếu (FULL-13)

| Mục | Nội dung |
|---|---|
| **Quyết định cần có** | Có cần màn hình "Phiếu nhập kho" chính thức không, hay chỉ dùng điều chỉnh kho thủ công? |
| **Hệ thống hiện tại** | Có thể điều chỉnh số lượng tồn kho thủ công qua màn "Quản lý kho" (nhập nhiều, xuất ít, ghi chú lý do). Chưa có màn "Phiếu nhập" theo nhà cung cấp/PO. |
| **Ảnh hưởng nghiệp vụ** | Không có phiếu nhập: không đối chiếu được với nhà cung cấp theo từng lô hàng, không biết nhập từ ai, giá nhập bao nhiêu. Phù hợp cho shop nhỏ nhập kho không thường xuyên. |
| **Phương án đề xuất** | **(b) Dùng điều chỉnh thủ công** cho đến khi volume lớn cần phiếu nhập chính thức. DB đã có cấu trúc sẵn — implement khi cần. |
| **Owner** | Chủ shop / Thủ kho |
| **Deadline** | Không urgent — có thể dùng manual adjustment cho đến phase 2. |
| **Chặn launch?** | ❌ Không |

---

### B-3. Đơn vị vận chuyển (GHN / GHTK / ViettelPost)

| Mục | Nội dung |
|---|---|
| **Quyết định cần có** | Có tích hợp tự động với đơn vị vận chuyển (in vận đơn, theo dõi trạng thái giao hàng) không? |
| **Hệ thống hiện tại** | Admin cập nhật trạng thái giao hàng thủ công (PROCESSING → SHIPPED → DELIVERED). Không tự in vận đơn, không tự đồng bộ tracking code. |
| **Ảnh hưởng nghiệp vụ** | Tốn nhân lực cập nhật thủ công khi đơn hàng nhiều. Khách không tự tra cứu tracking được qua hệ thống. |
| **Phương án đề xuất** | Tích hợp GHN hoặc GHTK sau khi volume đơn đủ lớn (~50+ đơn/ngày). Hiện tại cập nhật thủ công là đủ. |
| **Owner** | Chủ shop / Vận hành |
| **Deadline** | Không urgent — có thể defer sau launch. |
| **Chặn launch?** | ❌ Không |

---

## C. Có thể defer sau launch (tính năng, không vận hành)

### C-1. Wishlist trên app mobile (FULL-05)

| Mục | Nội dung |
|---|---|
| **Quyết định cần có** | App mobile có cần tính năng "Yêu thích" không? |
| **Hệ thống hiện tại** | Website có đầy đủ tính năng yêu thích. App mobile chưa có — khách dùng app không lưu được sản phẩm yêu thích. |
| **Ảnh hưởng nghiệp vụ** | Feature parity gap giữa web và mobile. Không ảnh hưởng mua hàng. |
| **Phương án đề xuất** | Bổ sung vào sprint tiếp theo sau khi launch mobile. Backend API đã sẵn sàng. |
| **Owner** | PM / Mobile dev |
| **Deadline** | Sprint 1–2 sau launch. |
| **Chặn launch?** | ❌ Không |

---

### C-2. Deep link verify email cho app mobile (FULL-02 follow-up)

| Mục | Nội dung |
|---|---|
| **Quyết định cần có** | Link xác nhận email trong hộp thư có nên mở thẳng app mobile không? |
| **Hệ thống hiện tại** | Link trong email mở website để xác nhận. Khách đăng ký qua app có thể bấm "Gửi lại" trong app rồi xác nhận qua web, hoặc app tự nhận token nếu có deep link. |
| **Ảnh hưởng nghiệp vụ** | UX kém đồng nhất trên mobile — phải mở web. Nhưng xác nhận email vẫn hoạt động đúng, không chặn tài khoản. |
| **Phương án đề xuất** | Cấu hình iOS Universal Links / Android App Links trong sprint sau. Màn xác nhận đã sẵn sàng nhận token. |
| **Owner** | Mobile dev / DevOps |
| **Deadline** | Sprint 2–3 sau launch mobile. |
| **Chặn launch?** | ❌ Không |

---

### C-3. Home-videos trên app mobile

| Mục | Nội dung |
|---|---|
| **Quyết định cần có** | App mobile có hiển thị mục video trang chủ không? |
| **Hệ thống hiện tại** | Backend có API `GET /api/v1/home-videos`. Website hiển thị video trang chủ. App mobile chưa tích hợp endpoint này. |
| **Ảnh hưởng nghiệp vụ** | Trang chủ app không có phần video — ảnh hưởng nhẹ đến trải nghiệm thương hiệu. |
| **Phương án đề xuất** | Bổ sung trong sprint tiếp theo sau launch — thêm API client và widget hiển thị. |
| **Owner** | Mobile dev |
| **Deadline** | Sprint 1–2 sau launch. |
| **Chặn launch?** | ❌ Không |

---

## D. Quyết định nội bộ kỹ thuật (PM/dev cần chốt, không cần chủ shop)

### D-1. Thông báo đơn hàng mới cho admin (FULL-16)

| Mục | Nội dung |
|---|---|
| **Quyết định cần có** | Có chấp nhận hành vi "best-effort" cho thông báo đơn mới không? |
| **Hệ thống hiện tại** | Khi có đơn mới, hệ thống push thông báo realtime cho admin. Nếu lỗi DB khi lưu thông báo (rất hiếm), thông báo vẫn hiện trên màn hình nhưng không lưu vào bảng — mất sau khi tải lại trang. |
| **Ảnh hưởng nghiệp vụ** | Rủi ro thấp — chỉ xảy ra khi DB bị lỗi đồng thời. Admin vẫn thấy đơn hàng trong danh sách. |
| **Phương án đề xuất** | **(a) Chấp nhận best-effort** cho v1 — ghi rõ hành vi trong tài liệu vận hành. (b) Bổ sung alert log sau launch để monitor. |
| **Owner** | Dev / Vận hành |
| **Deadline** | Không urgent. |
| **Chặn launch?** | ❌ Không |

---

### D-2. Quyền xem Dashboard (FULL-14)

| Mục | Nội dung |
|---|---|
| **Quyết định cần có** | Nhân viên cần quyền `orders.read` để xem Dashboard — có cần tách quyền `dashboard.read` riêng không? |
| **Hệ thống hiện tại** | Màn Dashboard gác bởi quyền `orders.read`. Bất kỳ nhân viên nào có quyền xem đơn hàng đều xem được Dashboard. |
| **Ảnh hưởng nghiệp vụ** | Không thể cho nhân viên xem Dashboard mà không cho xem danh sách đơn hàng. Phù hợp với hầu hết shop nhỏ. |
| **Phương án đề xuất** | Giữ nguyên cho v1. Tách quyền nếu sau này có nhu cầu phân quyền tinh hơn. |
| **Owner** | PM / Dev |
| **Deadline** | Không urgent. |
| **Chặn launch?** | ❌ Không |

---

### D-3. Xoá vĩnh viễn file media — quyền riêng hay wildcard (FULL-11 follow-up)

| Mục | Nội dung |
|---|---|
| **Quyết định cần có** | Có cần tạo quyền `media.hard_delete` riêng thay vì dùng quyền "mọi thứ" (wildcard `*`) không? |
| **Hệ thống hiện tại** | Xoá vĩnh viễn file (ảnh, video) chỉ Super Admin làm được — không thể giao cho role khác. Xoá tạm thời (có thể khôi phục) vẫn hoạt động bình thường với quyền `media.write`. |
| **Ảnh hưởng nghiệp vụ** | Không thể uỷ quyền "dọn kho media" cho nhân viên cụ thể — phải dùng tài khoản Super Admin. Phù hợp cho v1. |
| **Phương án đề xuất** | Giữ wildcard cho v1. Bổ sung `media.hard_delete` nếu cần phân quyền tinh hơn. |
| **Owner** | PM / Dev |
| **Deadline** | Không urgent. |
| **Chặn launch?** | ❌ Không |

---

## E. Tóm tắt — Bảng quyết định

| # | Mục | Loại | Chặn launch? | Owner | Deadline |
|---|---|---|---|---|---|
| A-1 | Hoá đơn điện tử | Pháp lý | ⚠️ **Cần xác nhận** | Chủ shop / Kế toán | Trước go-live |
| A-2 | Bảo vệ dữ liệu cá nhân | Pháp lý | ⚠️ **Cần xác nhận** | Chủ shop / Luật sư | Trước go-live |
| B-1 | Thông báo khi duyệt review | Nghiệp vụ | ❌ Không | Marketing | Sau launch |
| B-2 | Phiếu nhập kho | Nghiệp vụ | ❌ Không | Thủ kho | Phase 2 |
| B-3 | Tích hợp đơn vị vận chuyển | Nghiệp vụ | ❌ Không | Vận hành | Khi volume đủ |
| C-1 | Wishlist mobile | Tính năng | ❌ Không | Mobile dev | Sprint 1–2 |
| C-2 | Deep link verify email | Tính năng | ❌ Không | Mobile dev | Sprint 2–3 |
| C-3 | Home-videos mobile | Tính năng | ❌ Không | Mobile dev | Sprint 1–2 |
| D-1 | Best-effort notification | Kỹ thuật | ❌ Không | Dev | Sau launch |
| D-2 | Dashboard permission | Kỹ thuật | ❌ Không | PM/Dev | Phase 2 |
| D-3 | Media hard-delete permission | Kỹ thuật | ❌ Không | PM/Dev | Phase 2 |

---

## F. Launch caveats cho từng bề mặt

### Web (bigbike-web) — 🟢 Launch ngay được
- Tất cả luồng mua hàng, tài khoản, trả hàng, bảo hành đã test end-to-end.
- Catalog, blog, coupon, wishlist, địa chỉ, liên hệ hoạt động đúng.
- Chỉ cần xác nhận A-1 và A-2 (pháp lý) trước khi go-live nếu áp dụng.

### Admin (bigbike-admin) — 🟢 Launch ngay được
- Đơn hàng, POS, kho, serial, nhân sự, báo cáo, nội dung, redirect, coupon, công nợ — đã test.
- Audit log đầy đủ cho toàn bộ thao tác quan trọng.
- Dashboard tự động nhận đơn mới qua WebSocket.

### Backend / API — 🟢 Launch ngay được
- Tiền không bị tính sai (backend tự tính, không tin frontend).
- Kho không bán âm (pessimistic lock).
- Hoàn tiền đồng bộ với serial, bảo hành, công nợ.
- Phân quyền theo role — đã seed đủ cho ADMIN và SHOP_MANAGER.

### App mobile — 🟡 Launch được, lưu ý 3 điểm
1. **Xác nhận email hoạt động trong app** — khách đăng ký nhận màn thông báo và nút "Gửi lại". Link trong email mở web để xác nhận (deep link là enhancement sau).
2. **Wishlist chưa có trên mobile** — khách dùng app không lưu sản phẩm yêu thích được. Có thể dùng web. Cần implement trong sprint 1–2 sau launch.
3. **Home-videos chưa hiển thị trên mobile** — trang chủ app thiếu phần video. Sprint 1–2 sau launch.

---

## G. Post-launch hardening backlog

Sau khi go-live ổn định, ưu tiên theo thứ tự:

| Ưu tiên | Việc cần làm | Lý do |
|---|---|---|
| 1 | Chốt hoá đơn điện tử + data export/delete (nếu A-1/A-2 chưa xong trước launch) | Pháp lý |
| 2 | Bổ sung wishlist + home-videos cho mobile | Feature parity |
| 3 | Deep link verify email cho mobile | UX |
| 4 | Cân nhắc tích hợp GHN/GHTK | Khi volume tăng |
| 5 | Bổ sung test state transition matrix (Order/Payment/Return) | Lưới an toàn kỹ thuật |
| 6 | Cân nhắc permission `media.hard_delete` nếu cần uỷ quyền dọn kho media | Phân quyền tinh |
| 7 | Cân nhắc thông báo email khi review được duyệt | Engagement |

---

## H. Theo dõi 7 ngày đầu sau launch

> Checklist này dành cho người vận hành và chủ shop — không cần dev trực liên tục.

### Ngày 1–2 (ngay sau go-live)

- [ ] Thực hiện ít nhất 1 đơn hàng test thật (chọn sản phẩm → thanh toán → admin xác nhận → giao hàng).
- [ ] Kiểm tra email xác nhận đơn hàng gửi đến hộp thư khách (và không rơi vào Spam).
- [ ] Đăng ký tài khoản mới trên web — nhận email xác minh → xác nhận link.
- [ ] Đăng ký trên app mobile — nhận màn "Xác nhận email" → gửi lại → xác nhận qua web.
- [ ] Tạo 1 đơn POS tại quầy — kiểm tra kho trừ đúng.
- [ ] Kiểm tra màn Dashboard admin hiển thị đúng số đơn, doanh thu.

### Ngày 3–4

- [ ] Kiểm tra 1 yêu cầu hoàn trả — đơn DELIVERED → khách tạo return → admin xử lý → serial vào trạng thái INSPECTING.
- [ ] Kiểm tra bảo hành — tra cứu serial đã bán → hiện đúng thông tin và ngày còn lại.
- [ ] Kiểm tra coupon — tạo 1 mã giảm giá, dùng khi thanh toán, kiểm tra giá trừ đúng.
- [ ] Đọc audit log trong admin — mọi thao tác quan trọng (sửa đơn, điều chỉnh kho) phải có vết.

### Ngày 5–7

- [ ] Xem báo cáo doanh thu trong admin — số khớp với đơn hàng thực.
- [ ] Kiểm tra nhân viên mới có đăng nhập và thực hiện được đúng phần quyền không.
- [ ] Kiểm tra stock sau 1 tuần — không có sản phẩm bán âm kho.
- [ ] Review log lỗi server (nếu có access) — không có lỗi 500 lặp lại.
- [ ] Ghi nhận phản hồi từ nhân viên quầy và khách hàng — ưu tiên fix trước sprint tiếp theo.

---

*Tài liệu tham chiếu: [`BIGBIKE_FULL_E2E_WORKFLOW_AUDIT.md`](BIGBIKE_FULL_E2E_WORKFLOW_AUDIT.md) — đặc biệt Section 14 (Final Review).*
