# BigBike — Báo cáo kiểm thử Production-Readiness

> Tạo bởi vòng QA tự động (2026-06-04). **Không sửa code production** — chỉ thêm test.
> Kỳ vọng lấy từ `docs/` (cite theo từng dòng). Test chạy thật trên **stack docker đang chạy**
> (PostgreSQL thật) + một số test JUnit chạy trong container Maven tạm thời.

---

## 1. Tóm tắt điều hành

| Hạng mục | Kết quả |
|---|---|
| Vùng 🔴 rủi ro cao nhất | **Đã test tự động** — phần lớn ĐẠT; phát hiện **2 lỗi thật** |
| Bug mới phát hiện | **BUG-1** (idempotency retry trả 500), **BUG-2** (không hoàn tồn kho khi hoàn tiền/hủy/trả) |
| Live black-box | 5 suite, **51 PASS / 3 FAIL** (3 FAIL = 2 bug: BUG-1 ×1, BUG-2 ×2) |
| JUnit gap test (mới) | 8 PASS (prod-profile auth 6/6, email link 2/2) |
| Hạ tầng test sẵn có | 75 class; nhóm dùng `test-seed.sql` đang **vỡ build sạch** (lệch schema, không phải bug sản phẩm) |

**Kết luận nhanh:** Các cơ chế tiền-bạc/tồn-kho cốt lõi phần lớn đúng (chống bán âm kho, chống đặt
trùng, state machine đơn, refund full-only, phân quyền backend, auth production fail-fast, link email
đúng `localhost:3000`). **Hai lỗi nghiêm trọng cần sửa trước production:** (BUG-2) hoàn tiền/hủy/trả
**không cộng lại tồn kho** cho toàn bộ catalog đã migrate → hao hụt kho vĩnh viễn; (BUG-1) bấm đặt 2
lần (cùng phiên) → đơn **không** bị nhân đôi nhưng request thứ 2 trả **lỗi 500** thay vì trả lại đơn cũ.

**Cách chạy lại:** `pwsh qa-tests/run-all.ps1` (xem `qa-tests/README.md`).

---

## 2. Bug mới phát hiện (KHÔNG tự sửa — task riêng)

> Không trùng với bug đã flag trong `docs/audits/` (các audit chỉ là vấn đề chất-lượng-dữ-liệu khi
> import WordPress: thiếu `short_description`, `retail_price=0`, thiếu `brand_id`… — không phải code bug).

### 🔴 BUG-2 — Hoàn tiền / Hủy / Trả hàng KHÔNG hoàn lại tồn kho (nghiêm trọng nhất)
- **Triệu chứng (repro sạch):** POS bán 3 cái → `quantity_on_hand` 10→7; hoàn tiền toàn phần (HTTP 200,
  đơn → `REFUNDED`) → tồn **vẫn 7** (kỳ vọng 10). Không có stock movement `IN` nào được ghi.
- **Phạm vi:** Áp dụng cho **toàn bộ catalog** (sản phẩm id dạng chuỗi `wp-*`, tức gần như mọi sản phẩm
  đã migrate). Lúc bán thì **trừ kho đúng** (thao tác trực tiếp trên variant), nhưng lúc hoàn thì **không
  cộng lại** → hao hụt tồn vĩnh viễn sau mỗi lần hoàn tiền / hủy đơn chưa-giao / hoàn tất phiếu trả.
- **Nguyên nhân gốc:** `OrderStockRestoreService` (refund/cancel) và `AdminReturnService.restoreStockForReturn`
  (return) đọc `OrderLineItemEntity.productId` / `productVariantId` — đây là cột **UUID** (`product_id`,
  `product_variant_id`) **luôn NULL** vì id sản phẩm/variant là chuỗi, được lưu ở cột `product_pk` (varchar).
  Guard `if (item.getProductId() == null) continue;` → **bỏ qua mọi dòng** → không hoàn kho.
  (Đã xác nhận: cả 6 `order_line_items` hiện có đều có `product_variant_id` NULL.)
