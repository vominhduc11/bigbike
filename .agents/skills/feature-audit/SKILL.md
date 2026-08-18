---
name: feature-audit
description: "Dùng khi cần audit một tính năng kinh doanh đi hết chặng qua bigbike-web, bigbike-admin, bigbike-backend và tài liệu. Bắt lỗi lệch giữa các đầu như web hiển thị một kiểu, admin một kiểu, hoặc rule chỉ được chặn ở một nơi. Khác admin-module-audit và admin-audit-all. Soi lỗi, sửa phần có căn cứ, hỏi owner khi cần chốt rule, và ghi finding vào docs/audits."
---

# feature-audit — Audit một tính năng xuyên 3 app

Ví dụ tính năng: đặt hàng, giỏ hàng, tài khoản khách, đánh giá sản phẩm, tìm kiếm, song ngữ, ảnh/media, thông báo đơn mới, phân quyền.

## ⚠️ Chế độ chạy liên tục — KHÔNG dừng giữa chừng để xin duyệt

Một lần gọi = **chạy hết Bước 0→7 trong phiên**. Không dừng sau phần soi lỗi để chờ duyệt rồi mới sửa.

Cách phân loại ngay khi phát hiện mỗi vấn đề:

| Loại | Xử lý |
|---|---|
| **Tự sửa được** — chỉ có một cách đúng theo tài liệu chuẩn, hoặc lỗi hiển nhiên (sai chính tả, mất dấu tiếng Việt, chữ chưa dịch, hiện `null`/`NaN`, thiếu trạng thái lỗi/rỗng, rule đã ghi rõ trong docs mà code làm sai) | **Sửa luôn trong phiên**, ghi finding kèm "Đã sửa" |
| **Cần owner quyết** — hai đầu lệch nhau mà tài liệu không chốt bên nào đúng, đổi rule kinh doanh, đổi tiền/trạng thái đơn, docs ghi `NEEDS_VERIFICATION`/`CONFLICTING_EVIDENCE` | **Hỏi ngay bằng bảng chọn phương án**, nhận trả lời, **áp dụng và chạy tiếp trong cùng phiên** |

### Cách hỏi khi vướng (bắt buộc)

Dùng công cụ hỏi-chọn-phương án nếu môi trường có sẵn. Nếu không có, liệt kê 2–4 phương án đánh số ngay trong chat, nêu phương án đề xuất, rồi chỉ tạm dừng phần phụ thuộc quyết định đó.

- **Gom câu hỏi**: đừng hỏi lắt nhắt từng cái. Gom tới khi có 2–4 câu rồi hỏi một lần, hoặc hỏi ngay nếu phần còn lại phụ thuộc vào câu đó.
- Mỗi câu **2–4 phương án cụ thể**, phương án đề xuất để đầu và ghi rõ "(Đề xuất)". Mỗi phương án phải nói **hậu quả kinh doanh**, không nói kỹ thuật. Ví dụ: "Chốt theo web: khách thấy đúng như đang thấy, nhân viên phải quen tên trạng thái mới" / "Chốt theo admin: nhân viên giữ nguyên thói quen, khách sẽ thấy chữ khác đi".
- Trả lời xong: **áp dụng ngay**, ghi rule mới vào tài liệu chuẩn, rồi **chạy tiếp** — không hỏi lại "có tiếp không?".
- Owner chọn "để sau" → lúc đó mới gác vào danh sách cuối phiên và đi tiếp.

Chỉ dừng hẳn khi xong, hoặc khi user bảo dừng.

## Bước 0 — Định vị tính năng, xác nhận nó còn sống

1. Mở `docs/business/MODULE_CATALOG.md` — tìm tính năng trong 2 bảng (Public Platform Modules / Admin Platform Modules). Lấy 2 thứ: cột **Surface** (chạy trên app nào) và cột **Status**.
   - `REMOVED` → **DỪNG NGAY**, báo user tính năng đã được owner gỡ, không audit, không "khôi phục".
   - `NEEDS_VERIFICATION` / `CONFLICTING_EVIDENCE` → hỏi bằng bảng chọn phương án, nhận trả lời rồi chạy tiếp.
