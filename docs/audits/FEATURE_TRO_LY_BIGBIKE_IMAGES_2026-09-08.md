# Trợ lý BigBike — bàn giao sửa luồng ảnh, 08/09/2026

## Summary

Khắc phục việc bỏ mất hãng/loại hàng sau nhận diện; kết quả đọc ảnh bị cắt được thử lại trước khi báo lỗi; khách gửi được ba ảnh cùng lượt và hỏi tiếp theo những gì đã nhận ra. Có hạn mức ảnh chỉnh trong quản trị, số đã dùng/còn lại, tiếp nhận biên lai qua chuông và công cụ chuyển ảnh catalog về MinIO.

Căn cứ chuẩn: [BUSINESS_RULES.md](../business/BUSINESS_RULES.md) `CHAT_RULE_057–059`, `CHAT_RULE_066–069`; [API_CONTRACT.md](../engineering/API_CONTRACT.md) phần Trợ lý BigBike và thông báo quản trị; [DATA_CONTRACT.md](../engineering/DATA_CONTRACT.md) “Image reliability and receipts”; [PERMISSION_MATRIX.md](../engineering/PERMISSION_MATRIX.md) phần thông báo biên lai.

Mốc vận hành do owner cung cấp và lựa chọn đã chốt được lưu trong [hướng dẫn vận hành](../engineering/IMAGE_ASSISTANT_OPERATIONS.md). VPS đang chứa dữ liệu thật. Không đọc ảnh/hội thoại khách để làm fixture, không chạy AI thật. Owner đã bổ sung yêu cầu triển khai bằng Compose với `.env.vps` rồi đưa toàn bộ thay đổi lên GitHub; bản mới đã triển khai, kết quả ghi dưới đây. Không chuyển kho/reindex dữ liệu sản phẩm trong đợt này.

## Hành vi và bằng chứng

| Việc khách/nhân viên cần | Kết quả bản sửa | Cách kiểm |
|---|---|---|
| Gửi logo hãng đang bán | Tách hãng khỏi bằng chứng mẫu; tra catalog đầy đủ, thẻ chỉ thuộc hãng đã nhận ra. Logo shop/nền tảng không dùng làm hãng sản xuất. | `ChatImageServiceTest`: ba Caberg, giá theo mốc owner; `ChatToolServiceTest`: phạm vi hãng/nhóm; `AiChatFunctionCallingTest`: bằng chứng ảnh tới phần trả lời chữ. |
| Gửi logo hãng không bán | Nói rõ chưa kinh doanh, mời xem lựa chọn khác; không trộn mẫu bán chạy của hãng khác. Phân biệt với có hãng nhưng hết hàng/chưa có loại đang hỏi. | `ChatImageServiceTest`, kiểm phạm vi trong `ChatToolService`. |
| Nhận ra loại hàng, chưa rõ mẫu | Gợi ý các mẫu còn hàng cùng loại, giữ ngưỡng đối chiếu mẫu và cách nói “trông giống”. | `ChatImageServiceTest`, `ChatProductImageFingerprintServiceTest`. |
| Kết quả đọc ảnh bị cắt hoặc trục trặc | Kiểm toàn bộ cấu trúc, chỉ dùng kết quả đầy đủ; thử lại cùng model trong thời gian/lượt gọi chung. Lỗi kỹ thuật có trạng thái/câu trả lời riêng. | `ChatImageAnalysisClientTest`: payload cắt, thiếu ảnh/trường, phần suy nghĩ, chặn an toàn, giới hạn số lần thử; `ChatImageServiceTest`: đọc lại kho ảnh, dùng lại kết quả đã lưu. |
| Gửi nhiều góc chụp | Tối đa 3 ảnh/lượt, 9 ảnh/hội thoại, 8 MB/ảnh; giữ thứ tự ở web, backend và quản trị. Ảnh mâu thuẫn thì cho chọn ảnh. | `FloatingChat.test.tsx`, `adminApi.chat.test.js`, `ChatImageServiceTest`, `ChatImageQuotaPostgresTest`: nhiều ảnh gắn cùng tin và chỉ mục vị trí; Playwright kiểm chọn/gỡ ảnh và giới hạn ở 375/768/1440, Việt–Anh. |
| Hết hoặc còn ít lượt ảnh | Chỉ đọc phần còn đủ theo thứ tự gửi, nói rõ ảnh chưa đọc; gửi lại không giữ thêm lượt. Hết lượt vẫn có đường tư vấn bằng chữ. | `ChatImageQuotaPostgresTest`: giữ lượt đồng thời, không vượt trần, đổi hạn mức không xóa bộ đếm; `ChatImageServiceTest`: hết/đọc một phần. |
| Hỏi tiếp “Tìm sản phẩm phù hợp” | Giữ loại hàng từ ảnh, không quay về toàn bộ nhóm; phạm vi mới rõ ràng thay phạm vi cũ. | `ChatToolServiceTest`: lưu/đọc lại ngữ cảnh và chọn ảnh; `ChatImageChainedTurnTest`: một tin trả lời ghép, retry và fallback. |
| Chỉnh hạn mức trong quản trị | Setting khởi điểm 60; phạm vi 0–10.000, 0 dừng cấp lượt mới; hiển thị đã dùng/còn lại theo ngày Việt Nam, tải lại sau khi lưu. | `ChatAssistantSettingsTest`, `ChatAvailabilityTest`, `SettingTabPanel.test.jsx`, `SettingsScreen.test.jsx`, `adminApi.chat.test.js`. |
| Gửi biên lai | Chỉ báo đã chuyển khi đã lưu thông báo; chuông dẫn đúng tin. Không xác nhận đã nhận tiền, không gắn/sửa đơn. Tham chiếu biên lai không lưu vào localStorage. | `ChatImageServiceTest`, `ChatImageQuotaPostgresTest`, `AdminNotificationScopeTest`, `AdminNotificationPostgresQueryTest`, `NotificationBell.test.jsx`, `ChatConversationDetailScreen.test.jsx` (chọn thông báo khác trong cùng hội thoại). |
| Giữ quyền riêng tư | Chỉ chủ hội thoại/`chat.read` được xem ảnh; `settings.read` chỉ xem tổng hợp. Giữ kho riêng tư và hạn xóa 90 ngày; xóa tin xóa thông báo tham chiếu. | Kiểm thử quyền/sở hữu và xóa ảnh hiện có; FK/cascade thử trên PostgreSQL riêng. Không giữ chữ chứng từ trong `analysis_json`. |
| Ảnh người / hàng hỏng | Tiếp tục hướng dẫn đo thực tế / liên hệ shop, không đoán số đo hoặc kết luận bảo hành. Câu Việt–Anh gọn hơn. | `ChatImageServiceTest` hai ngôn ngữ, `ChatImageChainedTurnTest`. |
| Chuyển ảnh catalog, quay lui | Công cụ chỉ owner chạy; manifest riêng tư ngoài Git, nhập qua media API hiện có, ghi có điều kiện, chạy tiếp và quay lui giữ chỉnh sửa mới. CLI dựng chỉ mục không bật Spring/Gemini. | `test_migrate_product_images.py`: 7 ca, gồm resume sau lỗi làm mới và xung đột rollback; thuật toán dấu vân tay dùng chung với service và được kiểm bằng test. |