- **Vi phạm rule:** `STATE_MACHINES.md` §6 (Hủy/Thất bại → hoàn tồn kho + nhả serial), Returns And
  Inspection Rules (COMPLETED-from-RECEIVED hoàn kho món đã nhận), `BUSINESS_RULES.md` refund restore.
- **Bằng chứng test:** `fulfillment` › "Full refund RESTORES variant stock" (FAIL); `returns` › "Admin
  COMPLETED restores stock…" (FAIL). Mã: `OrderStockRestoreService.java:51`, `AdminReturnService.java:356/361`,
  `OrderLineItemEntity.java:35-42`.
- **Lưu ý:** Serial-tracked items hoàn theo đường serial-API riêng (không nằm trong phạm vi lỗi này).
- **✅ ĐÃ SỬA:** Thêm cột `order_line_items.product_variant_pk` (varchar — V158, đối ứng `product_pk`
  của V74), ghi `variant.getId()` ở đường POS + quick-buy, và cho 2 service hoàn kho resolve
  product/variant qua `OrderLineItemEntity.resolveVariantKey()`/`resolveProductKey()` (UUID rồi
  varchar PK). Đường serial không đổi. Regression test Postgres: `QaBug2StockRestoreTest` (8/8).
  Docs: `DATA_CONTRACT.md` (`product_variant_pk`), `STATE_MACHINES.md` §6/§9/§10.
- **Phát hiện phụ (follow-up, KHÔNG sửa ở đây):** status `INSPECTING` nằm trong transition map của
  code nhưng KHÔNG có trong CHECK constraint `chk_returns_status` (V66/V104) → không persist được
  → luồng INSPECTING hiện không chạy end-to-end (khớp ghi nhận "RECEIVED→INSPECTING BLOCKED").

### 🔴 BUG-1 — Idempotency retry của checkout/quick-buy trả HTTP 500
- **Triệu chứng (repro):** Gửi quick-buy 2 lần với **cùng `Idempotency-Key` + cùng phiên** → lần 2 trả
  **HTTP 500** (`SERVER_ERROR`) thay vì trả lại đơn đã tạo. **Đơn KHÔNG bị nhân đôi** (ràng buộc UNIQUE
  `uk_checkout_idempotency_flow_scope_key` chặn; kho chỉ trừ 1 lần) — nhưng client nhận lỗi 500.
- **Nguyên nhân gốc:** Nhánh dedup `CheckoutService.loadExistingSummary` (đường tải lại đơn cũ) ném
  `org.hibernate.query.sqm.PathElementException: Could not resolve attribute 'categories' of ProductEntity`
  — một query catalog tham chiếu thuộc tính `categories` không tồn tại trên `ProductEntity` (xem
  `CatalogReadService`). Đường tạo đơn mới (lần 1) không đi qua query này nên không lỗi.
- **Vi phạm rule:** checklist item 8 🔴 "bấm đặt 2 lần → chỉ tạo 1 đơn (idempotency)" — về *số đơn* thì
  đạt (1 đơn), nhưng *hợp đồng API* "retry trả lại đơn cũ (200)" thì **vỡ trên PostgreSQL**.
- **Bằng chứng test:** `commerce-risk` › "Idempotency: retry returns the SAME order (HTTP 200)" (FAIL).
  Log backend: `GlobalExceptionHandler - Unhandled exception … PathElementException 'categories'`.

### Quan sát phụ (không phải bug sản phẩm — cần lưu ý)
- **OpenAPI thiếu endpoint:** `/customer/auth/password/forgot`, `/password/reset`, return
  `inspect`/`return-eligibility` **tồn tại trong code nhưng không có trong `/v3/api-docs`** → spec không
  đầy đủ (ảnh hưởng client sinh từ spec). Item 20/chất lượng tài liệu.