2. Không tìm thấy tên tính năng → đừng đoán. Hỏi user tính năng đó gồm những màn nào, hoặc đề xuất 2-3 mục gần đúng trong catalog để chọn.
3. Chốt **phạm vi bằng lời của người kinh doanh** trước khi đọc code, ví dụ: "Đặt hàng = từ lúc bấm Thêm vào giỏ trên web → điền thông tin → đặt đơn → đơn hiện trong admin → đổi trạng thái → khách tra cứu đơn". Đọc lại cho user xác nhận nếu phạm vi rộng.

## Bước 1 — Đọc tài liệu chuẩn (docs thắng code)

| Đọc | Lấy gì |
|---|---|
| `docs/business/BUSINESS_RULES.md` | Dùng `rg` tìm tiền tố rule của tính năng (`ORDER_RULE_`, `PAY_RULE_`, `SHIP_RULE_`, `REVIEW_RULE_`…) — chép ra **mã rule + nội dung**, sẽ đối chiếu từng cái |
| `docs/business/STATE_MACHINES.md` | Trạng thái hợp lệ + chuyển trạng thái nào được phép |
| `docs/business/WORKFLOW_OVERVIEW.md` + `BUSINESS_PROCESS.md` | Luồng nghiệp vụ mong đợi |
| `docs/engineering/API_CONTRACT.md` | Hợp đồng dữ liệu giữa các app |
| `docs/engineering/API_FLOW_MAP.md` | Màn hình nào gọi việc gì — dùng để dựng bản đồ ở Bước 2 |
| `docs/engineering/DATA_CONTRACT.md` | Tên trường, kiểu, bắt buộc/tùy chọn |
| `docs/engineering/PERMISSION_MATRIX.md` + `docs/business/USER_ROLES.md` | Ai được làm gì |

Gặp `NEEDS_VERIFICATION` / `NOT_FOUND_IN_REPO` / `CONFLICTING_EVIDENCE` ở đúng chỗ cần → **không bịa rule**; hỏi bằng bảng chọn phương án rồi chạy tiếp (gom chung với các câu hỏi khác nếu chưa cần gấp).

## Bước 2 — Dựng bản đồ 3 đầu

| Đầu | Tìm ở đâu |
|---|---|
| **Web (khách thấy)** | `bigbike-web/app/<route>/` — route tiếng Việt là chính (`gio-hang`, `dat-hang`, `don-hang`, `san-pham`, `danh-muc-san-pham`, `tin-tuc`, `tai-khoan`, `tim-kiem`, `dang-nhap`…). Kèm component trong `bigbike-web/components/` và lớp gọi dữ liệu `lib/api/public-api.ts` |
| **Admin (nhân viên thấy)** | `bigbike-admin/src/screens/` + mảng `NAV` trong `src/App.jsx` (có permission key thật) |
| **Máy chủ** | `bigbike-backend` — controller đặt tên theo đối tượng dùng: `Public*` (ai cũng gọi được), `Customer*` (khách đã đăng nhập), `Admin*` (nhân viên), và một số tên trần (`CartController`, `CheckoutController`, `AuthController`) |
| **Dữ liệu** | Entity + migration `V<số>__*.sql`, và OpenAPI `bigbike-openapi.json` |

In bản đồ này ra cho user **trước khi** đi sâu — nếu bản đồ sai thì mọi finding sau đều sai.

## Bước 3 — 10 phép đối chiếu xuyên app (phần lõi của skill)

Với mỗi mục, so **cả 3 đầu**, ghi rõ đầu nào lệch. Đây là chỗ lỗi thật hay nằm.