Đây là kiểm thử tự động trên catalog/ảnh giả và cơ sở dữ liệu thử riêng. Không dùng kết quả test để công bố tỷ lệ nhận diện, lưu lượng hay chi phí thật.

## Files changed

- Backend: dịch vụ ảnh/đọc ảnh, hạn mức, ngữ cảnh hội thoại, truyền bằng chứng sang phần chữ, thống kê và thông báo; migration mới `V1082__chat_image_reliability_and_receipts.sql`; CLI `CatalogImageReindexCommand`.
- Web: `FloatingChat.tsx`, bộ đọc/lưu tham chiếu ảnh, Chính sách bảo mật, chữ Việt–Anh và kiểm thử.
- Admin: chuông thông báo, hội thoại chứa nhiều ảnh, phần cài đặt hạn mức/sử dụng, bộ đọc phản hồi, chữ Việt–Anh và kiểm thử. Dùng lại `DetailSection`, `Button`, màn Cài đặt và Hội thoại hiện có.
- Vận hành: `scripts/ops/migrate-product-images.py`, `scripts/ops/test_migrate_product_images.py`, các tên biến công cụ trong `.env.example` và `.env.vps.example`. Không sửa `.env` hoặc `.env.vps`.
- Tài liệu nghiệp vụ: `BUSINESS_RULES.md`, `ACCEPTANCE_CRITERIA.md`, `WORKFLOW_OVERVIEW.md`, `STATE_MACHINES.md`, `USER_ROLES.md`, `MODULE_CATALOG.md`.
- Tài liệu kỹ thuật: `API_CONTRACT.md`, `DATA_CONTRACT.md`, `PERMISSION_MATRIX.md`, `API_FLOW_MAP.md`, `INTEGRATION_GUIDE.md`, `DEPLOYMENT_GUIDE.md`, `TESTING_GUIDE.md`, `TRACEABILITY_MATRIX.md`, `IMAGE_ASSISTANT_OPERATIONS.md`; bản OpenAPI đi cùng contract.

