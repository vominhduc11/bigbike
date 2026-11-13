# Đối chiếu phiếu GMC đợt 2 — 09/11/2026

## Phạm vi và nguyên tắc

Đối chiếu trước khi sửa source; kiểm lần này trên VPS và HTTPS `bigbike.vn`. Không vào tài khoản Merchant/Cloudflare; số duyệt và 52 mã lỗi trong phiếu là thông tin shop cung cấp, chưa kiểm độc lập. Không thay dữ liệu, cấu hình chạy, khởi động/restart hay triển khai dịch vụ. Không đụng phần shop tự làm. Workspace đã có nhiều thay đổi từ trước, gồm feed, API client, ProductView và tài liệu; giữ các thay đổi đó.

Quy trình: `.agents/skills/feature-audit/SKILL.md`; tính năng còn sống tại `docs/business/MODULE_CATALOG.md` dòng Google Merchant. Luồng: admin ProductDetail/Media → backend catalog/MinIO → web merchant/feed và trang product → Google. Căn cứ `GMC_RULE_001`–`006`, `MEDIA_RULE_006`/`008`, API_CONTRACT §Google Merchant product feed, DATA_CONTRACT §Google Merchant feed projection. Không giả định có export WordPress.

## Bảng đối chiếu trước sửa

| Việc / yêu cầu / tiêu chí | Tình trạng | Bằng chứng | Cần làm / shop quyết định |
|---|---|---|---|
| 1a. Xác nhận gián đoạn 07–08/11 và nguyên nhân | Có bằng chứng gián đoạn; chưa xác nhận quan hệ với 52 SKU hoặc nguyên nhân duy nhất | Nginx trên VPS: ngày 07 có 1.488 phản hồi 503, ngày 08 có 68; 26 và 42 lượt đường dẫn chứa `/product/` lỗi. Error log hai ngày có 1.099 timeout, 95 lỗi kết nối, 596 đóng kết nối sớm. Web log có 1.504 NoFallbackError; inspect restart count 2. | Phân biệt deploy/restart, render lỗi và tải máy chủ; cần Cloudflare và thời điểm Google quét 52 SKU để liên kết. Không coi mọi 503 là deploy. |
| 1b. Deploy không downtime hoặc khung 02–04h | Còn thiếu | Compose một web container/port 3000; Nginx một upstream. DEPLOYMENT_GUIDE ghi các lần `up --no-deps` thay container, chưa có rolling. Có trang bảo trì 503, không phải zero downtime. | Ghi khung vận hành 02–04h, chuẩn bị kiểm trước/sau; không áp dụng lên hệ thống đang chạy. |
| 1c. Theo dõi 3 URL mỗi phút; cảnh báo tới dev và anh Trí; thử gửi thành công | Chưa đủ / còn thiếu | `scripts/check-google-merchant.py` chỉ kiểm XML và in JSON. Không thấy lịch GMC trong crontab/timer đã kiểm. Không có quyền xem tài khoản dịch vụ giám sát ngoài. | Chuẩn bị công cụ/cấu hình; cần dịch vụ ngoài VPS, nhóm nhận và cấu hình bí mật riêng. Chưa gửi thử thì chưa đạt. |
| 1d. Trang sản phẩm có cache khi backend lỗi | Có fetch cache 3.600s; chưa có fallback giới hạn tuổi và khóa mua đã chứng minh | `public-api.ts:getProductBySlug`, page product chuyển `notFound` khi không có data; PurchaseSection dùng giá ban đầu nếu snapshot lỗi. Feed thực tế trả 503, **không có fallback như phiếu nhận định** (GMC_RULE_005). | Shop đã chốt: bản lưu tối đa 1 giờ, khóa mua khi chưa kiểm tra lại giá/Còn–Hết. Cần sửa docs trước mã và test lỗi/404/hết hạn. |
| 2a. Quét ảnh nhỏ/thumbnail, tìm đúng gốc; báo mã không có gốc | Còn thiếu, có sửa một phần từ 31/10 | feed.ts thay cover <500 bằng gallery riêng cùng biến thể ≥500. BK088 có ảnh nội bộ 1.500×631 theo metadata, chưa đạt hai cạnh 800. Không tìm thấy thư mục ảnh gốc qua tìm tên trên filesystem đã kiểm. | Đo bytes ảnh HTTPS, rà media/catalog hiện tại; không bỏ hậu tố URL để đoán gốc, không coi tên file chứng minh đúng ảnh. Thay dữ liệu chạy cần duyệt cụ thể. |
| 2b. Ảnh feed lớn nhất, ≥800×800, không thumbnail | Còn thiếu | Cách chọn hiện tại dùng ảnh đầu tiên ≥500, không ảnh lớn nhất; giữ thumbnail nếu không có thay thế. | Shop chốt giữ SKU và báo ảnh thiếu trong lúc bổ sung; ưu tiên ảnh lớn nhất của đúng biến thể, không phóng to. Không cam kết tất cả đạt 800 khi nguồn chưa có. |
| 2c. PNG >1MB → JPG/WebP <500KB, xử lý FF808 | Còn thiếu; nhận định 1,8MB khiến Google không xử lý chưa được chứng minh | ImageCompressionService chỉ giảm ảnh khi rộng >2.000, giữ PNG; FF808 1.254²/1.792.652 bytes trong media. Google hỗ trợ PNG và giới hạn 16MB. | Shop chốt giữ alpha; chỉ chuyển PNG không trong suốt sang JPG. Không sửa object cũ; chuẩn bị file mới/đề xuất riêng, cần duyệt ghi dữ liệu. |
| 3a. Đề xuất map 27 danh mục; shop duyệt trước; mọi SKU có GPC | Khác phiếu: hiện có 30 danh mục; 0/1.184 có GPC | GET categories trả 30. URL taxonomy vi-VN trong phiếu trả 404; bản Google en-US truy cập được. | Gửi bảng đề xuất đủ 30, nhóm hỗn hợp phải chọn theo sản phẩm; **chưa áp dụng khi shop chưa duyệt**. |
| 3b. GTIN nếu có; mặc định identifier_exists=no nếu chưa có trường | Không có trường nhập/lưu; yêu cầu mặc định mâu thuẫn rule và đặc tả Google | DB information_schema, DTO/admin không có gtin/barcode/mpn; GMC_RULE_003 cấm suy diễn. Google chỉ cho `no` khi đã xác nhận không có định danh. | Shop chốt giữ rule hiện hành; lập danh sách xác minh, chưa tự khai no/yes hay lấy SKU làm GTIN/MPN. |
| 3c. Bổ sung 9 brand, fallback BIGBIKE | Khác phiếu: thiếu 7, không phải 9 | XML: ALTL-MAO/5FDUAL/QUAN và D30VT-COMBO3/LUNG/TAY/VAI. AL-RIDGE và DAKOTA không nằm trong danh sách thiếu. | Shop xác nhận thương hiệu thật của hai nhóm; không tự gán BIGBIKE, kể cả tên có D3O. |
| 3d. Chuẩn hóa title toàn HOA | Còn thiếu | 3 tên cha toàn HOA: ALTL, QL-HBM, TTSLA; ALTL sinh 3 dòng, tổng 5 SKU có tên cha cần sửa. | Chỉ chuẩn hóa khi tên cha toàn HOA, giữ thương hiệu/mã model có căn cứ, không sửa tên biến thể hoặc dữ liệu admin. |
| 4a. 720 link wp-var đổi var_ theo ID hiện tại | Nhận định không đúng dữ liệu | Đối chiếu catalog từng SKU: **0 ID sai**; 720 wp-var và 381 var_ đều đúng primary key hiện hành. DB tổng 859 wp-var/421 var_; SKU biến thể 1.280/1.280 duy nhất. V158/V176 xác nhận giỏ/đơn tham chiếu primary key chuỗi này. | Không có bản đồ old→new. Không đổi prefix/tạo ID giả. Cần thiết kế chuyển định danh và toàn bộ liên kết hoặc owner chốt giữ ID ổn định. |
| 4b. 301 old→new ≥6 tháng | Chưa có đích mới để redirect | ProductVariantEntity chỉ có id, không có alias ID; feed dùng thẳng variant.id. | Chỉ làm khi có ánh xạ được kiểm chứng; hạn 6 tháng tính từ ngày chuyển thực tế. |
| 4c. Kiểm đủ 1.184 link mới 200 không redirect | Chưa có link mới; đang kiểm toàn bộ link hiện hữu | GET từng URL HTTPS, không follow redirect. | Báo kết quả riêng, không gọi đây là nghiệm thu sau chuyển ID. |