1. **Rule có được chặn ở đúng chỗ không.** Mỗi mã rule ở Bước 1: web chặn, admin chặn, hay máy chủ chặn? Rule chỉ chặn ở giao diện mà máy chủ vẫn cho qua = lỗ thật (khách/nhân viên gọi thẳng là lọt). Rule chỉ chặn ở máy chủ mà giao diện không báo trước = trải nghiệm tệ, mức nhẹ hơn.
2. **Từ ngữ trạng thái có khớp không.** Cùng một trạng thái mà web gọi kiểu này, admin gọi kiểu khác, DB lưu kiểu thứ ba → nhân viên và khách hiểu lệch nhau. Đây là dạng lỗi đã có tiền lệ trong `docs/audits/FINDING_2026-07-21_PAYMENT_RECORD_STATUS_VOCABULARY.md` — luôn kiểm.
3. **Chuyển trạng thái.** Admin cho bấm những nút nào? Có nút nào máy chủ từ chối không? Có chuyển trạng thái nào máy chủ cho phép mà admin không có nút (tính năng chết) không?
4. **Tên và kiểu trường.** Cùng một thông tin, web đọc trường `a`, admin đọc trường `b`, máy chủ trả trường `c`. Kiểm cả trường được phép trống và cách hiển thị khi trống.
5. **Song ngữ.** Nội dung tiếng Anh có thật sự tách riêng không, hay đang trả về tiếng Việt? Trường nào bắt buộc dịch, trường nào rơi về tiếng Việt? Admin có chỗ nhập bản tiếng Anh không? Giao diện admin phải qua `src/locales/vi.json` + `en.json`; web qua next-intl.
6. **Quyền.** Permission key ở `NAV` admin, ở `requirePermission` phía máy chủ, và ở `PERMISSION_MATRIX.md` — ba chỗ phải trùng. Kiểm cả trường hợp chỉ có quyền đọc.
7. **Tiền và số.** Định dạng tiền VND, làm tròn, cộng tổng: web và admin có ra cùng con số không? Khoảng thời gian và múi giờ của báo cáo?
8. **Ảnh/media.** Mọi ảnh do admin quản lý phải nằm trong kho ảnh nội bộ MinIO (`/media/...`), không trỏ link ngoài. Video chỉ chấp nhận YouTube/TikTok/Facebook, chặn link rút gọn. Trang tĩnh đóng cứng trong code thì dùng ảnh trong repo — ngoại lệ hợp lệ.
9. **Lỗi và trạng thái rỗng.** Khi máy chủ trả lỗi (403/404/409/mất mạng), web hiện gì, admin hiện gì? Có chỗ nào hiện `null`/`undefined`/`NaN`/`[object Object]` không? Có chỗ nào im lặng nuốt lỗi không?
10. **Cập nhật thời gian thực.** Cái gì đẩy tức thời (WebSocket, ví dụ đơn mới về admin), cái gì hỏi lại theo chu kỳ (web hỏi lại mỗi 15 giây), cái gì phải bấm mới mới thấy? Chỗ nào khách/nhân viên nhìn thấy số liệu cũ mà không biết là cũ?

## Bước 4 — Đi thử một kịch bản thật từ đầu tới cuối

Chọn **một** kịch bản tiêu biểu của tính năng và bám theo nó qua cả 3 đầu (đọc code, không đoán): khách bấm gì → máy chủ nhận gì → lưu gì → admin thấy gì → khách tra cứu lại thấy gì.

Luồng quan trọng (tiền, trạng thái đơn, quyền) thì dựng hẳn kịch bản kiểm thử đầu-cuối theo skill `e2e` thay vì chỉ đọc code.

Nếu hệ thống Docker đang chạy thì kiểm chứng bằng dữ liệu thật:
- `docker ps` trước để xác nhận stack sống. Container cần dùng chưa chạy → **không tự bật/tắt/restart**; báo 1 dòng "hệ thống chưa chạy, phần kiểm chứng dữ liệu thật ghi `Not run`" rồi **chạy tiếp phần soi code tĩnh**. Không dừng phiên vì chuyện này.
- Trong container chỉ **đọc** (xem log, câu lệnh xem dữ liệu). Muốn ghi/sửa/xóa → hỏi user trước.
- Chụp màn hình admin bằng skill `run-bigbike-admin`; web thì mở route thật.
- Không bịa dữ liệu mẫu khi dữ liệu thật đang truy vấn được.