Thư mục làm việc đã có thay đổi khác trước khi bắt đầu. Bản sửa này giữ nguyên chúng; thay đổi video nhúng, các audit khác, Dockerfile/nginx và phần sửa video có sẵn không được nhận là công việc của lần bàn giao ảnh.

## Checks

Các cổng mã nguồn đã hoàn tất. Triển khai/kiểm giao diện sau triển khai được ghi riêng, không tính là kiểm chất lượng AI thật. Lệnh thử đều không lấy cấu hình cơ sở dữ liệu vận hành từ `.env`; kiểm thử tích hợp dùng PostgreSQL Testcontainers riêng.

| Cổng kiểm tra | Kết quả |
|---|---|
| Web lint + định dạng các tệp sửa | PASS |
| Web toàn bộ test | PASS — 104 tệp, 687 ca; sau sửa câu chữ chọn ảnh/video chạy lại 38 ca FloatingChat, đạt |
| Web build | PASS — 75 trang; TypeScript đạt |
| Admin lint / i18n / định dạng | PASS — lần cuối có đủ Prettier/i18n/ESLint; 3.831 khóa mỗi ngôn ngữ |
| Admin toàn bộ test | PASS — 120 tệp, 1.148 ca; sau sửa đường mở biên lai chạy lại 3 tệp liên quan, 22 ca đạt |
| Admin build | PASS |
| Backend clean verify / package | PASS — 1.755 ca, 0 lỗi/thất bại, 1 skip có sẵn; JAR đóng gói thành công. Sau sửa ánh xạ SMALLINT, chạy lại 57 ca ảnh/OpenAPI: đạt, gồm validate schema và đọc/ghi entity PostgreSQL. Lệnh cách ly H2 và giới hạn RAM ở TESTING_GUIDE.md. |
| Python công cụ chuyển ảnh | PASS — 7 ca |
| Hygiene / git diff --check | PASS cho mã/tài liệu sửa; không thêm CSS/vỡ UTF-8. Patch bằng chứng có sẵn `gateway-applied.patch` giữ nguyên dấu cách ở dòng ngữ cảnh trống, nên loại đúng tệp này khi kiểm toàn bộ phần stage; không sửa bằng chứng lịch sử. |
| Hook trước commit của dự án | PASS — chạy `sh bigbike-admin/.husky/pre-commit`, lint-staged định dạng/ESLint các tệp đã stage. `core.hooksPath` cũ trỏ tới thư mục không còn nên gọi trực tiếp hook đúng của repo; khi commit dùng đường dẫn hook tạm riêng cho lệnh đó, vẫn chạy hook dự án, không đổi cấu hình Git lâu dài. |
| npm audit mức high | FAIL ở phụ thuộc có sẵn: web 9 high, 2 moderate; admin 1 high, 31 moderate. Không sửa dependency/lockfile trong phạm vi ảnh. |
| Tên artifact bí mật được theo dõi | PASS — không có `.env`/keystore/service-account mới được theo dõi |
| Gitleaks | PASS — quét snapshot ban đầu và toàn bộ phần stage cuối (249 tệp, diff 3,21 MB), không phát hiện secret. Công cụ tạm ngoài repo, đã đối chiếu checksum bản phát hành chính thức. |
| Trình duyệt trên bản đã triển khai | PASS — 2 ca VI/EN, mỗi ca ở 375/768/1440; chọn 3 ảnh, từ chối ảnh thứ tư, gỡ ảnh và mở lại nút chọn; không tràn ngang/lỗi trang/hydration. Chỉ giả lập bước tạo phiên trong trình duyệt, không tạo hội thoại, tải ảnh lên hay gửi câu hỏi thật. |
| Console toàn website | Còn cảnh báo CSP chặn beacon Cloudflare đã có trong audit trước. Test giữ riêng đúng cảnh báo này, không nới CSP và không tuyên bố toàn website sạch console. |
| Dịch vụ sau triển khai | PASS — Compose kết thúc mã 0, sáu dịch vụ khỏe, ba ứng dụng chạy đúng image vừa dựng; các dịch vụ dữ liệu không bị tạo lại; trang VI/EN, quản trị và health trả HTTP 200. |
| Migration/cấu hình thật | PASS — V1082 thành công; 3 ảnh/lượt, 9/hội thoại, 60/ngày ở cả VI/EN. Bộ đếm ảnh giữ nguyên 8; setting chữ giữ nguyên 400 như trước triển khai. Setting ảnh không xuất hiện trong API settings công khai. |
| Gửi ảnh/biên lai và nhận trả lời bằng AI thật | Not run: giữ hạn mức dùng chung và không dùng ảnh/hội thoại thật của khách để thử |
| Chuyển 91 sản phẩm / dựng chỉ mục thật | Not run: owner tự chạy sau bàn giao |