## Quyết định shop trong phiên

- Cache sản phẩm tối đa 1 giờ; khóa mua khi chưa xác minh giá/Còn–Hết.
- Giữ GMC_RULE_003 về định danh; xác minh dữ liệu nhà sản xuất trước.
- Giữ SKU thiếu ảnh 800; ưu tiên ảnh đúng lớn nhất, lập danh sách bổ sung.
- Giữ nền trong suốt; chỉ PNG không trong suốt được chuyển JPG.
- Cảnh báo: shop chọn Telegram, chỉ chuẩn bị hướng dẫn/cấu hình mẫu. Đã xác minh bot đang có sẵn cho đơn mới/sao lưu, runtime backend có cả token và chat ID; không in hoặc sao chép secret. Có thể dùng lại bot; còn xác nhận nhóm nhận và runner ngoài VPS. Chưa gửi thật.

## Kết quả sau sửa / kiểm tra

### Sự cố cần ưu tiên

Web bị lỗi hết bộ nhớ JavaScript (không phải bằng chứng kernel OOM) tại:

- **08/11 09:59:03 GMT+7** — log UTC `2026-11-08T02:59:03.905910814Z`; trùng phút Nginx ghi 48 phản hồi 503.
- **09/11 02:13:01 GMT+7** — log UTC `2026-11-08T19:13:01.310132720Z`.
- **09/11 21:32:07 GMT+7** — phát sinh trong phiên audit; web tự khởi động lại, restart count từ 2 lên 3, container vẫn được tạo ngày 07/11. Agent không restart/triển khai. Sau đó Docker báo unhealthy, năm healthcheck liên tiếp timeout 5s; GET trang chủ HTTPS timeout 20s và trực tiếp `127.0.0.1:3000` timeout 15s. Feed trả 200 trong lần probe cùng lúc.

Bằng chứng [web-heap-errors.json](evidence/gmc-round2-2026-11-09/web-heap-errors.json), [uptime-probe.json](evidence/gmc-round2-2026-11-09/uptime-probe.json), [access-summary.json](evidence/gmc-round2-2026-11-09/access-summary.json). Runtime: Next 16.2.10, container giới hạn 512MiB, Node heap limit 259MiB, không NODE_OPTIONS. Chưa xác định nguồn giữ bộ nhớ hoặc mức dung lượng cần thiết; **không tự tăng bộ nhớ hoặc khẳng định đã sửa hết nguyên nhân**. Cần kiểm tải/bộ nhớ trong phiên vận hành được phép, xử lý web unhealthy rồi kiểm lại. Không có log Cloudflare/giờ fetch của 52 SKU để quy từng mã cho từng sự cố; UA Google trong access log chưa được xác minh IP.

Đã dừng chính tiến trình kiểm link của audit khi thấy web unhealthy để không tăng tải. Nginx quan sát được phản hồi cho 820/1.184 URL, 723 có 200; không chứng minh client nhận đủ HTML hoặc Cloudflare không lỗi. **Chưa đạt kiểm toàn bộ link**. [Kết quả từng URL, bao gồm phần chưa kiểm](evidence/gmc-round2-2026-11-09/link-check-partial.json). Không có URL mới sau chuyển ID vì chưa có ánh xạ thật.

