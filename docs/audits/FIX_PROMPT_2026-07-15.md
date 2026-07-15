# PROMPT — Đợt sửa lỗi theo AUDIT_2026-07-15_FINAL (toàn bộ 77 finding)

> **Cách dùng (cho user):** mở session Claude Code mới tại thư mục gốc repo (`bigbike-web-new/`) và gõ:
>
> **"Đọc và thực hiện docs/audits/FIX_PROMPT_2026-07-15.md"**
>
> Nếu session trước làm dở: vẫn dùng đúng câu đó — agent phải đọc `FIX_PROGRESS_2026-07-15.md` trước và làm tiếp từ mục ⬜ kế tiếp, không làm lại mục đã ✅.

---

## 0. Nhiệm vụ

Sửa **toàn bộ 77 finding** trong [`AUDIT_2026-07-15_FINAL.md`](./AUDIT_2026-07-15_FINAL.md) theo thứ tự phase bên dưới. Phạm vi và toàn bộ quyết định nghiệp vụ đã được owner chốt ngày 2026-07-15 (mục 2) — **không hỏi lại các quyết định này**.

Trước khi bắt đầu:

1. Đọc `docs/audits/AUDIT_2026-07-15_FINAL.md` (danh mục AUD + evidence path). Chi tiết tái hiện sâu hơn nằm ở 2 báo cáo gốc `AUDIT_2026-07-15.md` / `AUDIT_2026-07-15_v2.md` — chỉ mở khi cần.
2. Đọc `docs/audits/FIX_PROGRESS_2026-07-15.md` — bảng trạng thái 77 mục. **Cập nhật file này ngay sau khi xong TỪNG mục** (không dồn cuối) để session sau tiếp nối được.
3. Tuân thủ `CLAUDE.md`/`AGENTS.md` của repo: Docs-First Contract, UI stack (React + Tailwind + Radix + shadcn), design token 2 app, encoding UTF-8 tiếng Việt có dấu, Lombok/MapStruct/Bean Validation phía backend.
4. Làm việc trên nhánh mới `fix/audit-2026-07-15` tách từ `main`. Commit theo từng nhóm nhỏ (xem mục 4), message liệt kê mã AUD. **Không push** nếu user không yêu cầu.

**Mốc audit là commit `251b1ca67`** — code có thể đã thay đổi. Với TỪNG finding: mở đúng evidence path trong audit, **xác minh vấn đề còn tồn tại** rồi mới sửa. Nếu đã được sửa từ trước → đánh dấu ✅ trong progress với ghi chú "đã hết từ trước, verify tại <file:line>", không sửa gì thêm.

## 1. Nguyên tắc Docs-First cho đợt này

- Finding chạm business rule / API contract / data shape / permission / state machine / workflow / deployment env → **sửa docs trước hoặc cùng commit với code** (dùng skill `/docs-first` khi bắt đầu mỗi nhóm).
- Các quyết định owner ở mục 2 là **căn cứ mới nhất, thắng mọi câu docs cũ mâu thuẫn**. Khi docs mâu thuẫn với quyết định owner → sửa docs theo quyết định owner, cite "owner decision 2026-07-15 (FIX_PROMPT_2026-07-15.md §2)".
- Gặp `NEEDS_VERIFICATION` / `NOT_FOUND_IN_REPO` / `CONFLICTING_EVIDENCE` mà mục 2 không trả lời được → dừng mục đó, đánh dấu ❓ trong progress kèm câu hỏi cụ thể, làm tiếp mục khác. KHÔNG bịa rule.

## 2. Quyết định owner đã chốt 2026-07-15 — KHÔNG HỎI LẠI