## Kiểm tra triển khai

Lần nạp đầu phát hiện lỗi khởi động: entity dùng JDBC INTEGER cho `attachment_position` trong khi V1082 khai báo SMALLINT. Đã khôi phục ba ứng dụng bằng các image trước triển khai; website trả HTTP 200 trở lại, cơ sở dữ liệu và ảnh khách giữ nguyên. Không sửa checksum hoặc hoàn tác migration đã áp dụng.

Đã bổ sung kiểm thử dựng Hibernate SessionFactory với `validate` và đọc/ghi ảnh trên PostgreSQL thử riêng. Kiểm thử này tái hiện đúng lỗi trước khi sửa; entity được ánh xạ JDBC SMALLINT theo DATA_CONTRACT. Nhóm 57 ca ảnh/OpenAPI chạy lại đạt; kiểm thử PostgreSQL dùng đủ phần schema ảnh V1061 → V1062 → V1082 để khớp cấu trúc vận hành. Lần triển khai cuối chạy thành công:

```bash
docker compose --env-file .env.vps --parallel 1 up -d --build --wait --wait-timeout 240
```

Kiểm lúc 23:04 ngày 08/09/2026 (giờ Việt Nam): backend/web/admin và PostgreSQL/Redis/MinIO đều khỏe; ba ứng dụng dùng image vừa dựng, không có lần khởi động lại; ba dịch vụ dữ liệu giữ container và mức RAM cũ. Dùng `docker ps`, `docker inspect`, `SELECT` trong `bigbike-postgres` qua `docker exec -i ... psql` (transaction READ ONLY), và GET qua `curl` để kiểm. Chỉ đọc trạng thái, schema và bộ đếm tổng hợp.

Bằng chứng: [kiểm triển khai](evidence/assistant-images-2026-09-08/verification.json), [kết quả test](evidence/assistant-images-2026-09-08/test-summary.json), [kiểm trình duyệt](evidence/assistant-images-2026-09-08/browser-composer.json), [ảnh điện thoại Việt](evidence/assistant-images-2026-09-08/images-vi-375.png), [ảnh điện thoại Anh](evidence/assistant-images-2026-09-08/images-en-375.png), [ảnh máy tính](evidence/assistant-images-2026-09-08/images-vi-1440.png). Ảnh xem trước là fixture công khai của bộ test, không phải ảnh khách.

Cảnh báo Cloudflare đã được ghi ở [báo cáo triển khai trước](DEPLOY_TRO_LY_BIGBIKE_VIDEO_2026-09-08.md); không xử lý ngoài phạm vi ảnh. Nhật ký triển khai và thông tin quay lui giữ ngoài Git tại `/root/bigbike-image-release-20260908/`; image cũ có tag `bigbike-{backend,web,admin}:before-images-20260908`. Khi cần quay lui ứng dụng, dùng override image đã lưu, giữ schema V1082 và không xóa dữ liệu.

## Notes / thao tác owner

1. Bản sửa đã triển khai và V1082 đã áp dụng. Không cần chạy lại migration hoặc Compose để sử dụng. Toàn bộ thay đổi trong thư mục được đưa lên GitHub theo yêu cầu bổ sung của owner.
2. Mở **Cài đặt → Trợ lý BigBike**, kiểm tra hạn mức ảnh 60 và số đã dùng/còn lại. Không đổi hạn mức chữ hiện có. Bản ghi cấu hình trước triển khai là 400; số 120 trong dữ kiện owner cung cấp vẫn được giữ nguyên như mốc quan sát riêng, không dùng để ghi đè cấu hình VPS. Sau bảy ngày xem số dùng và hóa đơn nhà cung cấp để điều chỉnh.
3. Người có `chat.read` kiểm chuông biên lai và đường dẫn tin nhắn; xác nhận thanh toán vẫn làm ở Đơn hàng sau đối chiếu ngân hàng, theo quyền hiện có.
4. Chạy công cụ theo [IMAGE_ASSISTANT_OPERATIONS.md](../engineering/IMAGE_ASSISTANT_OPERATIONS.md): kiểm trước → dry-run → apply → verify → reindex → verify sau. Có lệnh resume và rollback; cần `media.write`, `products.update` và kết nối DB của đúng môi trường.
5. Giữ báo cáo trước/sau trên VPS ngoài Git; kiểm các trang sản phẩm đã tác động. Chỉ dùng ảnh công khai do shop quản lý để thử các ca thực sau triển khai, với số lượt AI tối thiểu cần thiết.

Không cam kết trước số ảnh đối chiếu được sau chuyển kho. Công cụ báo những mục còn thiếu/không đọc được để owner xử lý; không hạ ngưỡng nhận diện nhằm ép đủ số.