### Sửa tại source, chưa triển khai

- Theo GMC_RULE_007: page product đọc mới có timeout 5s, snapshot công khai theo slug/locale, lưu tối đa 1h và không kéo dài tuổi khi fallback. 404/410 xóa bản lưu; mọi 4xx không fallback; webhook products/product xóa snapshot. Lỗi không có snapshot hợp lệ đưa vào trạng thái lỗi, không biến thành “sản phẩm không tồn tại”. Cache mỗi container có thể mất khi deploy. Khu mua khóa trên trang fallback cho tới khi snapshot giá/Còn–Hết sau mount thành công, khóa lại nếu kiểm lỗi. Feed không dùng cache này.
- Theo GMC_RULE_008: chọn ảnh lớn nhất trong phạm vi đúng biến thể; ưu tiên bản không thumbnail có hai cạnh ≥800. Không lấy màu khác, không loại SKU thiếu ảnh. Bỏ thumbnail bổ sung khi đã có ảnh chính gốc đủ ngưỡng. Chưa chứng minh mọi ảnh đạt 800 hoặc đúng nội dung chỉ từ metadata.
- Theo GMC_RULE_009: tên cha toàn HOA được viết hoa chữ đầu trong feed; giữ thương hiệu đã lưu và token model chữ/số, không sửa admin/biến thể. Chưa thêm taxonomy, GTIN/MPN, identifier_exists hoặc brand giả.
- Upload thư viện admin: PNG opaque >1MB được thử chuyển JPEG <500KB, giữ metadata/MIME/đuôi file/checksum đúng bytes. Giữ ảnh có pixel trong suốt; không sửa avatar/review, không ghi đè object cũ. **FF808 thử bằng đúng service đã biên dịch: 1.792.652 → 160.714 bytes, 1.254×1.254, JPEG**, không có transparency. Chưa upload hoặc đổi ảnh trong dữ liệu chạy. [Kết quả thử](evidence/gmc-round2-2026-11-09/ff808-optimization-dry-run.json).
- Chuẩn bị probe ba URL và [hướng dẫn/cấu hình Telegram](../../deploy/monitoring/README-GMC.md), dùng lại bot hiện có. Probe chỉ đọc, không tự cài lịch/gửi tin. Chưa có runner ngoài VPS/tin thử, chưa nghiệm thu cảnh báo.

Đối chiếu source mới với catalog thật đọc trong phiên: **1.184 → 1.184 SKU, không thêm/mất; 123 ảnh chính và 5 tên thay đổi; giá/Còn–Hết/brand/link không đổi**. Catalog và XML được đọc ở hai thời điểm, không phải snapshot giao dịch duy nhất. [So sánh](evidence/gmc-round2-2026-11-09/feed-source-comparison.json), [ảnh đề xuất](evidence/gmc-round2-2026-11-09/proposed-feed-image-changes.json). Đây là dự báo từ source, không phải feed đã triển khai.

### Ảnh và dữ liệu cần shop

- Đo trực tiếp **347 URL ảnh chính**, đọc được kích thước 298, chưa đủ bằng chứng cho 49 URL (timeout/HTTP lỗi/không đọc đủ bytes); không gọi mọi lỗi này là ảnh hỏng. [Từng ảnh](evidence/gmc-round2-2026-11-09/feed-image-checks.json). Có **276 SKU cần rà soát**: 116 có cạnh dưới 800 trong lần đo, 6 thêm tên resize với ảnh không dưới 800, 154 chưa đo được. [Danh sách từng mã](evidence/gmc-round2-2026-11-09/feed-images-needing-review.csv).
- **BK088 đen 10 mã đã dùng ảnh 1.500×631**, nhận định 50×21 trong phiếu đã cũ cho nhóm này; vẫn chưa đạt hai cạnh 800. **10 mã BK088-XAM2 lại dùng file ghi màu đen 50×21**; không dùng ảnh đen lớn thay cho màu xám. CABERG-A-DO-L vẫn 50×50. OF610/OF616, OF626, GK257, GRT729 còn ảnh nhỏ như bảng phiếu. FF808 PNG 1,8MB tải được, không đủ căn cứ nói dung lượng đó tự nó khiến Google không xử lý: Google hỗ trợ PNG và giới hạn 16MB.
- Script chỉ đọc `scripts/audits/audit-gmc-images.py` quét ảnh đại diện, gallery và ảnh trong HTML/khối nội dung của **214 sản phẩm công khai cùng mọi biến thể**, đối chiếu registry media hiện tại. [Bảng ứng viên và mã chưa có gốc xác minh](evidence/gmc-round2-2026-11-09/catalog-image-candidates.csv): 1.969 dòng đề xuất/kiểm tra, có thể nhiều dòng cho cùng ảnh; 1.725 dòng chưa biết kích thước, 244 dòng là thumbnail hoặc dưới 500, trong đó có dòng có nhiều ứng viên. Tên trùng sau bỏ hậu tố chỉ là ứng viên, **không chứng minh cùng sản phẩm/màu**. Không tìm lại export WordPress, không sửa URL hash bằng cách đoán. Chưa có cặp ảnh thay dữ liệu chạy được duyệt; danh sách không tìm gốc là “chưa có gốc được xác minh trong nguồn đã kiểm”, không phải chứng minh gốc đã mất vĩnh viễn.
- Shop duyệt [bảng 30 danh mục](GMC_CATEGORY_MAPPING_PROPOSAL_2026-11-09.md), đặc biệt nhóm hỗn hợp. Chưa áp mapping.
- Shop xác nhận thương hiệu thật cho **ALTL-MAO, ALTL-5FDUAL, ALTL-QUAN, D30VT-COMBO3, D30VT-LUNG, D30VT-TAY, D30VT-VAI**. Không tự gán BIGBIKE/D3O chỉ từ tên. AL-RIDGE/DAKOTA không nằm trong danh sách thiếu; không sửa chúng.
- [Danh sách 1.184 SKU cần xác minh GTIN/MPN](evidence/gmc-round2-2026-11-09/identifier-review.csv). Đó là thiếu thông tin quản lý, không chứng minh hàng không có định danh. Shop đã chốt giữ rule; cần nguồn nhà sản xuất và quyết định đường nhập/lưu trước khi thêm data shape.

