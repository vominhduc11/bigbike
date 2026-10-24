# Kiểm tra chênh lệch sản phẩm nổi bật giữa admin và website

- Ngày kiểm tra: 2026-10-18.
- Phạm vi: màn **Sản phẩm nổi bật** → lưu vị trí trang chủ → danh sách công khai → trang chủ VI/EN trên stack Docker đang chạy.
- Yêu cầu ban đầu: kiểm tra và giải thích nguyên nhân. Sau khi nhận báo cáo, owner yêu cầu sửa luôn và build bản mới bằng `.env.vps`.
- Kết luận trước sửa: danh sách đã lưu đúng, nhưng luồng làm mới bộ nhớ đệm có hai thiếu sót. Website VI giữ 6 sản phẩm cũ; dữ liệu gốc, API công khai tại thời điểm chẩn đoán và website EN có 5 sản phẩm mới.

## Căn cứ chuẩn và bản đồ luồng

- `docs/business/MODULE_CATALOG.md`, dòng “Featured products admin”: màn quản trị sở hữu danh sách có thứ tự, tối đa 12 sản phẩm đã xuất bản.
- `docs/engineering/API_CONTRACT.md:932`–`948`: admin và public đọc cùng vị trí `FEATURED_GRID`, sắp theo `homepageOrder`; endpoint lưu thay thế toàn bộ danh sách.
- `docs/engineering/DATA_CONTRACT.md:1934`: vị trí và thứ tự nằm trên bản ghi sản phẩm, không phải hai danh sách độc lập giữa web và admin.
- `docs/engineering/INTEGRATION_GUIDE.md:180`: thay đổi từ admin phải làm mới dữ liệu web sau khi giao dịch lưu thành công, không chờ hết thời hạn lưu tạm.
- `docs/business/BUSINESS_RULES.md`, `PRODUCT_RULE_015`: sản phẩm rời trạng thái đã xuất bản phải rời khối nổi bật. Cả 5 sản phẩm hiện được chọn đều `PUBLISHED`, `discontinued=false`, nên không có trường hợp bị loại vì trạng thái trong lần kiểm tra này.

| Đầu | Nơi đọc/ghi |
|---|---|
| Admin | `FeaturedProductsScreen.jsx` → `adminApi.js:2316` đọc sản phẩm theo `homepageBlock=FEATURED_GRID`, `homepageOrder:asc`; lưu danh sách ID qua `saveHomepageBlocks` |
| Máy chủ | `HomepageBlockMutationService.setHomepageBlocks` ghi vị trí/thứ tự và phát yêu cầu làm mới web; public `CatalogReadService` đọc bản danh sách lưu tạm theo ngôn ngữ khi sắp theo `homepageOrder` |
| Web | trang `(home)/page.tsx:128` đọc 12 sản phẩm cùng vị trí/thứ tự; `public-api.ts:307` giữ kết quả đọc trong 3.600 giây; trang chủ VI thực tế được rewrite sang `/vi/internal/home/` |

## Đối chiếu dữ liệu thật

Đã xác nhận các container cần dùng đang chạy bằng `docker ps` trước khi kiểm tra.

| Thứ tự | Đã lưu trong PostgreSQL / API công khai | Trang chủ VI đang trả về |
|---|---|---|
| 1 | Giá đỡ Kewig M36-C1S | Giá đỡ Kewig M36-C1S |
| 2 | Tai nghe SCS S10X | Đồ đi mưa Givi ARS03 |
| 3 | Giày Scoyco MR002-2 | Áo giáp nữ LS2 Breeze |
| 4 | Giày Scoyco MT106 | Mũ ILM MF509 |
| 5 | Giày Scoyco MT038WP | Quần Komine PK-761 |
| 6 | — | Tai nghe SCS S10X |

- Cả 5 dòng được chọn có thời điểm cập nhật `2026-10-18T14:36:41.526068Z` (21:36:41 giờ Việt Nam).
- Log `bigbike-backend`: lúc `14:36:41.701397846Z`, yêu cầu làm mới tag `products` báo thành công ngay lần đầu.
- File cache VI trong `bigbike-web`, khóa `d83637a9971c68d9c633a5e7b2203d54b1f99a85540958142ad01cee1fe2ed20`, chứa phản hồi API có timestamp `14:36:45.282250315Z`: **vẫn 6 sản phẩm cũ**, dù đã qua thời điểm lưu. Thời hạn của file là 3.600 giây, tags `products`, `lang:vi`.
- Cache EN, khóa `2d98c50cb12a91c9a0e95ec42eeb2168c69e4102852ca742287f6e5f85e52544`, chứa phản hồi API lúc `14:45:33.400975204Z`: **đúng 5 sản phẩm mới**.
- HTTP mới đến `http://localhost:3000/` lúc `15:04:25Z` trả `x-nextjs-cache: HIT`, nội dung trang nhúng 6 sản phẩm cũ. Lần đối chiếu sau vẫn cho VI = 6, EN = 5. Header VI xác nhận rewrite `/vi/internal/home/`.
- Dữ liệu lấy trực tiếp từ `http://localhost:8080/api/v1/products?page=1&size=12&homepage_block=FEATURED_GRID&sort=homepageOrder:asc&lang=vi` tại thời điểm kiểm tra trả đủ 5 sản phẩm đúng thứ tự như PostgreSQL.