- **POS payment enum:** OpenAPI ghi `CASH|CARD_TERMINAL`, nhưng service chấp nhận cả `CREDIT`
  (`PosOrderService` validate 3 giá trị). Lệch doc-vs-code.
- **Hạ tầng test (H2):** `db/test-seed.sql` statement #33 insert `products` thiếu cột NOT NULL
  `version` → `NULL not allowed for column "version"` → 12 test integration dùng seed này **fail khi
  build sạch**. Đây là **lệch schema của fixture test**, không phải bug sản phẩm. (Nhóm test không dùng
  seed này vẫn xanh: AdminAuth 10/10, customer-auth 20/20, cart 27/27, RBAC 7/7.)

---

## 3. Ánh xạ kết quả theo từng mục checklist

Ký hiệu: **PASS** = test tự động đạt · **FAIL** = vi phạm rule (xem bug) · **PARTIAL** = đạt phần cốt lõi,
phần còn lại cần test tay/đã có test sẵn · **MANUAL** = ngoài phạm vi tự động vòng này · **BLOCKED** = không
chạy được do hạ tầng.

### A. Catalog
| # | Mục | KQ | Bằng chứng / ghi chú |
|---|---|---|---|
| 1 | Sản phẩm (tạo/biến thể/vòng đời/tồn=0/song ngữ/SEO) | PARTIAL | Mua hàng yêu cầu `PUBLISHED` + variant available (xác nhận live, CheckoutService:297). Vòng đời/song ngữ/SEO: test sẵn (`ProductBilingualRoundtripTest`, `AdminMutationApiTest`) + **MANUAL** cho UI. |
| 2 | Danh mục & thương hiệu | MANUAL | Test sẵn `AdminCatalog*`; cây menu/ẩn cha-con cần test tay. |

### B. Nội dung
| # | Mục | KQ | Ghi chú |
|---|---|---|---|
| 3 | Blog/Trang | MANUAL | Test sẵn `ContentP1ApiTest`, `ContentPublicApiTest`. |
| 4 | Media (upload, **chặn file độc hại**) | MANUAL | Test sẵn `AdminMediaP0Test`; chặn SVG/giả-mạo/rỗng → test tay/bổ sung. |
| 5 | Editor (menu/slider/settings) | MANUAL | Test sẵn `SliderApiTest`, `AdminContentApiTest`. |

### C. Mua hàng online
| # | Mục | KQ | Bằng chứng |
|---|---|---|---|
| 6 | Tìm kiếm / so sánh / wishlist | PARTIAL | Test sẵn `PublicReadApiTest`, `CustomerWishlistApiTest`. Search UX → MANUAL. |
| 7 | Giỏ hàng + coupon | PASS (existing) | `Phase1ECartApiTest` 27/27. Coupon redeem chống đua = conditional `attemptRedeem` (CouponJpaRepository). |
| 8 | **Checkout 🔴** | **PASS + BUG-1** | Oversell: 2 mua đồng thời/stock=1 → đúng 1 đơn, kho về 0 (PASS). Chống nhân đơn: kho chỉ trừ 1 lần (PASS). **Idempotency retry → 500 = BUG-1.** COD→PROCESSING, BACS→giữ (code). `commerce-risk.test.mjs`. |

### D. Xử lý đơn (Admin)
| # | Mục | KQ | Bằng chứng |
|---|---|---|---|
| 9 | **Trạng thái đơn 🔴** | **PASS + BUG-2** | COMPLETED/REFUNDED là terminal (PASS); COD chưa thu tiền không cho hoàn thành — ORDER_RULE_002 (PASS); không hủy đơn đã PAID — ORDER_RULE_004 (PASS); COMPLETED→REFUNDED phải qua /refund (PASS). **Hủy/Thất bại → hoàn kho = BUG-2 (FAIL).** `fulfillment.test.mjs`. |
| 10 | Giao vận | PASS | Đã chạy chuỗi hợp lệ UNFULFILLED→PROCESSING→SHIPPED(bắt buộc mã vận đơn)→DELIVERED→COMPLETED (live). Cấm nhảy thẳng = transition map (AdminOrderService). |
| 11 | **Thanh toán & hoàn tiền** | **PASS + BUG-2** | Refund full-only (chặn hoàn một phần, PASS); refund→REFUNDED, REFUNDED terminal (PASS). **Hoàn kho khi refund = BUG-2 (FAIL).** Công nợ tất toán khi refund = code-confirmed (RefundService AR write-off). |