### Kiểm tra và giới hạn

- Web: 46/46 tests (10 tệp) gồm feed/XML/route/catalog/local feed, snapshot lỗi/hết hạn/khác locale/404/xóa cache và khóa–mở–khóa lại nút mua. `npx tsc --noEmit` đạt; ESLint trên source thay đổi và guard `check:no-runtime-business-data` đạt. Không thêm CSS; text VI/EN đã kiểm UTF-8 và dấu.
- Backend: `ImageCompressionServiceTest`, `AdminMediaServiceUploadTest`: **13/13**, không lỗi; kiểm opaque/alpha/PNG nhỏ, metadata MIME/đuôi file và object lưu đúng JPEG. Test chỉ dùng mock storage, không ghi MinIO/DB thật.
- Python: **8/8**, gồm probe phát hiện HTML lỗi/redirect/thiếu sản phẩm và script ảnh không tạo URL gốc giả.
- Ranh giới Nginx: `bash deploy/nginx/tests/domain-boundary-config-test.sh --self-test` đạt, không đổi cấu hình Nginx.
- Not run: full build/full suite/E2E sự cố trên production; VPS web đang unhealthy, không dựng thêm tải hoặc tắt backend để thử. Chưa triển khai, chưa thay ảnh/brand/danh mục/ID trong dữ liệu thật; chưa gửi Telegram, chưa vào GMC/Cloudflare, chưa yêu cầu Google fetch. Việc 1 còn thiếu vận hành ổn định và cảnh báo thật; Việc 2 còn ảnh nguồn/đổi dữ liệu; Việc 3 còn duyệt/xác minh; Việc 4 cần quyết định chuyển ID có ánh xạ.

### Lệnh kiểm chứng runtime (chỉ đọc)

- `docker ps`; `docker inspect` chọn Created/StartedAt/RestartCount/Health/Memory của bigbike-web; không xuất env/secret.
- `docker logs --since 2026-11-07T00:00:00+07:00 --timestamps bigbike-web`, lọc mã lỗi/thời gian; Nginx `/var/log/nginx/bigbike.vn-{access,error}.log*` tổng hợp 07–08/11, không lưu IP/người mua.
- `docker exec -i bigbike-postgres ... psql -X -qAt`: SELECT information_schema, products/product_variants, media và flyway_schema_history; migration hiện hành V1094 thành công. Không UPDATE/DELETE/DDL.
- GET backend `127.0.0.1:8080/api/v1/products` và `/products/{slug}?lang=vi`, `/categories`; GET HTTPS feed/ảnh/link. Không có export WordPress cục bộ.

