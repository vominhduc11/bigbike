# Tiếp nối kiểm tra hiệu năng BigBike — 13/11/2026

Tiếp nối [báo cáo 12/11](PERFORMANCE_OPTIMIZATION_2026-11-12.md). Đây là kết quả sửa source, kiểm thử và benchmark thành phần; **chưa nghiệm thu hiệu năng toàn hệ thống, chưa triển khai production**. Không dùng số liệu container hiện tại để gọi là After của source mới. Bốn tối ưu đợt trước được giữ nguyên và kiểm tra regression, không ghi thành thành quả mới.

Cập nhật15/11: backend hiện tại đã đạt1588/1588 ở localUTC và hai lượtGitHub;
frontend805/1245 cùng lint/build đã đạt, được reuse khi có proof source không đổi.
Run43677437126 dừng tại hạ tầng. Bản sửa MinIO tại1470d418 đã dựng thành công ba
dịch vụ dữ liệu trong [CI43678807306](https://github.com/vominhduc11/bigbike/actions/runs/43678807306),
nhưng cổng host không mở trên mạng internal. Bản sửa chuyển tiếp TCP đã đạt54/54
kiểm thử công cụ và chuẩn bị chạy lại hệ thống thật.
Chưa có số đo API/browser/media Before/After hệ thống; các số và trạng thái ở những
đoạn theo ngày bên dưới là lịch sử, không thay kết luận hiện tại này.

## 1. Workspace và môi trường

- Đã đọc AGENTS.md, hướng dẫn web, báo cáo và bằng chứng đợt trước. Giữ toàn bộ thay đổi có trước; không reset, checkout đè hoặc stash; main/index giữ nguyên. Ngày 14/11 owner yêu cầu tiếp tục bước công bố snapshot/CI trên nhánh riêng đã nêu. `evidence/performance-2026-11-13/workspace-start.json` ghi HEAD và 2.991 dấu kiểm tệp lúc bắt đầu, không gồm env bí mật/build bị Git bỏ qua.
- `docker ps` xác nhận sáu dịch vụ BigBike đang chạy và healthy. Có ứng dụng khác cùng máy. Kiểm tra lại dung lượng: 92%, còn khoảng 11GiB; không prune/xóa cache, không sửa `.env`.
- Đọc lại danh tính container và lịch sử Flyway: database shop vẫn ở V1094 thành công. V1095 **chưa áp dụng**. Bằng chứng và lệnh đọc: [runtime-state.json](evidence/performance-2026-11-13/runtime-state.json). Không khởi động lại/recreate dịch vụ dùng chung, không ghi database/bucket shop, không chạy load trên VPS.
- PostgreSQL runtime: 267 sản phẩm, 235 ngoài thùng rác, 5 nổi bật; 94 bảng người dùng, 350 index. Đây là số đếm đọc tại thời điểm quan sát, không phải nghiệm thu mọi bảng/index. `pg_stat_statements` hiện đã có; không giữ lại sự không chắc chắn của báo cáo cũ.

## 2. Phân công, kiểm kê và phạm vi chứng minh

| Vai trò | Kết quả | Giới hạn |
|---|---|---|
| Backend/API/migration | Sửa chuỗi migration bài viết, bỏ phụ thuộc seed ngoài ở ca catalog; diễn tập schema trống; kiểm kê controller/tác vụ nền | Không coi danh sách annotation là endpoint đã đo |
| Database/catalog | Đo và tối ưu sắp tên; chứng minh SQL/ICU khác thứ tự hiện tại; phát hiện/sửa race làm mới cache; đọc thêm các đường query rủi ro | Chưa đo tải DB/API; chưa xử lý hết đường materialize |
| Website/Admin/media | Kiểm kê route/màn; kiểm thử tập trung; profile và giảm giải mã ảnh lặp; kiểm tra SEO/tracking/feed bằng unit và source | Không có CWV/INP/Lighthouse mới từ candidate chạy thật |
| Lead infrastructure/benchmark | Đã publish nhánhCI riêng; regression chạy từ xa; sửa fixture, cache collector, điều kiệnjob và nguồn MinIO theo bằng chứng | Lần dựng stack đầu dừng; chưa có đo hệ thống thành công |
| QA độc lập | Database agent rà media/migration/CI/dataset; backend agent rà cấu hình/lifecycle; frontend agent rà browser | QA của công cụ CI là source review và test helper, không thay lần chạy stack thật |

Kiểm kê từ code hiện tại, có trạng thái riêng từng mục:

- [backend-inventory.json](evidence/performance-2026-11-13/backend-inventory.json): 53 controller gồm HealthController, 212 annotation HTTP, 20 khai báo Scheduled/Async; đây là cách đếm rộng hơn 52/211 của báo cáo trước, không khẳng định có endpoint mới.
- [frontend-media-inventory.json](evidence/performance-2026-11-13/frontend-media-inventory.json): 49 tệp page/route/metadata web, 32 màn và 32 case routing admin, 13 thành phần media/dùng chung. Ghi rõ inventory, source review chọn lọc, unit, runtime, đo, sửa/xác minh lại.
- [infrastructure-inventory.json](evidence/performance-2026-11-13/infrastructure-inventory.json): từng phần host, proxy, cache, pool, DB, Redis, MinIO, app runtime và CI; phân biệt syntax/source/read-only snapshot với thực đo.
- [database-inventory.json](evidence/performance-2026-11-13/database-inventory.json): 144 thành phần truy cập dữ liệu/dịch vụ, tên 94 bảng; không đánh dấu mọi query đã kiểm. [database-additional-source-review.json](evidence/performance-2026-11-13/database-additional-source-review.json) bổ sung 14 đường xử lý rủi ro.
- Báo cáo từng agent: [backend](evidence/performance-2026-11-13/backend-agent.md), [database](evidence/performance-2026-11-13/database-agent.md), [frontend/media](evidence/performance-2026-11-13/frontend-media-agent.md).

**Không gộp “đã đọc source”, “unit đạt”, “đã chạy chức năng thật” và “đã đo” thành cùng trạng thái.** Những luồng runtime còn thiếu phụ thuộc candidate stack CI chưa được chạy. Những thành phần chỉ kiểm kê vẫn ghi chưa source-audit toàn diện, không lấy vài trang hay full unit để suy rộng.

## 3. Vấn đề đã sửa và căn cứ

### 3.1 Migration bài viết thất bại

V1091 đã áp dụng chỉ trừ khóa JSON ngoài cùng; kiểm thử yêu cầu gỡ trường cũ cả trong translations/items. Canonical `BUSINESS_RULES.md` ARTICLE_RULE_001/007/010/011 và `API_CONTRACT.md` phần Audit Log yêu cầu bài viết không còn excerpt/tác giả, kể cả snapshot. Không có căn cứ để làm yếu assertion hoặc sửa migration lịch sử.

Bổ sung forward `V1095__clean_nested_retired_article_audit_fields.sql`; giữ nguyên V1091. Sửa ca kiểm thử để chạy chuỗi V1091 + V1095 và giữ assertion. Chỉ dòng `resource_type=CONTENT` với tiền tố action chính xác `CONTENT_ARTICLE_`; gỡ đúng bốn khóa ở mọi object/array, giữ thứ tự mảng, scalar, null, chuỗi văn bản và module khác. Không ghi lại JSON không đổi, tránh khóa/WAL thừa. JSON lỗi hoặc không biểu diễn được bằng JSONB (escaped NUL, numeric overflow) giữ nguyên và cần operator đánh giá riêng.

QA độc lập phát hiện hai lỗi cast JSONB ngoài 22P02; đã thêm bắt đúng 22P05/22003 trong phần parse và fixture kiểm không đổi bytes/xmin. Không che lỗi logic bằng catch toàn bộ. Có kiểm idempotence, rollback transaction và phạm vi dữ liệu. Ca từng bị bỏ qua `PublicReadApiTest.shouldReturnCategoryAndBrandDetailBySlug` được bật lại bằng category/brand tổng hợp tách biệt, kiểm thêm ID/tên.

Tài liệu đi trước code: `DATA_CONTRACT.md` mục Article bilingual content; `API_CONTRACT.md` Audit Log; `DEPLOYMENT_GUIDE.md` mục forward V1095. Runbook backup riêng/rollback có so sánh giá trị hiện tại: [article-audit-repair-runbook.md](evidence/performance-2026-11-13/article-audit-repair-runbook.md). Chưa có backup thật hay migration thật trong phiên. Hoàn tác image không phục hồi nội dung audit đã dọn.

### 3.2 Sắp tên sản phẩm Admin

Giữ bộ lọc, tìm kiếm, quyền, trạng thái, tổng kết quả và tie-break ID. Cache `CollationKey` theo từng tên trong một lượt sort, dùng clone Collator riêng cho request. Không dùng cache tồn tại lâu hoặc SQL thay thế tùy tiện. Unit đối chiếu ASC/DESC, toàn bộ trang, chữ hoa/thường/NFD, tiếng Anh, homepage totals và request đồng thời.

`en_US.utf8` và ICU `vi-VN-x-icu` hiện có đều khác Java Collator SECONDARY ở một số thứ tự tiếng Việt/case/NFD/ID; bằng chứng [database-collation-probe.json](evidence/performance-2026-11-13/database-collation-probe.json). Vì vậy **tải toàn bộ kết quả rồi phân trang trong bộ nhớ vẫn còn**, không tuyên bố giải quyết phân trang quy mô lớn. Chưa thêm index/schema/collation.

Rủi ro: thêm map sống trong một lượt sort, O(số tên khác nhau); giảm cấp phát cộng dồn không chứng minh peak heap. Hoàn tác riêng nhánh comparator/import mới, giữ mọi thay đổi khác. Canonical `API_CONTRACT.md` admin product sort/filter và `DATA_CONTRACT.md` catalog không đổi.

### 3.3 Giải mã ảnh lặp khi tạo biến thể

Profile xác nhận cùng ảnh bị decode một lần để đọc metadata rồi thêm một lần mỗi kích thước 300/800/1600. Dùng overload nhận ảnh đã decode trong cùng request, không đổi concurrency/upload nền/kiến trúc. Giữ encode, MIME, alpha, kích thước, fallback ảnh gốc và xử lý lỗi từng biến thể. Không sửa object cũ.

Đối chiếu byte đầu ra, kích thước và alpha trên JPEG, PNG opaque/alpha, WebP; kiểm nguồn không bị mutate. Căn cứ `BUSINESS_RULES.md` MEDIA_RULE_006/008, `INTEGRATION_GUIDE.md` mục media. Giữ nguyên thay đổi nén PNG có trước và tối ưu không PUT biến thể trùng của 12/11. Hoàn tác hai thay đổi nhỏ về overload/call-site bằng snapshot hash-bound, không thay cả file về HEAD vì file nén đã dirty từ trước.

### 3.4 Cache danh sách có thể tái lưu dữ liệu cũ

Một loader bắt đầu trước commit có thể hoàn tất sau invalidate và đưa snapshot cũ trở lại trong 60 giây; làm mới web lúc đó có thể giữ danh sách cũ lâu hơn. Căn cứ `INTEGRATION_GUIDE.md` Web Revalidation: xóa snapshot sau commit, trước revalidate web.

Bổ sung generation và khóa nhỏ cho bước publish/invalidate nguyên tử, loader chậm vẫn ở ngoài khóa. Không đổi TTL, key locale, quyền, giá hay trạng thái. Bốn ca kiểm có latch tái hiện lịch chạy lỗi. Harness độc lập của Lead dùng đúng source cũ và mới với cùng lịch chạy: Before tái lưu snapshot cũ, After không tái lưu; [cache-race-control.json](evidence/performance-2026-11-13/cache-race-control.json). Nhóm auth/cache/eviction 32/32 đạt; không có đo latency cho sửa này. Đây là sửa tính đúng, không có tuyên bố giảm latency. Giữ sửa này giống nhau ở cả hai nhánh A/B.

### 3.5 Dữ liệu thử số điện thoại không ổn định

Lượt đầy đủ đầu phát hiện `Phase1DCustomerAuthTest.login_withPhone_succeeds`: `09` nối số ngẫu nhiên không padding có thể chỉ có 9 chữ số (~10%). Đăng ký bị từ chối đúng CUSTOMER_RULE_012. Chỉ sửa fixture `%08d` theo Locale.ROOT, giữ assertion đăng ký/đăng nhập; không nới quy tắc số điện thoại. [auth-fixture-correction.json](evidence/performance-2026-11-13/auth-fixture-correction.json).

### 3.6 Nhánh kiểm mật khẩu giả bị bỏ qua tính toán

Nhật ký regression cho thấy `PasswordService.dummyVerify` dùng chuỗi PHC lỗi
Base64, khiến thư viện dừng ở parse và ghi WARN thay vì thực hiện Argon2. Căn cứ
`PERMISSION_MATRIX.md` phần Admin Login Security / Enumeration stance yêu cầu
phản hồi chung và dummy verify cho tài khoản không tìm thấy/chưa có mật khẩu.
Đây là sai khác có bằng chứng với contract, không phải lý do giữ đăng nhập lỗi
nhanh để làm đẹp latency.

Bản sửa source tạo hash giả hợp lệ một lần bằng chính encoder hiện hữu, dùng
lại khi kiểm; không thay tham số encoder, hash đã lưu, hỗ trợ WordPress hoặc
rate limit. Giữ bốn bài hash ban đầu; thêm kiểm hợp lệ/đúng tham số/không cảnh báo
parse/không encode lại mỗi request, tránh assertion timing dễ dao động. Đây là
sửa tính đúng và bảo vệ đăng nhập; chưa có cam kết timing mạng bằng nhau giữa
mọi loại hash legacy. Giữ sửa này giống nhau trong hai nhánh A/B.

## 4. Before/After — chỉ số đã thực đo

Các số dưới là median của năm mẫu sau warm-up trong benchmark thành phần, chạy lần lượt, không phải P95 API hay thời gian khách upload.

| Thành phần, dữ liệu tổng hợp | Before | After | Phạm vi |
|---|---:|---:|---|
| Sắp tên 267 dòng | 10,688ms | 4,201ms | Java sort; không gồm DB/hydration/API |
| Sắp tên 10.000 dòng | 939,392ms | 145,650ms | Thứ tự bằng nhau ASC/DESC |
| JPEG 2000×1200, bộ biến thể | 799,100ms | 425,000ms | Decode 4→1; byte đầu ra bằng nhau |
| PNG opaque 2000×1200 | 1.366,055ms | 1.051,569ms | Cấp phát cộng dồn ~145→74MB |
| PNG alpha 2000×1200 | 2.952,934ms | 2.469,284ms | Alpha/kích thước/bytes giữ nguyên |
| WebP rộng (fixture 1700×8) | 104,757ms | 27,068ms | Fixture đặc biệt; không đại diện ảnh thông thường |
| WebP alpha nhỏ, không tạo biến thể | 5,211ms | 6,956ms | Không giảm decode; không ghi là cải thiện |
| P50/P95/P99 API, throughput tải | Chưa đo mới | Chưa đo | Cần stack CI candidate |
| TTFB/LCP/CLS/Lighthouse/INP | Chưa đo mới | Chưa đo | Không tái dùng số container cũ làm After |
| Upload/download/Range thực tế | Chưa đo mới | Chưa đo | Chỉ có profile CPU thành phần và test dịch vụ |

Số cấp phát là tổng cấp phát trong thread, **không phải RAM cực đại hoặc RAM server giảm tương ứng**. Dữ liệu media đồng nhất source hash, JVM17/heap256MiB/warm-up/số mẫu. [admin-name-sort-component.json](evidence/performance-2026-11-13/admin-name-sort-component.json), [media-profile-comparison.json](evidence/performance-2026-11-13/media-profile-comparison.json), cùng raw sanitized sample JSON trong thư mục bằng chứng.

## 5. Môi trường CI và phép đo đã chuẩn bị

Workflow `performance-validation.yml` có regression trước, rồi stack thật Before/After tuần tự. Ngày 14/11 owner yêu cầu tiếp tục bước GitHub/CI đã nêu. Push nhánh `ci/performance-validation-*` riêng chỉ tự chạy khi repo public, bằng ubuntu-24.04 tiêu chuẩn miễn phí theo tài liệu GitHub; bỏ cache/artifact, không đổi thiết lập chi tiêu. Manual private vẫn cần xác nhận hạn mức. Chưa có kết quả remote tại thời điểm chuẩn bị snapshot.

- PostgreSQL16, Redis7.4, MinIO cùng tag root Compose, backend Java17, website production build và Admin/nginx thật. Mạng Docker internal chặn outbound; loopback port riêng; không dùng root `.env`, volume, bucket hay account shop. Auth, CSRF, permission, ingress và rate limit vẫn bật. Credentials tích hợp thật không có, browser chặn host ngoài. Không giả API trong ứng dụng.
- Schema trống dùng canonical migrations cùng đúng hai fixture tổng hợp V26_5/V1028_5 có sẵn trong test, không migration-dev hoặc dump WordPress. Diễn tập PostgreSQL đã chạy đủ 457 migration và validate; không đồng nghĩa cả ứng dụng đã startup trong stack CI.
- Cả hai bản giữ bốn tối ưu 12/11, mọi thay đổi có trước, sửa cache/migration và sửa fixture. Chỉ ba file của **hai tối ưu mới** khác nhau; Before ảnh dùng bản chụp dirty-source thật, không Git HEAD. Manifest cũ giữ làm lịch sử, không ghi đè mất bằng chứng.
- Fixture catalog/hero/nổi bật được tạo qua API thật, `E2E_PERF_`. Snapshot riêng toàn bộ database CI tổng hợp + object/MIME/biến thể được phục hồi trước backend nhánh hai. Giữ cùng ID/thời điểm/dữ liệu/tệp; private dump và token không được upload. Reset riêng JVM/Redis provisioner của job trước đo để hai nhánh có cùng trạng thái đầu; không reset giới hạn trong phép đo.
- API bắt đầu concurrency1→2→4, hai lượt, warm-up3s/mẫu12s, pace tối đa2 req/s/worker; tìm kiếm <1req/s tổng để giữ giới hạn60/phút. Tách P50/P95/P99 thành công, mọi status/429/timeout, throughput thành công. Dừng khi lỗi/OOM/restart/RAM≥85%/host available<512MiB. Ghi Docker CPU/RAM, DB connection/active wait/lock, counter SQL và Hikari. Counter DB bao gồm collector/background, **chưa phải số query/request chính xác**. Số mẫu thấp không chứng minh capacity.
- Trình duyệt mobile375/desktop1440: home/category/PDP/search/cart/content/login, tìm kiếm, thêm giỏ, điền/đặt đơn thật, Admin authenticated; kiểm response dữ liệu và screen thực, không nhận HTTP200 của shell làm thành công. Dùng thêm bộ smoke Admin/fixture đăng nhập/chất lượng UI hiện có, một worker, không retry. Chưa bao phủ mọi CRUD/bulk/report/variant/role trong browser.
- Lighthouse12.8.2 cố định, chạy tuần tự mobile/desktop, ba lượt home/PDP, cùng settings. Event Timing ghi tương tác lab riêng; không gọi render-count hoặc TBT là INP người dùng thật. Không gọi lần điều hướng đầu là server cold cache.
- JPEG, PNG opaque/alpha, WebP, MP4 hợp lệ; ảnh320/1600/2400, PNG lớn, hai upload đồng thời trong giới hạn2/account; download đúng stored original, metadata/alpha, quyền và Range video. Ghi thời gian request chung, **không suy riêng thời gian truyền/server/lưu trữ**. UI retry/progress, timeout giữa chừng/fault injection và playback đầy đủ còn thiếu.
- Build web lab dùng Node22/glibc khớp native module của hosted build, xử lý cả standalone lồng thư mục; khác shipping Node20/Alpine, nên chưa đại diện hoàn toàn production/CDN/TLS. Chốt ảnh hero/PDP tải được trước nhận điểm; không chấm cao nhờ trang trống/ảnh hỏng.
- Kết quả chỉ allowlist JSON đã làm sạch, nén và giới hạn dung lượng trong job log; không upload artifact/cache; không XML môi trường, log app, traces, storage/cookies, raw Lighthouse, dataset dump hoặc env bí mật. Bộ helper có kiểm từ chối chạy local/sharedhost và input sai. So sánh từ chối hai nhánh chưa hoàn tất, workload/repeat khác hoặc có lỗi.

## 6. Kiểm thử và QA

Kết quả cuối đã có sau tích hợp; giữ cả bằng chứng các lượt trước:

- Website đầy đủ: **119 tệp, 805/805 đạt**, 0 fail/skip/todo.
- Admin đầy đủ: **130 tệp, 1.245/1.245 đạt**, 0 fail/skip/todo. Một lượt Admin khởi chạy sớm bị Lead dừng sau vài giây; không tính kết quả lượt đó. Kết quả trên là lượt tuần tự riêng hoàn tất.
- Backend đầy đủ cuối: **206 suite, 1.580/1.580 đạt**, 0 failure/error/skip; `./mvnw -B verify -DforkCount=1` exit0, gồm cả bản sửa dummy password. [backend-full-summary.json](evidence/performance-2026-11-13/backend-full-summary.json). Lượt trước sửa dummy cũng đạt1.576/1.576 và được giữ riêng, không thay kết quả cuối.
- Backend đầy đủ lượt đầu: **1.572 ca, 1.571 đạt, 1 fail, 0 skip/error**; lỗi fixture phone ở trên. Giữ [backend-full-initial-summary.json](evidence/performance-2026-11-13/backend-full-initial-summary.json), không che thành xanh. Các ca V1095 JSONB/rollback, migration cũ, catalog và media đều đạt trong lượt này.
- Backend sạch tập trung đầu:26/26; sort5/5; media26/26. Không cộng các nhóm trùng để gọi là số ca duy nhất.
- Tooling helper **38/38 Python + 4/4 Node**; parser YAML, Node syntax, cấu hình Compose và kiểm Git diff. Actual stack/pg_restore+MinIO/Lighthouse/load **chưa chạy**, helper test dùng mock ở ranh giới công cụ không đưa mock vào ứng dụng.
- QA nguồn độc lập: [ci-independent-review.json](evidence/performance-2026-11-13/ci-independent-review.json), [independent-database-qa.json](evidence/performance-2026-11-13/independent-database-qa.json), [independent-frozen-dataset-qa.json](evidence/performance-2026-11-13/independent-frozen-dataset-qa.json), [frontend-media-ci-qa.md](evidence/performance-2026-11-13/frontend-media-ci-qa.md). Những finding được sửa source không được gọi là đã chạy runtime.

## 7. Luồng kinh doanh, SEO, tracking và bảo mật

Unit/source đã đối chiếu giá/lựa chọn/availability, catalog, cart/checkout, session/auth, media original fallback, canonical/noindex/sitemap/robots, Merchant/local inventory, eventID/dedup/privacy. Full unit không chứng minh toàn bộ luồng trên candidate đang triển khai. Bộ CI chuẩn bị kiểm cart/order và số tiền thật, profile hai khách/no-store, không cho khách vào Admin, CRUD API chọn lọc, browser checkout/Admin, media và source identity.

Chưa có bằng chứng mới cho mọi tổ hợp khuyến mãi/biến thể/ngừng bán, mọi quyền nhân viên, CRUD/bulk/import/export/report lớn, tất cả trang/tất cả ngôn ngữ, Merchant acceptance ngoài Google, tracking delivery thực, phát MP4 giữa chừng, cache private hai tài khoản trên hạ tầng CDN, tác vụ nền tải dài hoặc lỗi external integration. Tracking thật bị chặn có chủ đích trong CI; chỉ kiểm cơ chế cục bộ bằng test phù hợp.

## 8. Bottleneck còn tồn tại và giới hạn nghiệm thu

- Admin sản phẩm vẫn hydrate toàn bộ matches trước sort/page. Đổi SQL cần chứng minh collation/filter/count/stability; hiện đã có phản ví dụ cho hai collation SQL, không đủ căn cứ chuyển.
- Media đọc tham chiếu có nhiều whole-table scan; lọc/sort usage có thể materialize/tính hai lần. Quick-search còn nhiều nhánh tải toàn bộ rồi rank để lấy5. Public facets/search dùng whole snapshot có TTL. Chưa có profile đủ để đổi semantics/index/concurrency.
- Xử lý ảnh gốc/metadata vẫn đồng bộ và còn decode nhiều chỗ; chỉ giảm decode biến thể đã đo. MP4 không được chứng minh transcode/playback/Range cho đến CI thật.
- Chưa có query/request chính xác, tải bền nhiều giờ, cold cache tách biệt, field INP, mọi endpoint/tác vụ nền/schema/index, HA Redis, CDN/TLS, production sizing. Không đặt target giả cho báo cáo lớn/upload/video khi chưa đo dữ liệu đại diện.
- Giới hạn CI phải đọc theo số liệu đã lọc, không theo màu xanh workflow: synthetic catalog, localhost network, Node/libc khác shipping, thời gian ngắn và low sample counts. Một runner cùng lúc cả dịch vụ và browser/client không đại diện sản lượng VPS bán hàng.

## 9. Gói bàn giao, triển khai và hoàn tác để review

Đối chiếu [workspace-preservation.json](evidence/performance-2026-11-13/workspace-preservation.json): ngoài 26 tệp được sửa có chủ đích trong task, tất cả tệp nguồn có trước còn nguyên dấu kiểm; không có tệp ban đầu bị mất. [frozen-source-proof.json](evidence/performance-2026-11-13/frozen-source-proof.json) thực hành trên hai bản sao tất cả tệp trong snapshot nguồn cuối của cùng workspace: chỉ đúng ba file tối ưu khác nhau, mọi tệp khác trùng; chỉ mô phỏng biến môi trường để kiểm công cụ file, không chạy stack/load local.

Source mới thuộc backend comparator, decoded-image reuse, cache publication, dummy password, V1095 và các test; tooling thuộc `scripts/performance/` và workflow. Canonical cập nhật DATA/API/INTEGRATION/TESTING/DEPLOYMENT; không đổi API shape, quyền, trạng thái hay production dependency/index/env.

1. Reviewer đối chiếu source/manifest/snapshot cùng toàn bộ thay đổi có trước. Không push một phần làm thiếu nguồn fixture/baseline. Owner đã yêu cầu tiếp tục bước GitHub/CI ngày 14/11; snapshot trên nhánh riêng bảo toàn main/index và toàn bộ thay đổi có trước.
2. Khi bản đã review có trên GitHub và quota còn đủ, chạy workflow push public-only hoặc manual với full-stack + quota confirmation khi private. Xem pass/fail/skip, partial sanitized results, source/dataset/tool/image identities và phạm vi thiếu; sửa lỗi CI nếu lần đầu phát hiện vấn đề, không gọi source scaffolding là nghiệm thu.
3. Chỉ sau kết quả tách biệt đủ và phê duyệt production riêng: giữ image hiện tại, backup riêng audit mục tiêu V1095 có thử restore, kiểm Flyway/lock/thời gian, kế hoạch rollback dữ liệu có compare-and-swap.
4. Nạp app được duyệt trong cửa sổ có người trực; không tự áp migration/restart shop từ task này. Kiểm giá/hàng/variant/cart/checkout/session/quyền/CRUD/media/feed/SEO, resource/error/429/latency; theo dõi30phút và sau đó theo tải thực. Chưa giảm RAM/pool/timeout/rate limit hoặc mua hạ tầng.
5. Hoàn tác source theo diff hẹp/hash-bound snapshot, giữ thay đổi có trước. Hoàn tác runtime bằng image được giữ trong lần deploy được duyệt. V1095 cần phương án dữ liệu riêng; không sửa/xóa lịch sử Flyway.


### Xác minh cuối và việc còn cần quyền

- Website805/805; Admin1.245/1.245; backend1.580/1.580, không failure/error/skip. Hai frontend lint/build và backend verify/package đều exit0. Web sinh97 trang. `final-gates.json` ghi lệnh/exit/thời gian; test XML/log môi trường không đưa vào bằng chứng công khai.
- Nhóm auth/cache/eviction32/32; nhóm password/legacy/admin-auth32/32 (những ca này cũng nằm trong bộ đầy đủ, không cộng trùng). Bốn kiểm thử hash Boot cũ được giữ nguyên. [password-dummy-targeted-summary.json](evidence/performance-2026-11-13/password-dummy-targeted-summary.json), [independent-password-dummy-qa.json](evidence/performance-2026-11-13/independent-password-dummy-qa.json).
- Kiểm cấu hình ingress nguyên vẹn và hai biến thể cố tình tháo chốt đều đạt. Cấu hình CI nginx/Compose parse đạt; không khởi động nginx/server mới khi kiểm syntax. Helper25/25 Python, 4/4 Node, Node syntax và baseline3file đạt.
- Quét offline toàn bộ source dự kiến công bố bằng Gitleaks8.24.2 (binary chính thức đã đối chiếu checksum): lượt cuối0finding/exit0. Lượt đầu5 cảnh báo đều là4 SHA256 source và1 SKU công khai. Chỉ đổi cách gắn nhãn checksum/SKU, kiểm round-trip giữ nguyên mọi giá trị và không có code caller cho nhãn cũ; không sửa rule/allowlist/ignore. Giữ [kết quả đầu](evidence/performance-2026-11-13/secret-scan-initial-summary.json), [triage](evidence/performance-2026-11-13/secret-scan-triage.json), [kết quả cuối](evidence/performance-2026-11-13/secret-scan-summary.json). Đây không phải quét toàn bộ lịch sử Git hay chứng nhận không có PII. Source công cụ: [Gitleaks v8.24.2](https://github.com/gitleaks/gitleaks/releases/tag/v8.24.2).
- Owner đã yêu cầu tiếp tục bước snapshot/CI ngày14/11. Snapshot đã commit/push trên nhánh `ci/performance-validation-20261114`, main/index gốc không đổi. Công cụ không có workflow-dispatch nên dùng push trigger public-only đã được giới hạn; [CI sửa cấu hình](https://github.com/vominhduc11/bigbike/actions/runs/43522719254) đang chạy thật tại `543a97d8`. Chưa có bảng Before/After hệ thống từ xa hoàn tất; không xác nhận quota/billing tài khoản bằng suy đoán.

**Chưa có nghiệm thu tải/website/media toàn hệ thống hoặc production.** Những giới hạn ở mục7–8 vẫn còn nguyên; số test xanh không thay thế các phép đo thiếu.

### Tiếp tục GitHub/CI — 14/11

Đã xác minh repo public, SSH đọc remote và quyền push. Owner yêu cầu tiếp tục phần
còn thiếu sau khi bước snapshot/CI đã được nêu. Workflow dành riêng nhánh CI; không
merge main/deploy shop. Theo [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
(kiểm 14/11), standard hosted compute public miễn phí, log/job summary không tính
artifact allowance. Không dùng cache/upload artifact/custom runner; không đổi budget.
Kết quả log chỉ JSON allowlist nén có checksum, tối đa 1MiB nén/job; XML/log ứng dụng,
cookie, dump, env và traces giữ riêng trong runner tạm. Không tuyên bố đã audit billing
tài khoản. Gói helper thêm 3 bài kiểm giao nhận kết quả; tổng 24/24 đạt.

QA source độc lập 14/11 xác nhận ranh giới dữ liệu/dịch vụ; chỉ ra thiếu chẩn đoán CI.
Đã thêm mã phân loại lỗi cố định và mốc tiến trình; không xuất stderr/log ứng dụng.
Đã sửa bộ nhận diện source để giữ OID gitlink công cụ editor có trước mà không đọc
hay khởi tạo thư mục đó; bài kiểm nguồn Git tách biệt chứng minh phạm vi này.

Lần CI đầu [43521704761](https://github.com/vominhduc11/bigbike/actions/runs/43521704761)
đã chạy thật tại snapshot `92164a62`: boundary/secret-artifact guard đạt, Admin
1.242/1.245 đạt và 3 thất bại. Không nhận màu xanh từ local thay remote. Tái hiện
cùng số lỗi khi đưa VITE_STOREFRONT_BASE_URL của build CI vào 3 tệp unit (60/63);
unset biến riêng trong lệnh unit được 63/63, không sửa source app/assertion.
Bản build và browser vẫn dùng localhost riêng. Lưu hai báo cáo sanitized
ci-unit-env-reproduction.json / ci-unit-env-corrected.json. Reporter bổ sung tên
ca/vị trí source và mã lỗi cố định; không xuất giá trị matcher/log thô.

Bổ sung official web-vitals@5.1.0 chỉ trong công cụ lab, không dependency ứng dụng.
4 kiểm integrity đạt; Chromium trang HTML tách biệt đã có callback click thật.
Headless có thể không phát native hidden khi điều hướng: số đo là interim lab,
ghi actual hidden count/finalized flag; có thể thiếu click cuối checkout. Không
giả visibility event và không gọi kết quả là field INP/INP hoàn chỉnh của phiên.

### QA thương mại và sửa fixture CI — 14/11

QA độc lập phát hiện/tái hiện thêm hai lỗi, không tính là tối ưu hiệu năng mới:

- Giỏ nhận mua sản phẩm ngừng bán dù còn publish/còn hàng. Chặn thêm/tăng lượng,
  đánh dấu dòng không khả dụng và kiểm lại khi checkout, cho phép khách xóa/giảm
  lượng và khôi phục khi shop bán lại. Căn cứ STATE_MACHINES mục discontinued.
- Khi tăng giá, checkout báo409 nhưng giá giỏ không đổi, khách không thể phục hồi
  theo thông báo. Chỉ ngoại lệ xem lại giá trước tạo đơn được commit giá/tổng giỏ
  đã kiểm, giải phóng đúng reservation chưa hoàn tất; các lỗi khác rollback như cũ.
  Không tạo đơn/thanh toán/thông báo trước409; retry cùng khóa tạo đúng một đơn.
  Căn cứ Catalog Availability, ACCEPTANCE_CRITERIA COD-only recovery và API_CONTRACT
  Commerce Mutation Contracts đã làm rõ trước code.

Trước sửa3/3 ca thất bại đúng nguyên nhân. Sau sửa86/86 ca tập trung đạt, gồm8 ca
hồi quy mới; giữ nguyên mọi assertion có trước, cả snapshot giỏ bình thường. Đây
là MockMvc/H2 với transaction thật, chưa phải PostgreSQL/request tải thật. Lead đã
review diff độc lập và đang chạy toàn bộ backend UTC; commerce_checks.py chuẩn bị
kiểm realAPI/PG trên hai fixture riêng, tách khỏi sản phẩm đang đo PDP. Không sửa
dữ liệu shop. Chi tiết: independent-commerce-qa-2026-11-14.json.

CI43522719254: cả hai frontend lint/test/build đạt (Admin1245, web805). Backend
1579/1580, fail duy nhất kiểm doanh thu: fixture lấy ngày hostUTC nhưng chèn đơn
vào Instant.now thuộc ngàyVN kế tiếp; không skip/error. Sửa timestamp hai đơn thử
thành trưa ngày đang yêu cầu tại Asia/Ho_Chi_Minh, giữ assertion500000 và source
báo cáo. Căn cứ REPORT_RULE_008; ci-report-calendar-fixture.json. Chưa nhận Before/After
tải hệ thống vì gate chủ động dừng đúng trước stack.

Lead hoàn tất verify backend ởUTC:206 suite/1588/1588,0 failure/error/skip, package
exit0 (12phút47giây). Bằng chứng backend-commerce-utc-full-summary.json và
lead-commerce-integration-qa.json. Đây là kết quả mới sau8 ca thương mại, không
thay/sửa số1580 lịch sử. Chuẩn bị thêm10k nháp qua import hiện hữu; kiểm parser,
quyền/rate,gia hạn đăng nhập bình thường, tài nguyên/timeout/partialcommit và24 lần
đọc trang lấy mẫu ASC/DESC. Helper38/38Python+4/4Node đạt; chưa gọi là đã nhập/đo10k.
PG lab1GiB, job90phút dùng cùng resource cả hai bản trên public standard runner;
không tăng tài nguyên/chi tiêu shop. Source-only frozen-source-proof.json là mốc13/11;
phép đóng băng toàn cây của commitCI mới phải được chạy lại bởi run_ci.py, giữ cả
commercefix/calendarfix và mọi thay đổi có trước trong cả hai bản.

Tiếp tục15/11: kiểm lại workspace/main/index, container shop vẫn healthy/không thay;
source ban đầu2991 tệp không có thay đổi ngoài25 tệp có chủ đích. Helper38Python+
4Node chạy lại đạt; baseline3file/ingress/Compose/YAML đạt. Quét snapshot công bố
phát hiện một publicIdempotency-Key thử bị nhận nhầm credential; chuyển thànhUUID5
từ ID fixture/ngữ cảnh (cùng giá trị hai bản), không đổi rule/ignore. Lượt quét lại0.
Chưa có đo toàn stack thành công; hai lượtCI trước dừng đúng tại regression, lỗi
đã có bằng chứng/sửa/verify. Bản tích hợp mới đang được công bố lên cùng nhánhCI.

### Kiểm tiếp15/11: lỗi dữ liệu thử và công cụ cache

CI43670539154 tại f85d92: hai frontend đều lint/unit/build đạt; backend1586/1588,
0skip/error, hai lỗiHomepage nên stack chưa chạy. Tái hiện bằng chính AdminMutation
chạy trướcHomepage:56ca/2fail. Suite trước đổi danh sách nổi bật và thêm danh mục
đầu trang; seedINSERT-WHERE-NOT-EXISTS không hoàn nguyên dữ liệu. Featured dùngSQL
pagination, không quy lỗi này cho cache sản phẩm production. Tách H2/context riêng
choHomepage, giữ cache thật/TTL và mọiassertion.56/56 tập trung và206suite/1588/1588
verifyUTC sau sửa đều đạt (13phút05giây). Không tắt test để xanh.

QA phát hiện context.route tắt HTTPcache: nhãn warm của công cụf85 không hợp lệ;
chưa có browser measurement từf85 vì gate đã dừng. Thay bằng proxyloopback chỉtừchối,
khôngresolve/forward upstream; cachevẫn bật, xóa HTTPcache trước lượt đầu rồi đọc lại
và ghi cachehit. BàiChrome thật với worker/serviceworker/OOPIF/HTTP/HTTPS/WS chứng
minh đích cấm0TCPconnection, asset1→1 khi lặp,1→2 khi clear, private no-store khônghit.
Đây là kiểm giao thức công cụ, chưa phải latency BigBike; không chứng nhậnUDPtoàn diện.

Bổ sung internalWEB_REVALIDATE bằng secretCI sinhriêng, bật trên cả hai backend đo
saurestore; chỉ bỏ URL lúc provisionchưa cóweb. DùngAdminPATCH→H1thật thay đổi/khôi
phục, không gọi tắt endpointđặcquyền. So sánh từchối config/resourcekhácgiữa hai bản.
Cơchế resume frontend chỉ reusef85 khiGitchứngminhhaiapp+reporter+lệnhgate nguyên
vàGitHub xác nhận cảhaijob+lint/test/count/buildthànhcông; mọi thiếu/chệch chạy lại.
Backend luôn kiểm mới. Helper44Python+6Node đạt vànativecacheproofđạt; stackthật
vẫn chưa hoàn tất. Bằng chứngHomepage/cache/CIintegrationtách riêng trongevidence.

Run43676719268/c889edc8: boundary đạt, frontend reuse có proof thật từf85, backend
trênGitHub đạt. Stack vẫn bịskip bởi implicit success củaGitHub qua ancestor đãreuse.
Không nhận workflowgreen là nghiệmthu tải. Sửa jobstack sang always() kèm điều kiện
backend.result==success vàpush/full-stack đãduyệt, không bỏ gateBackend. Chưa có
Before/Afterhệthống từrun này.

### CI15/11: đã chạy tới bước dựng hệ thống, chưa đo được

Run43677437126/7ee51428: backend1588/1588,0fail/error/skip; frontend reuse có
proof; native browser cache/egress đạt. Build backend đạt, Compose khởi động
PostgreSQL/Redis/MinIO thất bại; không có Before/After/API/browser/media latency.
Lỗi cũ chưa lưu đủ mã phân loại nên không gọi kiểm registry trên host là stderr CI.
Kiểm riêng endpoint công khai: Postgres/Redis manifest200; MinIO DockerHub401
(token không có quyền pull), repository404; Quay401 sau authchallenge thường.
Release chính thức GitHub còn binary đúng phiên bản, digest/checksum trùng nhau.
Thay nguồn image chỉ trong lab bằng binary đã pinSHA256, build một lần dùng cả hai
bản; Debian runtime khác UBI shop nên ghi rõ giới hạn. Không đổi rootCompose,
không nâng phiên bản, không dùng mirror vô danh. Bổ sung phase infrastructure-start
và mã lỗi registry/network/config cố định, không xuất log/credential.46Python+6Node
và ingress/baseline đạt; chờ chạy thật để xác minh. Bằng chứng ci-stack-startup-2026-11-15.json.
QA độc lập tải/kiểm118849720byte và --version đạt; SHA256 binary phát hành còn
trùng hoàn toàn /usr/bin/minio trong container shop (chỉ đọc sau dockerps). Vì vậy
server executable không đổi byte; runtimebase vẫn là khác biệt cần ghi nhận.

### CI15/11: MinIO đã dựng thành công, sửa đường kết nối công cụ đo

Run43678807306/1470d418: backend1588/1588; officialstorage-image đạt checksum và
version, backendimagebuild đạt, cảPostgres/Redis/MinIO healthy. Tạo bucket từ host
bị ConnectionRefused tại localhost19000. ExactDocker28.0.4 libnetwork/endpoint.go
không ProgramExternalConnectivity khi internal=true; container healthy không
chứng minh cổng host đã mở. Giữ mạng không có đường ra ngoài, bỏ ports vô hiệu;
chuẩn bị TCP relay loopback tới đúngIP thuộccontainer/dựán/mạng đã kiểm chứng.
Không thêm egressbridge, không sửa firewall/daemon, không đổi app/quyền/rate. Cùng
relay trên hai bản và ghi giới hạn hop mạng thêm. Chưa có số đo ứng dụng.
Bằng chứng ci-internal-network-2026-11-15.json; QA tiếp theo kiểm protocol/halfclose/
lifecycle/đích cấm bằng helper-ownedTCP fixture, không mockứngdụng trong phép đo.
Sau tích hợp relay:54/54Python và6/6Node đạt; nativeTCP1MiB giữ nguyên bytes,
full-duplex/streaming trướcEOF/halfclose/capacity/retarget/shutdown đạt. Compose
render đủ7service, internal=true, khôngportbinding vôhiệu; ingress/negativecontrol
và baseline3file đạt. Đây là test công cụ truyền tải, chưa phải latency BigBike.