### E. POS
| # | Mục | KQ | Bằng chứng |
|---|---|---|---|
| 12 | **Bán POS 🔴** | **PASS** | Tiền mặt → đơn COMPLETED+PAID ngay, trừ kho đúng (PASS). Idempotency POS (`posIdempotencyKey` trùng → cùng đơn, không trừ kho 2 lần) **PASS** (khác BUG-1: POS dùng `findByOrderKey`). CREDIT/override giá → **PARTIAL** (chưa test live; code-confirmed). |
| 13 | Công nợ (AR) | PARTIAL/EXISTING | `AdminReceivableApiTest` (đang BLOCKED bởi H2 seed). AR tạo/ghi nhận/aging → test tay. |

### F. Đổi/trả
| # | Mục | KQ | Bằng chứng |
|---|---|---|---|
| 14 | **Luồng đổi trả 🔴** | **PASS + BUG-2 + BLOCKED(QC)** | Khách KHÔNG xem/trả được đơn người khác → 404 (PASS, RETURN_RULE_006). Đơn POS không trả online được (PASS). `reason` là enum, tạo phiếu trên đơn-của-mình đã COMPLETED → 201 (PASS). Admin PENDING→APPROVED→RECEIVED (PASS). **Hoàn tất → hoàn kho món PASS = BUG-2 (FAIL).** Kiểm định PASS/FAIL per-item (món FAIL không nhập kho): non-serial RECEIVED→INSPECTING trả 409 → **BLOCKED**, cần fixture serial; cơ chế xác nhận trong code (AdminReturnService:358 bỏ qua FAIL). `returns.test.mjs`. |

### G. Kho & tồn
| # | Mục | KQ | Bằng chứng |
|---|---|---|---|
| 15 | Tồn kho / serial | PARTIAL + BUG-2 | Trừ kho khi bán = đúng (live oversell/POS). **Hoàn kho khi trả/hủy/refund = BUG-2.** Serial tracking: test sẵn `Phase1KInventorySerialApiTest`. Điều chỉnh tồn/CSV → test tay. |

### H. Khuyến mãi
| # | Mục | KQ | Ghi chú |
|---|---|---|---|
| 16 | Coupon & tặng mã | EXISTING/MANUAL | `AdminCouponGiftApiTest` (BLOCKED bởi H2 seed). Tặng mã hàng loạt + email → test tay. |

### I. Tài khoản khách
| # | Mục | KQ | Bằng chứng |
|---|---|---|---|
| 17 | **Đăng ký/đăng nhập 🔴** | **PASS** | Đăng ký/đăng nhập/refresh: `Phase1DCustomerAuthTest` 20/20. **Reset/verify link = `http://localhost:3000/...`** xác nhận 3 lớp: `.env` + biến môi trường container đang chạy + **email thật capture** (`QaEmailLinkCaptureTest` 2/2). `forgot` tạo token + gửi mail (live). FB/Google → MANUAL. |

### J. Phân quyền
| # | Mục | KQ | Bằng chứng |
|---|---|---|---|
| 18 | **Vai trò admin 🔴** | **PASS (core) + PARTIAL** | Khách → API admin = 401; khách đã đăng nhập (customer) → 403 (backend chặn, không chỉ ẩn UI) — PASS (`auth-permission.test.mjs`). Header `X-Admin-Role` giả mạo KHÔNG bypass (dev-header tắt trên stack) — PASS. **DevAdminAuthService ném lỗi ở profile prod** — PASS (`QaDevAdminAuthProdProfileTest` 6/6). Phân quyền từng vai trò (Editor/Author…) + guardrail Super Admin → `RbacSecurityTest` 7/7 + **MANUAL**. |