## F1 — Lưu danh sách nổi bật bỏ sót bước xóa bản danh sách lưu tạm ở máy chủ

- **Mức độ:** Medium.
- **Trạng thái:** Đã sửa, build và nạp backend; kiểm thử tập trung và đối chiếu dữ liệu thật sau nạp đều đạt.
- **Lệch ở đâu:** admin đọc được vị trí mới đã lưu; web có thể đọc lại bản danh sách công khai cũ ngay sau khi lưu.
- **Bằng chứng code:**
  - `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/HomepageBlockMutationService.java:101`: lưu sản phẩm, ghi nhật ký và gọi làm mới web, nhưng không gọi `CatalogReferenceCacheEvictor` hay `PublishedProductListingCache.invalidate`.
  - `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/repository/catalog/PublishedProductListingCache.java:29`: bản danh sách công khai được giữ riêng cho từng ngôn ngữ trong 60 giây.
  - `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/repository/catalog/JpaCatalogReadRepository.java:114`: đường đọc danh sách lấy qua bản lưu tạm này. `CatalogReadService.java:169` loại sắp xếp `homepageOrder` khỏi đường phân trang SQL trực tiếp, nên khối nổi bật đi qua bản lưu tạm.
  - `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/CatalogReferenceCacheEvictor.java:26` và `:45`: cơ chế xóa sau commit đã tồn tại; luồng sửa sản phẩm thông thường gọi nó tại `ProductMutationService.java:380`, luồng lưu danh sách nổi bật không gọi.
  - Đã đọc các class trong `/app/app.jar` của container `bigbike-backend`: bản đang chạy cũng thiếu tham chiếu đến cơ chế xóa cache trong `HomepageBlockMutationService`, trong khi `ProductMutationService` có tham chiếu đó.
- **Chuỗi nguyên nhân:** dữ liệu gốc thay đổi → yêu cầu làm mới web thành công → web đọc lại trong cửa sổ 60 giây khi bản danh sách máy chủ chưa bị xóa → nhận danh sách cũ → giữ tiếp kết quả cũ trong bộ nhớ đệm web 3.600 giây (`bigbike-web/lib/api/public-api.ts:325`). Cache VI có phản hồi API cũ chỉ 4 giây sau lần lưu, phù hợp chính xác với chuỗi này.
- **Hậu quả vận hành:** lưu thành công nhưng khách còn thấy sản phẩm đã bỏ chọn, không thấy sản phẩm mới hoặc thứ tự mới. Thời gian 60 giây ở máy chủ có thể bị kéo dài thành khoảng một giờ ở web, tùy lần truy cập và các lần làm mới tiếp theo.
- **Rule liên quan:** API contract về danh sách nổi bật và hợp đồng làm mới sau commit trong Integration Guide ở trên.
- **Cần owner quyết:** không cần chốt quy tắc mới. Hướng sửa là xóa bản danh sách máy chủ sau commit trước khi phát yêu cầu làm mới web.

## F2 — Lệnh làm mới đường dẫn trang chủ chưa bao phủ địa chỉ nội bộ VI thực sự được dùng

- **Mức độ:** Medium.
- **Trạng thái:** Đã sửa và nạp web để bao phủ alias VI thực tế của homepage/catalog/product, giữ route locale hiện hữu. Endpoint làm mới trả đúng alias; web VI/EN sau nạp khớp dữ liệu gốc.
- **Bằng chứng:**
  - `bigbike-web/proxy.ts:44`–`50`: `/` được rewrite đến `/vi/internal/home/`.
  - `bigbike-web/lib/utils/revalidation.ts:17`–`19`: với `/`, chỉ trả `/vi` và `/en`, thiếu `/vi/internal/home`.
  - `bigbike-web/app/api/revalidate/route.ts:68`–`77`: đánh dấu tag stale với profile `max`, rồi chỉ gọi làm mới các đường dẫn từ hàm trên.
  - Đã đối chiếu bundle `app/api/revalidate/route.js` và `middleware.js` trong container `bigbike-web`: bản chạy có cùng thiếu sót. Header HTTP xác nhận trang đang phục vụ qua alias này.