Nguồn ngoài: [Google identifier_exists](https://support.google.com/merchants/answer/6324478?hl=en), [Google image_link](https://support.google.com/merchants/answer/6324350?hl=en), [taxonomy Google en-US](https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt). Không xác nhận Google đã nhận hoặc duyệt lại SKU.


## Triển khai sau khi chủ shop yêu cầu — 09/11/2026

**Phần này thay trạng thái “chưa triển khai” của lượt audit ban đầu ở trên.** Owner yêu cầu chạy Compose với `.env.vps`; đã thực chạy `docker compose --env-file .env.vps up -d --build`, **exit 0**. Giữ tag hoàn tác trước build/nạp; hai env-file không sửa. Web tăng giới hạn bộ nhớ từ 512MiB lên 1GiB theo bằng chứng hết heap; heap thực tế sau nạp 524MiB. Đây là giảm áp lực trước mắt, chưa chứng minh sửa triệt để nguồn giữ bộ nhớ.

- Web và backend đã nạp image mới; admin build đúng image đang chạy nên được giữ nguyên. Cả sáu dịch vụ healthy; Postgres/Redis/MinIO giữ nguyên container/image/thời điểm khởi động. Flyway V1094 thành công, không có migration mới. [Đối chiếu runtime](evidence/gmc-round2-2026-11-09/deployment/runtime-after.json), [image và bản hoàn tác](evidence/gmc-round2-2026-11-09/deployment/rollback-tags.json).
- Trang chủ VI/EN, quản trị, ba kiểu link sản phẩm và hai feed đều HTTPS 200, không redirect. XML và TSV cùng **1.184 SKU**, không lệch ID/giá/Còn–Hết. [Kết quả HTTP](evidence/gmc-round2-2026-11-09/deployment/http-verification.json).
- Feed thật sau nạp: **123 ảnh chính và 5 tên thay đổi**, giữ đủ SKU, không thay giá/Còn–Hết/brand/link. [So sánh trước/sau](evidence/gmc-round2-2026-11-09/deployment/deployed-feed-comparison.json).
- Probe ba URL chạy một lần đạt, lần lượt 0,581s/0,832s/6,006s; đây là kiểm từ VPS qua HTTPS, **không phải giám sát độc lập chạy mỗi phút hoặc Telegram gửi thử**. [Probe](evidence/gmc-round2-2026-11-09/deployment/uptime-probe-after.json). Snapshot dự phòng đã tạo được 4 entry; startup revalidation 200; chưa ghi nhận heap/NoFallbackError trong log sau lần nạp, không gây lỗi backend thật để thử. [Startup](evidence/gmc-round2-2026-11-09/deployment/startup-verification.json).
- Preflight mở rộng: web lint và **800/800** đạt; admin lint đạt, bộ đầy đủ **1.226 đạt/2 timeout**, chạy lại riêng hai file đạt **16/16**. Backend đủ **1.543 bài**, **1 failure cũ, 1 skip, 0 error**; failure `ArticleExcerptAuthorRemovalMigrationPostgresTest:54` với V1091 lồng field nhật ký, đã được ghi nhận từ 13/10, hai file không có diff, không sửa/ẩn trong đợt GMC. Kiểm phần ảnh mới 13/13 đạt. Cả ba Docker build thành công. [Tổng hợp kiểm tra](evidence/gmc-round2-2026-11-09/deployment/preflight-summary.json).

Còn thiếu như đã báo: giám sát/Telegram thật; ảnh nguồn và cập nhật FF808 trong admin; shop duyệt mapping 30 danh mục; thương hiệu thật của 7 SKU và mã nhà sản xuất; quyết định chuyển ID có ánh xạ; kiểm toàn bộ landing URL sau khi vận hành ổn định, và trạng thái Google tiếp nhận/duyệt. Không nhận đã hoàn tất cả bốn việc từ một lần triển khai.

## Tiếp nối 10/11/2026 — trạng thái hiện tại (thay nhận định lịch sử khi có khác)

Owner yêu cầu tiếp tục phần còn lại; đọc cả phần triển khai phía trên trước khi làm. Đã đọc AGENTS.md và áp dụng feature-audit; tính năng Google Merchant vẫn LIVE. Bản đồ kiểm: quản trị Product/Media → backend catalog/MinIO → feed XML/TSV và trang sản phẩm → Google. Không khôi phục nguồn WordPress; không reset/revert, commit/push hoặc sửa `.env`/`.env.vps`. Đối chiếu diff trước/sau để giữ công việc có sẵn. Phần nạp 09/11 đã hoàn thành; phiên tiếp nối **chưa triển khai lại**.

### Các quyết định owner trong phiên

- **Giữ ID thật ổn định**, điều chỉnh tiêu chí phiếu: không đổi prefix `wp-var-*`/`var_*` khi chúng đang đúng. Chưa có đợt chuyển ID, nên chưa phát sinh old→new hoặc hạn redirect sáu tháng. Đã cập nhật `GMC_RULE_004` trước khi chốt tiêu chí nghiệm thu.
- **Chỉ chuẩn bị gói giám sát**, shop sẽ cung cấp nơi chạy ngoài VPS và nhóm Telegram sau. Không kết nối/gửi thử, không đổi nơi nhận chung đơn hàng/sao lưu.
- **Chờ shop duyệt mapping 30 danh mục và thương hiệu thật**; tiếp tục giữ rule xác minh GTIN/MPN. Không tự gán brand hoặc identifier_exists.
- Đã trình kế hoạch cụ thể FF808 trắng và hai ảnh BK088; chưa nhận phê duyệt ghi dữ liệu tại thời điểm lập mục này. Không coi thời gian chờ là đồng ý.

### Bảng xử lý phần còn lại

| Hạng mục | Kết quả phiên tiếp nối | Phần chưa hoàn tất / ranh giới nghiệm thu |
|---|---|---|
| 1a. Độ ổn định / bộ nhớ | Kiểm đúng container đã nạp: healthy, restart count 0 từ 09/11 22:16. Tìm được một nguồn giữ bộ nhớ trong xử lý HTML, đã sửa source theo API giải phóng của thư viện; đo trước/sau và kiểm lọc nội dung. | Chưa nạp bản sửa mới hoặc theo dõi dài hạn sau nạp. Không kết luận tăng RAM đã sửa triệt để, không quy 52 SKU cho ba sự cố. |
| 1b. Giám sát 3 URL / mỗi phút ngoài VPS | Đã chuẩn bị runner, cấu hình ba URL thật, systemd service/timer 60s, trạng thái từng URL, chống lặp và báo khôi phục. Dry-run HTTPS đạt. | **Chỉ xong phần chuẩn bị dev**; chưa có máy/dịch vụ ngoài VPS, lịch thật, nhóm nhận được xác nhận. |
| 1c. Telegram đúng người / tin thử và khôi phục | Kiểm chỉ có/không token/chat ID trên backend hiện tại, không xuất giá trị; có chế độ gửi hai tin THỬ NGHIỆM không làm production lỗi. | Owner chọn chuẩn bị; chưa gửi thật, chưa chứng minh dev và anh Trí nhận tin. |
| 1d. Fallback và khóa mua | Kiểm trên bản sao đúng artifact production, dữ liệu sản phẩm thật, lỗi chỉ ở proxy/browser thử nghiệm. Desktop/mobile khóa trước snapshot, mở sau snapshot thật; desktop khóa lại khi snapshot lỗi. 4xx không fallback, 404/410 xóa bản lưu; hết hạn/chưa có bản lưu + 503 không giả trang thành công. | Không ngắt backend production. Host thử Node 22.22.1 khác Node 20 Alpine production; webhook/network/timeout vẫn dựa unit test, chưa gây lỗi thật trên production. |
| 1e. Cách triển khai | Runbook 02–04h đầy đủ bước trước/sau, tag hoàn tác, health timeout 180s, kiểm HTTPS/feed và người trực. | Một web container + một upstream; chưa có zero downtime. Runbook mới chưa được thực thi. |
| 2a/b. Ảnh thật sau nạp | Đo đủ **348 ảnh chính**, đọc kích thước toàn bộ; **121 SKU dưới ngưỡng hai cạnh 800**, thêm 6 SKU cần rà tên thumbnail, tổng **127 SKU**. Có CSV từng mã và ứng viên từ media/catalog thật. Sửa công cụ audit để không bỏ sót ảnh 500–799. | Chưa tự thay dữ liệu. Bảng ứng viên không đồng nghĩa đúng màu/model; cần kiểm riêng. Không gọi mọi SKU thiếu 800 là không còn gốc. |
| 2c. FF808 | Nguồn trắng vẫn đúng bytes đã thử trước; JPEG chuẩn bị 160.714 bytes, 1.254×1.254, đã xem trước/sau. Lập đúng 5 SKU trắng bị ảnh hưởng. | Chờ duyệt upload object mới và đổi tham chiếu; màu đen/xám vẫn giữ PNG hiện hành. |
| 3a. Taxonomy | Đủ 30 danh mục, 24 hàng có mã số đều khớp nhánh chính thức; sửa đề xuất túi treo xe từ 5540 (phụ kiện máy tính xe đạp) sang 5512 (túi/pannier moto). Có đề xuất thứ tự ưu tiên để duyệt. | Owner chọn chờ; chưa áp mapping, nhóm hỗn hợp cần chốt từng sản phẩm. URL vi-VN vẫn 404, en-US 200. |
| 3b. Brand | Feed hiện vẫn thiếu đúng 7 SKU ALTL-MAO/5FDUAL/QUAN và D30VT-COMBO3/LUNG/TAY/VAI. | Shop xác nhận thương hiệu thật; không sửa AL-RIDGE/DAKOTA hoặc tự gán BIGBIKE/D3O. |
| 3c. Định danh | Vẫn chưa có cột nhập/lưu GTIN/MPN/barcode trên products/product_variants; feed không tự khai gtin/mpn/identifier_exists. | Cần dữ liệu nhà sản xuất và chốt đường nhập/lưu; giữ danh sách xác minh 1.184 SKU, không lấy SKU làm mã định danh. |
| 3d. Tên | Kiểm lại đủ 5 tên feed đã chuẩn hóa; dữ liệu tên trong admin không đổi. | Xong phần dev đã triển khai, không chuẩn hóa lại hàng loạt. |
| 4. ID | Owner đã chốt giữ ID; đối chiếu catalog mới: **0 ID sai**, 720 link wp-var, 381 var_, 83 hàng không query. | Kiểm HTTP toàn bộ link ghi riêng bên dưới; không gọi đây là nghiệm thu chuyển sang ID mới. |

### Bằng chứng mới và việc đã sửa

Tất cả bằng chứng mới nằm trong [continuation-2026-11-10/](evidence/gmc-round2-2026-11-09/continuation-2026-11-10/), không ghi đè bằng chứng trước/sau triển khai 09/11.

- [Feed thật hiện tại](evidence/gmc-round2-2026-11-09/continuation-2026-11-10/feed-current.json): XML/TSV HTTP 200, cùng 1.184 mã, không lệch ID/giá/Còn–Hết; 214 sản phẩm. Đọc hai nguồn ở hai thời điểm, không phải snapshot giao dịch duy nhất.
- [Ảnh từng URL](evidence/gmc-round2-2026-11-09/continuation-2026-11-10/feed-image-checks.json), [CSV 127 SKU](evidence/gmc-round2-2026-11-09/continuation-2026-11-10/shop-image-requests.csv), [bảng cho shop](evidence/gmc-round2-2026-11-09/continuation-2026-11-10/SHOP_IMAGE_REQUESTS.md), [ứng viên catalog/media](evidence/gmc-round2-2026-11-09/continuation-2026-11-10/catalog-image-candidates.csv). Đã đọc 214 sản phẩm công khai và chi tiết thật, gallery biến thể, ảnh trong nội dung; registry 4.960 dòng ảnh ACTIVE (có dòng không có URL). Chưa truy cập kho riêng/nhà sản xuất. Ngưỡng rà công cụ đổi từ 500 sang **800** theo GMC_RULE_008, có kiểm tra ảnh 1.500×631 và ngưỡng đúng 800.
- BK088 xám đã chọn gallery 300×300 trong feed, trong khi ảnh đại diện dữ liệu quản trị còn ghi màu đen 50×21. Tìm được object xám/đen 1.200×1.200 thật và mở xem đúng mẫu/màu; xám hạ xuống 300 để đối chiếu có sai khác JPEG trung bình 1,39/255, không chỉ dựa tên file. [Kế hoạch 20 SKU](evidence/gmc-round2-2026-11-09/continuation-2026-11-10/bk088-candidate-verification.json). Đen hiện dùng 1.500×631; không dùng ảnh đen thay xám.
- CABERG-A-DO-L còn 50×50; OF610 12 SKU đang 400/600 vuông, OF616 1 SKU 400 vuông. OF626 có cả nhóm 1.000 vuông và nhóm 447 vuông; GK257 5 SKU 447 vuông. GRT729 hiện 1.000×1.000, không giữ nhận định ảnh nhỏ trước sửa. [Chi tiết nhóm](evidence/gmc-round2-2026-11-09/continuation-2026-11-10/priority-image-groups.json).
- FF808 ba màu hiện PNG 1.254 vuông, khoảng 1,71–1,94 MB và không trong suốt. Chỉ chuẩn bị thay ảnh trắng đã thử đúng service trước: [kế hoạch](evidence/gmc-round2-2026-11-09/continuation-2026-11-10/ff808-replacement-plan.json), [JPEG xem trước](evidence/gmc-round2-2026-11-09/continuation-2026-11-10/prepared-media/ff808-white-optimized.jpg). Không ghi đè object cũ.
- [Taxonomy kiểm lại](evidence/gmc-round2-2026-11-09/continuation-2026-11-10/taxonomy-verification.json) và [bảng 30 danh mục đã chỉnh để duyệt](GMC_CATEGORY_MAPPING_PROPOSAL_2026-11-09.md). Google vẫn nhận PNG, giới hạn 16MB; nguồn chính thức hiện công bố mốc ảnh 500×500 từ 31/01/2027 và khuyến nghị ảnh lớn hơn. **800×800 là yêu cầu shop**, không kết luận PNG 1,8MB tự nó gây từ chối. [Google image_link](https://support.google.com/merchants/answer/6324350?hl=en).
- [Fallback trình duyệt](evidence/gmc-round2-2026-11-09/continuation-2026-11-10/fallback-browser.json) và ảnh chụp desktop/mobile. Hai lượt đầu lỗi công cụ thử (phát sự kiện focus sai đích, gọi nhầm thuộc tính Fetch response); giữ attempt1/2, sửa harness rồi kiểm phần còn lại. Không biến lỗi harness thành lỗi ứng dụng hoặc che kết quả.
- [Gói giám sát](../../deploy/monitoring/README-GMC.md) có file service/timer/config và `scripts/run-storefront-monitor.py`; archive đã tạo tại `/tmp/bigbike-gmc-monitor.tar.gz`, checksum trong checks.json. Chưa cài, chưa gửi. [Dry-run](evidence/gmc-round2-2026-11-09/continuation-2026-11-10/monitor-dry-run.json), [cấu hình Telegram chỉ báo có/không](evidence/gmc-round2-2026-11-09/continuation-2026-11-10/telegram-readiness.json). Lịch dự kiến kiểm bằng systemd-analyze không thay bằng chứng lịch chạy thật.

Căn cứ canonical: `BUSINESS_RULES.md` GMC_RULE_001–009/MEDIA_RULE_006; API_CONTRACT §Trang sản phẩm dự phòng/Google Merchant product feed; DATA_CONTRACT §Google Merchant feed projection; API_FLOW_MAP §Google Merchant catalog sync; DEPLOYMENT_GUIDE §GMC đợt 2 và phần giới hạn trạng thái xử lý nội dung. Không có thay đổi API/data shape, permission hoặc trạng thái hàng.

### Nguồn giữ bộ nhớ đã tái hiện và sửa source — chưa nạp

`sanitizeRichHtml` dùng window jsdom chung của `isomorphic-dompurify` 3.11.0. Tài liệu thư viện đã cài, mục Memory Management (Server), xác nhận có thể tích lũy trạng thái khi dùng lâu và cung cấp `clearWindow()`; hooks cần gắn lại. Trong source trước phiên này chưa có vòng đời giải phóng. Đã làm mới window sau mỗi 100 lần sanitize không rỗng ở server, đặt lại và đăng ký đầy đủ hooks trước lần kế tiếp. Browser không đổi; không bỏ lọc script/iframe/CSS/link, không nâng thư viện hay mở profiler trên production.

[Đo cùng dữ liệu thật](evidence/gmc-round2-2026-11-09/continuation-2026-11-10/memory-comparison.json): 2.929 chuỗi HTML từ catalog 214 sản phẩm, ba lượt, nhường event loop sau từng lần; thu gom chỉ trong process thử nghiệm. Heap sau thu gom trước sửa **56,35 → 113,19 → 172,74 → 232,89 MiB**; sau sửa **55,98 → 61,86 → 63,37 → 64,04 MiB**. [Hash của 5.858 đầu ra VI/EN trước–sau trùng hoàn toàn](evidence/gmc-round2-2026-11-09/continuation-2026-11-10/html-output-comparison.json). Test mới kiểm nội dung và các chốt lọc qua hơn hai lần reset; cùng bộ HTML cũ đạt 16/16.

Đây là một nguồn tăng bộ nhớ có căn cứ và bản sửa source kiểm chứng được, **không phải bằng chứng là nguyên nhân duy nhất** của ba sự cố 08–09/11 hoặc 52 SKU GMC. Host thử dùng Node 22.22.1; production Node 20 Alpine. Một thử bulk đồng bộ ban đầu hết heap 512MiB, được loại khỏi phép đo có kiểm soát vì không nhường event loop. Giữ các log/profile số liệu; không dùng thử này để quy lỗi production. Chưa triển khai lại, chưa hạ giới hạn 1GiB hoặc tự restart service. Cần owner phê duyệt lần nạp mới, sau đó theo dõi dài hạn.

Lượt đọc log sau bản nạp 09/11 tại 07:34 ngày 10/11: không thấy heap OOM/TypeError/fetch failed, nhưng còn **145 NoFallbackError** ở route legacy `[slug]`. Nginx current access log có 36 phản hồi 503 cho `/_next/image/`, chưa thấy 5xx đường product trong tập log đó; log hiện tại không thay toàn bộ log lịch sử/Cloudflare. Không tự sửa route legacy hay che log trong phạm vi này. Bằng chứng: web-log-summary.json, nginx-summary.json, runtime-before.json và mẫu bộ nhớ trong continuation.

Danh sách yêu cầu shop đã được chia lại sau khi xác minh BK088: trong 121 SKU dưới 800 có **20 SKU đã có ảnh gốc đúng màu được xác minh**, chỉ chờ duyệt chọn lại; **101 SKU còn chưa có gốc phù hợp được xác minh trong nguồn đã kiểm** nằm tại [shop-missing-verified-original.csv](evidence/gmc-round2-2026-11-09/continuation-2026-11-10/shop-missing-verified-original.csv). Sáu SKU còn lại chỉ cần rà hậu tố thumbnail, không mặc định phải chụp/upload mới. 127 là danh sách rà soát feed hiện tại, không phải 127 mã đều cần shop cung cấp file mới.

### Kiểm toàn bộ link đã hoàn tất — 10/11/2026

[link-checks.json](evidence/gmc-round2-2026-11-09/continuation-2026-11-10/link-checks.json): **1.184/1.184 HTTPS GET trả 200, không follow redirect, HTML đủ và có SKU tương ứng trong JSON-LD; 0 lỗi**. Tập link khớp feed thật đầu phiên; đối chiếu catalog toàn bộ cho 0 ID sai. Đây là kiểm đủ link **hiện hành** theo quyết định giữ ID của owner, không phải kiểm link mới sau chuyển ID. Giữ từng SKU/URL/thời gian và các mẫu health; chạy tuần tự, tạm nghỉ 0,6s ban đầu/0,3s sau khi tái sử dụng kết nối, tự dừng nếu unhealthy/restart/bộ nhớ cgroup ≥850MiB hoặc yêu cầu chậm ≥10s.

Đã sửa lỗi phép đo ở lượt tối ưu kết nối: requests raw body còn nén gzip khiến phần kiểm nội dung sai; giữ [attempt gzip](evidence/gmc-round2-2026-11-09/continuation-2026-11-10/link-checks-attempt-gzip.json), chỉ giữ lại 338 kết quả urllib hợp lệ, chạy lại toàn bộ phần còn lại với giải nén đúng. Không coi các lỗi đọc body của công cụ là lỗi website, không dùng chúng nghiệm thu. Lượt cuối đủ 1.184 kết quả hợp lệ và mọi mẫu health đều healthy/restart count 0.

**Việc 4 đã đóng phần dev theo tiêu chí được owner điều chỉnh**: giữ ID thật và kiểm đủ link hiện hành. Điều kiện chuyển ID/301 sáu tháng không áp dụng khi chưa có chuyển ID; nếu tương lai muốn chuyển phải mở thiết kế và phê duyệt riêng.

### Kiểm tra phiên tiếp nối và phần chưa kiểm

- Web lint đạt; bộ đầy đủ **118 tệp / 801 bài đạt**, 0 failure. Trong đó hai tệp HTML có 16 bài kiểm, gồm bài mới về vòng đời window và giữ đủ chốt lọc nội dung.
- Công cụ Python **16/16 đạt**; `py_compile` đạt. Ranh giới Nginx self-test dương và hai kiểm âm đạt. systemd verify exit 0; có warning `RestartMode` từ unit snapd đã cài trên host, không sửa ngoài phạm vi. Calendar dự kiến ba tick cách đúng 60s, **không phải bằng chứng timer đã bật**.
- Build web thử với giới hạn heap compiler 1.024MiB bị OOM/exit 134; đây là process build trên host, không phải web production bị chết. Chạy lại compiler với 2.048MiB và một worker; trạng thái cuối ghi ở checks.json. Không đổi giới hạn 1GiB của web đang chạy hoặc env-file để build.
- Không chạy lại toàn bộ admin/backend vì phiên này không sửa source hai app đó. Giữ nguyên kết quả bàn giao: admin 1.226 đạt/2 timeout, chạy lại riêng 16/16 đạt; backend 1.543 bài/1 failure cũ V1091/1 skip/0 error, ảnh mới 13/13. Không sửa/ẩn failure cũ.
- [HTTP cuối phiên](evidence/gmc-round2-2026-11-09/continuation-2026-11-10/http-final.json): home VI/EN, admin, XML/TSV 200; XML/TSV đều 1.184, không khác ID/giá/Còn–Hết. Các offer không thay đổi từ đầu phiên. [Runtime](evidence/gmc-round2-2026-11-09/continuation-2026-11-10/runtime-after.json): cùng container/image/StartedAt của cả sáu service, healthy, restart count 0. [Bảo toàn workspace](evidence/gmc-round2-2026-11-09/continuation-2026-11-10/workspace-preservation.json): các diff source có sẵn không đổi; hai env-file không đổi, không commit/push.
- `Not run`: giám sát mỗi phút thực sự ngoài VPS; Telegram gửi thật/đúng người; ghi thay ảnh FF808/BK088; nạp bản sửa bộ nhớ mới và theo dõi sau nạp; bật/kiểm rolling deployment; truy cập GMC/Cloudflare hoặc xác minh Google tiếp nhận/duyệt lại 52 mã. Không dùng triển khai 09/11 để đóng các mục này.

### Phụ thuộc và bàn giao tiếp theo

1. Shop/owner: duyệt lần nạp riêng web sửa bộ nhớ; duyệt ghi ảnh FF808 trắng (5 SKU) và chọn ảnh đúng màu BK088 (20 SKU); cung cấp/xác nhận nguồn ảnh cho 101 SKU chưa có gốc phù hợp được xác minh; rà 6 tên thumbnail. Ảnh gốc/object cũ được giữ, không upscale hoặc mượn màu khác.
2. Shop: duyệt bảng 30 danh mục và ưu tiên nhóm hỗn hợp; xác nhận 7 brand thật, dữ liệu GTIN/MPN nhà sản xuất và đường nhập/lưu. Giữ identifier rule đã chọn. Phần ID đã chốt giữ ổn định và kiểm đủ link, không còn chờ quyết định chuyển ID.
3. Dịch vụ ngoài/shop: cung cấp máy/dịch vụ ngoài VPS và nhóm Telegram có dev/anh Trí; operator cài gói, xác nhận cả hai tin thử/khôi phục và bằng chứng lịch mỗi phút đủ ba URL. Chưa có những bằng chứng đó thì cảnh báo chưa nghiệm thu.
4. Google/Cloudflare: cần kết quả fetch/xử lý/duyệt mới, thời điểm quét và log sự kiện thật để liên hệ 52 SKU với sự cố. Không claim Google nhận lại/duyệt hoặc đủ 52 mã phục hồi. Watermark, logo vuông, phí vận chuyển và chính sách đổi trả GMC vẫn do shop phụ trách, không làm thay trong phiên.

**Kết quả build cuối cùng: đạt, exit 0**, với heap compiler 2.048MiB và một worker; biên dịch, TypeScript, 97 trang tĩnh và đóng gói hoàn tất. Chưa build image production hoặc nạp lại container; bản sửa bộ nhớ đã được trình owner chốt lịch/nạp riêng web, không dùng phê duyệt nạp 09/11 cho lần mới. Toàn bộ kiểm tra phiên này được ghi tại [checks.json](evidence/gmc-round2-2026-11-09/continuation-2026-11-10/checks.json). Các warning Sentry/workspace root cũ không được sửa ngoài phạm vi.