### K. Thông báo / vận chuyển / SEO / audit
| # | Mục | KQ | Ghi chú |
|---|---|---|---|
| 19 | Thông báo | PARTIAL | **Email giao dịch (reset/verify) gửi thật + đúng link** = PASS (capture). WebSocket real-time đẩy đơn mới → MANUAL (assert message phát = test sẵn). |
| 20 | Vận chuyển/SEO/audit | PARTIAL | Phí ship theo method áp đúng lúc checkout (live: auto-select method, phí 30.000đ). Redirect SEO `AdminRedirectApiTest`; audit log `AdminAuditLogApiTest`. → MANUAL phần còn lại. |

### L. Xuyên suốt
| Mục | KQ | Bằng chứng |
|---|---|---|
| Responsive web/admin | MANUAL | Playwright specs sẵn có (`bigbike-web/e2e`, `bigbike-admin/e2e/specs`) — đánh giá thị giác = test tay/chụp màn. |
| Song ngữ & mojibake | MANUAL/EXISTING | `ProductBilingualRoundtripTest`; mojibake email/UI → kiểm tay. |
| **Bảo mật: CSRF + không truy cập chéo** | **PASS** | Mutation khách cần `X-CSRF-Token` khớp cookie `bb_csrf` (CustomerCsrfFilter); khách B không đọc/đổi-trả được đơn khách A → 404 (`returns`). Upload file độc hại → MANUAL. |
| Hiệu năng | MANUAL | Smoke listing/search — test tay. |
| **Môi trường (.env)** | **PASS** | Reset/verify URL=localhost:3000, profile=dev, CORS (localhost:3000 OK / evil.com 403), SMTP host set — `config-env.test.mjs` 12/12. |

---

## 4. Khoảng trống cần test tay (đề xuất)

1. **Email tới hộp thư thật** (Gmail/Outlook) — vòng này verify tới mức render+link đúng; gửi-thật cần mở SMTP thật hoặc mail-catcher.
2. **WebSocket real-time** — đã có cơ chế phát `NEW_ORDER`; cảm nhận real-time + Notification Center cần test tay.
3. **Phán xét thị giác responsive / song ngữ / mojibake** — chạy Playwright sẵn có + review ảnh.
4. **Upload file độc hại** (SVG/giả-mạo định dạng/rỗng) — bổ sung test bảo mật media.
5. **Phân quyền từng vai trò chi tiết** (Editor/Author/Contributor/SEO Editor thấy đúng module) + guardrail Super Admin — mở rộng từ `RbacSecurityTest`.
6. **POS CREDIT + công nợ (AR)** end-to-end + aging/hạn mức — cần fixture khách có `creditEnabled`.
7. **Kiểm định trả hàng cho hàng serial (mũ/giáp)** — cần fixture serial để chạy INSPECTING + FAIL-không-nhập-kho.
8. **Khắc phục hạ tầng test H2** (`test-seed.sql` thiếu cột `version`) để chạy lại trọn bộ 75 test integration sẵn có.

---

## 5. Cách test & tổ chức

- Live black-box: `qa-tests/live/` (Node, không phụ thuộc). Chạy: `node qa-tests/live/run.mjs`. Kết quả JSON: `qa-tests/.artifacts/live-results.json`.
- JUnit gap test mới: `bigbike-backend/src/test/java/com/bigbike/bigbike_backend/qa/` — chạy trong container Maven tạm.
- Một lệnh: `pwsh qa-tests/run-all.ps1`. Chi tiết: `qa-tests/README.md`.
- Fixtures cô lập (`qatest-*`) tạo từ bản clone sản phẩm thật, **tự dọn** sau khi chạy.