## Bước 5 — Ghi finding (không sửa hàng loạt)

Mỗi vấn đề = một finding. **Trước khi ghi, tra `docs/audits/` xem đã có mã `AUD-xxx` chưa** — trùng thì trích lại mã cũ, không đẻ mã mới, không tự sửa (owner đang giữ danh sách đó).

Mức độ dùng đúng thang có sẵn của repo:

| Mức | Nghĩa vận hành |
|---|---|
| **Blocker** | Lộ dữ liệu khách, chiếm quyền, mất tiền |
| **High** | Sai đơn/giá/tồn kho, gãy luồng bán hàng hoặc đăng nhập, rủi ro bảo mật đáng kể |
| **Medium** | Sai trạng thái/dữ liệu, song ngữ/SEO sai, rule và tài liệu mâu thuẫn |
| **Low** | Chữ nghĩa, encoding, code thừa, nợ cấu hình |

Báo cáo ghi ra `docs/audits/FEATURE_<TEN_TINH_NANG>_<YYYY-MM-DD>.md` (`docs/` nằm trong git, commit cùng thay đổi code), mỗi finding gồm:

```markdown
### F<n> — <mô tả ngắn bằng ngôn ngữ kinh doanh>
- **Mức độ:** High
- **Lệch ở đâu:** web hiện A / admin hiện B / máy chủ lưu C
- **Bằng chứng:** <đường dẫn file:dòng> × 3 đầu
- **Rule liên quan:** <mã rule + docs path>, hoặc "docs chưa có rule"
- **Hậu quả vận hành:** <chuyện gì xảy ra với đơn hàng/khách/nhân viên>
- **Cần owner quyết:** chốt theo đầu nào? (hoặc: không cần quyết, sửa được ngay)
```

## Bước 6 — Sửa ngay trong phiên

Sửa theo mức độ, nặng trước nhẹ sau. Món nào cần owner chốt thì **hỏi bằng bảng chọn phương án ngay tại chỗ** (xem phần Chế độ chạy liên tục ở đầu), nhận trả lời rồi sửa luôn — không để dồn tới cuối phiên.

Thứ tự sửa cho mỗi finding:

1. Tài liệu trước (`BUSINESS_RULES.md` / `STATE_MACHINES.md` / `API_CONTRACT.md` / `DATA_CONTRACT.md` / `PERMISSION_MATRIX.md`), rồi OpenAPI.
2. Máy chủ + test máy chủ.
3. Web và/hoặc admin (admin thì theo skill `admin-module-audit`).
4. `hygiene` → `preflight`.

Sửa tới đâu tick tới đó trong file báo cáo, ghi `Đã sửa` / `Owner hoãn` / `Không phải lỗi`.

## Bước 7 — Báo cáo cuối phiên

Trình một lần: đã sửa gì, owner đã chốt gì trong phiên, còn treo gì (kèm lý do), kết quả các bước kiểm tra (`Not run: <lý do>` nếu không chạy được), và đường dẫn file báo cáo finding.

## Quy tắc tuyệt đối

- ❌ Không audit tính năng `MODULE_CATALOG.md` ghi `REMOVED`.
- ❌ Không tự sửa lỗi đã mang mã `AUD-xxx` trong `docs/audits/`.
- ❌ Không tự quyết "chốt theo web hay theo admin" — đó là quyết định kinh doanh. **Hỏi bằng bảng chọn phương án rồi chạy tiếp**, không tự quyết mà cũng không dừng phiên.
- ❌ Không tự bật/tắt/restart Docker; trong container mặc định chỉ đọc.
- ❌ Không ghi một kiểm tra là đạt nếu chưa thật sự chạy — ghi `Not run: <lý do>`.
- ❌ Không tự commit/push nếu user không yêu cầu; khi commit thì `docs/` đi **cùng** thay đổi code, không tách rời.