| # | Chủ đề | Quyết định | Hệ quả khi sửa |
|---|---|---|---|
| 1 | **AUD-001 Blocker** | Sửa ngay + rà dữ liệu (chỉ đọc) | Vá code; sau đó rà DB/log **chỉ bằng SELECT read-only** (xem §5) xem đã có tài khoản nào đổi email rồi được liên kết guest order chưa; báo kết quả cho user. |
| 2 | **AUD-005 — tự hủy BACS 72h** | **GỠ hẳn cơ chế tự hủy** | Xóa `OrderAutoCancelService`/`OrderAutoCancelScheduler` + config/test liên quan; docs ghi rõ: không có auto-cancel, đơn treo do admin tự xử lý (nhất quán mô hình đối soát thủ công 2026-06-23). |
| 3 | **AUD-025 — khách tự hủy đơn** | **Thông báo đầy đủ** | Bổ sung ngang mức đơn mới: WebSocket + bản ghi thông báo admin (chuông/inbox) + audit log + email xác nhận hủy cho khách. Update BUSINESS_RULES/API_CONTRACT tương ứng. |
| 4 | **AUD-063 — slider** | **Gỡ 3 vị trí** `category`, `category_sidebar`, `promotion` khỏi admin; chỉ giữ `home` | Gỡ lựa chọn vị trí ở admin UI + backend chỉ chấp nhận `home` cho bản ghi mới. **KHÔNG xóa dữ liệu slider cũ bằng migration** — nếu thấy bắt buộc phải xóa data, dừng hỏi user (destructive). |
| 5 | **AUD-074 — audio** | **Gỡ audio** | Gỡ bộ lọc/đếm Audio ở Media Library admin; backend từ chối MIME audio khi upload; sửa dòng "selected audio formats" trong BUSINESS_RULES Media Rules. Không đụng object audio đã có trong MinIO (nếu có). |
| 6 | **AUD-041 — trang chính sách** | **Chốt 3 trang, danh sách cố định trong web, admin không quản lý** | 3 trang: Bảo mật thông tin, Bảo hành, Đổi trả hàng. Sửa BUSINESS_RULES "Policy Page Rules" (bỏ mô tả menu `policy` admin-managed, POLICY_PAGE_RULE_002/003 cũ) + API_CONTRACT chỗ ghi "4 trang chính sách" → 3, khớp section "Menu location policy — Đã gỡ (2026-07-03)". Liên quan AUD-031: đảm bảo cả 3 slug chính sách được build/render và canonical đúng. |
| 7 | **AUD-044 — rule thương mại** | **Theo mô hình Còn/Hết thủ công** | Chốt 3 điều: (a) bán KHÔNG tự trừ kho, hủy KHÔNG tự hoàn kho — admin bật/tắt Còn/Hết bằng tay; (b) thanh toán: theo quyết định #10 — duy nhất COD hiển thị cố định; (c) giao hàng miễn phí (SHIP_RULE_001 giữ nguyên). Dọn mọi câu docs trái với 3 điều này (vd ORDER_RULE_004 "Cancelling restores stock", API_CONTRACT mô tả customer-cancel "restores stock"). Nếu code thực sự tự đổi Còn/Hết khi hủy đơn → gỡ hành vi đó theo quyết định này; nếu chỉ là câu docs sót → chỉ sửa docs. Copy web nói "hoàn tồn khi hủy" (AUD-030) sửa theo. |
| 8 | **AUD-056/066/067/068 + dead code — API không có caller** | **Không có app mobile hay hệ thống ngoài → ĐƯỢC GỠ** | Trước khi xóa từng endpoint vẫn phải grep toàn repo (web + admin + backend + docs) xác nhận 0 caller nội bộ. Gỡ endpoint + DTO/service dư + cập nhật API_CONTRACT/API_FLOW_MAP. OpenAPI regen dồn về AUD-047 cuối cùng. |
| 9 | **Hóa đơn điện tử (NĐ 123/2020)** | **Dự án riêng, không thuộc đợt này** | Chỉ ghi rõ trong docs (PROJECT_OVERVIEW/BUSINESS_RULES chỗ phù hợp): "chưa triển khai — owner sẽ chọn nhà cung cấp; vẫn là blocker trước khi bán thật". Không code gì. |
| 10 | **AUD-011 / phương thức thanh toán** (owner bổ sung 2026-07-15) | **Trang đặt hàng bigbike-web có đúng 1 phương thức: "Thanh toán khi nhận hàng (COD)"** | Checkout và mua nhanh hiển thị cố định COD (chỉ 1 phương thức nên không có bước chọn), payload gửi `paymentMethod = COD`, đơn mới lưu `COD`; BACS không được chào trên storefront (đơn cũ mang BACS/null vẫn đọc/hiển thị bình thường). Cập nhật PAY_RULE_001/PAY_RULE_002 + API_CONTRACT (checkout options) theo — thay mô tả cũ "không gửi paymentMethod / lưu null". Quyết định này **thắng** câu "web không hỏi phương thức thanh toán, lưu null" trong docs hiện tại. |

## 3. Trình tự thực hiện

Làm theo đúng thứ tự. Trong mỗi phase, xử lý theo nhóm rồi commit.

### Phase 0 — P0 Blocker
- **AUD-001**: hủy trạng thái xác minh khi đổi email; không tự liên kết guest order tới khi email mới xác minh lại. Sau khi vá: rà dữ liệu read-only (§5) và ghi kết quả vào progress.