- **Hậu quả vận hành:** yêu cầu làm mới đường dẫn không trỏ đến đúng bản trang chủ VI đang phục vụ. Tag vẫn có thể giúp cập nhật theo cơ chế nền; thiếu sót này không giải thích thay cho F1 và không chứng minh trang sẽ cũ vô thời hạn.
- **Rule liên quan:** `docs/engineering/INTEGRATION_GUIDE.md`, “Web Revalidation (ISR on-demand)”.
- **Cần owner quyết:** không cần quy tắc kinh doanh mới. Hướng sửa là bao phủ alias nội bộ khi làm mới trang, kiểm tra đồng thời VI/EN.

## Cách kiểm chứng và giới hạn của lần chẩn đoán ban đầu

Các thao tác với hệ thống đang chạy đều chỉ đọc:

- `docker ps --format ...`: xác nhận stack.
- `docker exec bigbike-postgres ... psql ...`: chạy `SELECT id, name, homepage_block, homepage_order, publish_status, discontinued, updated_at FROM products WHERE homepage_block = 'FEATURED_GRID' ORDER BY homepage_order NULLS LAST`.
- HTTP GET tới public API và trang chủ VI/EN ở cổng localhost; đọc danh sách sản phẩm từ dữ liệu trang trả về, không dựa vào ảnh hoặc suy đoán tên.
- `docker logs --since 2h bigbike-backend`: đối chiếu thời điểm và kết quả phát yêu cầu làm mới.
- `docker exec bigbike-web node ...`: đọc hai file fetch-cache, metadata trang, manifest và bundle của bản đang chạy; chỉ xuất thông tin sản phẩm/cache liên quan.
- `docker exec bigbike-backend cat /app/app.jar`: đọc class để đối chiếu bản triển khai với source, không thay file trong container.

Không đăng nhập hoặc gọi API quản trị có ghi dữ liệu. Không bấm Lưu, gửi yêu cầu xóa cache, khởi động lại hay triển khai. Không chạy kiểm thử đơn vị/build vì đây là lần chẩn đoán chỉ đọc, không có sửa source. Chưa thực hiện bài thử lưu mới có kiểm soát để tái hiện lần hai; bằng chứng runtime là lần lưu thực tế của owner và các bản cache còn giữ được.

Đã tra `docs/audits/`: các ghi nhận cũ về `PRODUCT_RULE_015` và bộ chọn Home Highlights không phải hai nguyên nhân trên; không tái sử dụng hoặc sửa các finding `AUD-xxx` khác.

## Kết quả sửa, build và triển khai theo yêu cầu tiếp của owner

- Backend đăng ký xóa snapshot sau commit **trước** khi đăng ký phát yêu cầu làm mới web, dùng `CatalogReferenceCacheEvictor` hiện có. Cả VI/EN cùng được xóa; rollback giữ snapshot cũ.
- Web thêm alias mà proxy sử dụng cho trang chủ, catalog và sản phẩm VI; giữ route locale VI/EN hiện hữu và cơ chế tag `max` để không ảnh hưởng các trang tĩnh.
- Tài liệu chuẩn được cập nhật trước source: `API_CONTRACT.md` phần danh sách nổi bật và `INTEGRATION_GUIDE.md` phần Web Revalidation.
- Không thay đổi payload, quyền, trạng thái sản phẩm, dữ liệu nổi bật thật, schema hoặc biến môi trường.

### Kiểm tra

| Kiểm tra | Kết quả |
|---|---|
| Web `npm run lint` | PASS, gồm guard dữ liệu và ESLint; hai file đổi đã được Prettier xử lý trực tiếp |
| Web `npm run test -- --maxWorkers=2` | PASS: 109 file, 735 bài; gồm 7 bài về đường dẫn làm mới |
| Backend focused: `HomepageBlockMutationServiceTest,CatalogReferenceCacheEvictorTest,HomepagePublicApiTest` | PASS: 15 bài. Bốn bài mới dùng snapshot thật đã nạp VI/EN, kiểm thay danh sách/xóa hết, giữ bản cũ trước commit, web đọc bản mới sau commit, rollback và từ chối sản phẩm nháp |
| Backend `./mvnw -B test` | FAIL: 1.539 bài, 1 failure, 0 error, 1 skipped. Failure duy nhất: `ArticleExcerptAuthorRemovalMigrationPostgresTest.removesArticleColumnsAndOnlyArticleAuditKeys:54` |
| Nginx boundary self-test | PASS: cấu hình nguyên vẹn và cả hai trường hợp cố ý phá chốt |
| Docker build backend/web bằng `.env.vps` | PASS; web biên dịch, TypeScript và 95/95 trang hoàn tất. Có lượt tự thử lại trang quá 60 giây khi build cùng bộ kiểm backend; không đổi timeout/cấu hình để bỏ qua |
| So sánh artifact backend với bản đang chạy trước đó | PASS: chỉ `HomepageBlockMutationService.class` thay đổi; không có resource/migration/thư viện/Media thay đổi |
| Revalidation thật trên web mới | HTTP 200, paths gồm `/vi/internal/home`, `/vi/internal/sp`, cùng `/vi`, `/en`, `/vi/sp`, `/en/sp` |
| Public API VI/EN và trang chủ VI/EN trên localhost + HTTPS | PASS: đều HTTP 200, đúng 5 ID và đúng thứ tự PostgreSQL |
| Image, sức khỏe, RAM, env và dịch vụ khác | PASS: đúng hai image mới, healthy; RAM backend 1 GB/web 512 MB giữ nguyên; `.env`/`.env.vps` và admin/PostgreSQL/Redis/MinIO không đổi |