### Phase 1 — 22 High, 4 nhóm (commit riêng từng nhóm)
- **1A Đơn hàng/giá/tồn kho:** AUD-002, 003, 007, 010, 011, 016. Lưu ý AUD-011: sửa theo quyết định #10 — checkout + mua nhanh hiển thị cố định đúng 1 phương thức "Thanh toán khi nhận hàng (COD)" và gửi `paymentMethod = COD` khi tạo đơn; docs PAY_RULE cập nhật cùng commit.
- **1B Nội dung/media/song ngữ/SEO:** AUD-004, 008, 012, 013, 014, 015, 063 (theo quyết định #4).
- **1C Bảo mật/hạ tầng:** AUD-009, 020, 061, 062. AUD-009: chỉ sửa `docker-compose.yaml` (bind 127.0.0.1) + docs, **không restart stack** — ghi vào mục "việc user cần làm". AUD-061/062: thêm biến vào compose + `.env.example`, nhắc user tự cập nhật `.env` thật (không commit `.env`). AUD-020: nâng dependency có advisory; nếu buộc phải major-bump gây breaking → ghi ❓ trong progress, không phá build.
- **1D Email & thông báo admin:** AUD-005 (quyết định #2), 006, 017, 018, 019. AUD-018/019: chuyển mô hình đã-đọc per-admin, giữ backlog — sửa cùng AUD-017 vì chung data model + UX chuông.

### Phase 2 — 30 Medium
- **2A Code khách/vận hành (20):** AUD-021, 022, 023, 024, 025 (quyết định #3), 026, 027, 028, 029, 030, 031, 032, 033, 034, 035, 036, 037, 038, 064, 065. Lưu ý: AUD-022 (bỏ miễn CSRF checkout/quick-buy theo docs) sửa cùng test stale CSRF của AUD-046; AUD-064 mở rộng video sang TikTok/Facebook theo AGENTS.md §14.3 (reject link rút gọn).
- **2B Docs chuẩn (9):** AUD-039, 040, 041 (quyết định #6), 042, 043, 044 (quyết định #7), 045, 046 (phần test stale còn lại), 048. Sửa docs xong mới sửa code phụ thuộc rule đó (nếu có).

### Phase 3 — 24 Low + chốt sổ
- **3A Lỗi nhỏ rõ ràng:** AUD-049, 050, 051, 052, 053, 054, 059, 069, 070, 071, 072, 073, 075.
- **3B Dọn dead code/API (theo quyết định #8):** AUD-055, 056, 057, 058, 060, 066, 067, 068, 074 (quyết định #5), 076, 077.
- **3C Cuối cùng:** AUD-047 — regen/dọn OpenAPI **sau khi** đã gỡ hết endpoint ở 3B để chỉ làm một lần. Ghi chú hóa đơn điện tử theo quyết định #9.

## 4. Quality gate cho TỪNG commit

1. `/docs-first` khi bắt đầu nhóm; docs update nằm cùng commit với code chạm rule/contract.
2. `/hygiene` cho mọi thay đổi UI/text (dead CSS, mojibake, tiếng Việt mất dấu, business-data hardcode).
3. `/preflight` trước mỗi commit — tự phát hiện sub-project đã đổi và chạy đúng bộ check mirror CI (web: test/lint/build; admin: test/lint; backend: theo TESTING_GUIDE.md).
4. Test backend stale (AUD-046) phải được sửa cùng nhóm gây ảnh hưởng — không được "tạm skip test".
5. Progress file: cập nhật trạng thái + commit hash ngay sau mỗi mục.

## 5. Giới hạn an toàn (bắt buộc)

- **Docker:** luôn `docker ps` trước; container cần dùng chưa chạy → dừng, ghi ❓, yêu cầu user khởi động. **Không** `up/start/restart/down/rm/prune` — kể cả để "áp dụng" thay đổi compose.
- **Database:** chỉ đọc (`SELECT`, `\d`, logs). Rà soát AUD-001 chỉ dùng SELECT qua container DB đang chạy; kết quả có thể chứa PII → chỉ ghi số lượng + order id/account id vào báo cáo, không chép PII ra file.
- **Không xóa dữ liệu** (DB row, object MinIO) trong mọi migration/cleanup đợt này; gặp trường hợp buộc phải xóa → dừng hỏi user.
- **Không commit `.env`**; biến mới → `.env.example` + compose + docs.
- Endpoint chỉ được xóa sau khi grep 0 caller nội bộ (quyết định #8 đã xác nhận không có client ngoài).
- Không push, không mở PR nếu user không yêu cầu.

## 6. Báo cáo cuối session (viết cho chủ shop — ngôn ngữ kinh doanh, tiếng Việt)

1. Tổng kết: bao nhiêu mục ✅ / ⏭ / ❓ theo phase; đối chiếu `FIX_PROGRESS_2026-07-15.md`.
2. **Việc user cần tự làm** (ít nhất): khởi động lại stack để áp dụng compose (AUD-009/061/062) sau khi điền `.env` thật; các mục runtime verification ở §6 của audit (SMTP, OAuth, firewall, WebSocket, backup…) vẫn chưa kiểm — liệt kê lại.
3. Mục ❓ đang chờ quyết định/kiểm tra gì.
4. Nhắc: sau khi sửa xong toàn bộ nên chạy một đợt re-audit/retest riêng (báo cáo audit gốc giữ nguyên, không sửa nội dung file audit).