Failure của bộ backend đầy đủ là lỗi cũ đã có tại
`FEATURE_MEDIA_UPLOAD_PERFORMANCE_2026-10-13.md` phần kiểm thử; migration và test
tin tức không được sửa trong đợt này. Jar triển khai mới giữ nguyên toàn bộ
resource/migration so với bản trước. Không ghi bộ kiểm đầy đủ là pass, không mở
rộng sửa tin tức trong phạm vi sản phẩm nổi bật. Không chạy thao tác thêm/bỏ/đảo
thứ tự trên danh sách nổi bật production để thử; luồng này được kiểm bằng snapshot
thật trong unit test và đối chiếu chỉ đọc sau nạp.

### Bản đang chạy và kết quả khách thấy

- Backend: `sha256:c4ae3991d56fbec587e2ac5fbefc11366d9455b38ed553caa92a0522b802dbce`.
- Web: `sha256:f1022aab4dfb984cf1068dc9ca4d8b7bad98b01d5d2d588e0ef1ee96c4d931ac`.
- Đã dùng `docker compose --env-file .env.vps ... build bigbike-backend bigbike-web`, với override **chỉ đổi build context backend** sang bản tạm tách Media còn chờ. Nạp hai dịch vụ lần lượt bằng `up -d --no-deps --no-build --wait`; không nạp admin hoặc hạ tầng.
- Backup image: `bigbike-backend:before-featured-20261018`, `bigbike-web:before-featured-20261018`. Image Media còn chờ được giữ thêm tại `bigbike-backend:pending-before-featured-20261018`; source Media trong workspace giữ nguyên.
- Cả `https://bigbike.vn/` và `https://bigbike.vn/en/` hiện khớp 5 sản phẩm: **Kewig M36-C1S → SCS S10X → Scoyco MR002-2 → Scoyco MT106 → Scoyco MT038WP**.
- Bằng chứng đã lọc, không có secret/PII: [verification.json](evidence/featured-products-2026-10-18/verification.json). Script, jar đối chiếu và baseline riêng nằm ở `/tmp/bigbike-featured-20261018/`; log ở `/tmp/bigbike-featured-*-20261018.log`.

### PR summary / preflight

Summary:
- Sản phẩm nổi bật đã lưu được máy chủ và web VI/EN đọc nhất quán sau commit.
- Sửa bước xóa snapshot máy chủ và bao phủ alias VI trong lệnh làm mới web.

Files changed:
- Backend: `HomepageBlockMutationService.java`, `HomepageBlockMutationServiceTest.java`.
- Web: `lib/utils/revalidation.ts`, `__tests__/api/revalidate-route-paths.test.ts`.
- Docs: `API_CONTRACT.md`, `INTEGRATION_GUIDE.md`, `DEPLOYMENT_GUIDE.md`, báo cáo và evidence này; giữ nguyên các phần thay đổi có sẵn từ task khác.

Checks:
- Web lint/test/build: PASS (735 bài).
- Backend focused: PASS (15 bài); full test: FAIL (1 lỗi cũ, 1 skipped); Docker package/build: PASS.
- Nginx boundary, artifact diff, revalidation và đối chiếu dữ liệu thật VI/EN: PASS.
- Không chạy admin gate: source admin không đổi trong task này. Không chạy E2E có ghi danh sách nổi bật thật. Không có thay đổi UI/CSS để chạy hygiene.

Notes:
- Đã triển khai và nghiệm thu; không có migration/env mới. Chưa commit/push.
- Failure cũ về migration tin tức vẫn nằm ngoài phạm vi sửa này.
