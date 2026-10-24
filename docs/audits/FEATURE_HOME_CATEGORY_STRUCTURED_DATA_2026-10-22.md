# Kiểm tra phiếu SEO trang chủ và danh mục — 2026-10-22

Trạng thái: **đã sửa DEV-1–DEV-4, build bằng `.env.vps` và nạp bản web mới; 10 kịch bản kiểm trình duyệt đạt**.
Owner đã yêu cầu triển khai và build bản mới bằng `.env.vps` sau báo cáo kiểm tra.
Các bằng chứng hiện trạng dưới đây được giữ làm mốc trước sửa; kết quả nghiệm thu bản mới ghi ở cuối.
Không sửa nội dung danh mục hoặc dữ liệu shop.

## Phạm vi và căn cứ

- Tính năng còn hoạt động: `docs/business/MODULE_CATALOG.md`, dòng Catalog browse và Catalog admin.
- `docs/business/BUSINESS_RULES.md`: `SEO_RULE_007` (một CollectionPage/ItemList cho trang hiện tại),
  `SEO_RULE_008` (một FAQ JSON-LD, khớp nội dung hiển thị), `SEO_RULE_009` (SEO là chữ thuần).
- `docs/engineering/API_CONTRACT.md`: mục Category `introContent`, nhóm public settings.
- `docs/engineering/DATA_CONTRACT.md`: Category bilingual content và Category intro FAQ markup normalization.
- Phiếu owner ngày 22/10/2026 là yêu cầu mới cho hồ sơ doanh nghiệp cố định và description của CollectionPage.
  Trước khi lập trình cần ghi bổ sung vào tài liệu chuẩn; giới hạn description này là 160 ký tự,
  tách khỏi quy tắc meta description 165 ký tự hiện có.

Bản đồ dữ liệu đã đọc:

| Đầu | Đường đi hiện tại |
|---|---|
| Admin | `CategoryDetailScreen.jsx` → trình nhập danh mục → `src/lib/categoryIntro.js`; cài đặt qua `SettingsScreen.jsx` và `screens/settings/constants.js` |
| Backend | `CategoryMutationService` / `CategoryEntity` → `JpaCatalogReadSupport` và API danh mục công khai; settings qua `SettingDefinitionRegistry` |
| Web | `lib/api/public-api.ts` → trang chủ / trang danh mục → `json-ld.ts`, `sanitizeRichHtml`, `CatalogDefault` / `CatalogClient`, `CollapsibleContent` |

## Kiểm chứng thực tế

Đã chạy `docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'` trước kiểm tra.
`bigbike-web` (`localhost:3000`), `bigbike-backend` (`localhost:8080`) và `bigbike-admin`
(`localhost:4000`) đều đang chạy; web/backend báo healthy. Không chạy lệnh thay đổi container.

Đọc HTTP công khai trên cả `http://localhost:3000` và `https://bigbike.vn`:

| Trang | Khối giới thiệu trong HTML | Câu hỏi trong HTML | JSON-LD trong HTML |
|---|---:|---:|---|
| `/` | 0 | 0 | Organization, WebSite, LocalBusiness |
| `/danh-muc/mu-bao-hiem/` | 2 | 12 | BreadcrumbList, CollectionPage, FAQPage |
| `/danh-muc/mu-bao-hiem-fullface/` | 2 | 12 | BreadcrumbList, CollectionPage, FAQPage |
| `/danh-muc/tai-nghe-bluetooth-mu-bao-hiem/` | 2 | 12 | BreadcrumbList, CollectionPage, FAQPage |
| `/en/categories/motorcycle-helmet-intercom/` | 2 | 12 | BreadcrumbList, CollectionPage, FAQPage |

Tất cả trả 200. Với trang cha mũ bảo hiểm, trang con fullface và trang EN tai nghe:

- Đọc HTML web thật **5 lần/trang**: mỗi lần đều 2 khối giới thiệu, 12 tiêu đề câu hỏi, 3 script JSON-LD.
- Mở bằng Chromium/Playwright **5 lần/trang**: DOM sau tải đều 1 khối, 6 tiêu đề câu hỏi,
  3 script JSON-LD, mỗi loại đúng 1. Chưa tái hiện trường hợp 3 khối giới thiệu / 6 script.
- `html.lang` đúng VI/EN; `.bb-cat-intro` không có `lang` ở cả HTML và DOM.
- Logo `https://bigbike.vn/wp/logo.png` trả 200, `image/png`.

Đếm thẻ HTML bằng bộ đọc HTML / DOM, không đếm chuỗi JSON-LD hoặc HTML được escape trong dữ liệu
phục vụ React. Các lượt kiểm trên là tình trạng **trước sửa**, không phải nghiệm thu bản sửa.

## F1 / DEV-1 — Hồ sơ doanh nghiệp trang chủ chưa theo phiếu mới

- **Mức theo phiếu:** Cao.
- **Bằng chứng:** `bigbike-web/app/[locale]/(storefront)/(home)/page.tsx:194` dựng Organization,
  WebSite và LocalBusiness; `lib/seo/json-ld.ts:382` và `:396` là hai bộ dựng doanh nghiệp cũ.
  HTTP local và web thật xác nhận tên BigBike, điện thoại `0906 902 404`, địa chỉ chưa tách
  phường/thành phố như phiếu, thiếu mã bưu chính/toạ độ/Maps CID.
- **Điểm cần sửa trong nhận định của phiếu:** schema hiện lấy hotline, địa chỉ, email, giờ và
  mạng xã hội từ settings công khai. Những dữ liệu này vẫn ở máy chủ; nhóm CONTACT bị ẩn có chủ ý
  trong admin (`bigbike-admin/src/screens/settings/constants.js:206`). Footer có các giá trị
  cố định riêng; không nên đồng nhất nguồn của footer với nguồn của schema trang chủ.
- **Hướng xử lý:** một script graph Organization + SportingGoodsStore theo đúng JSON owner cung cấp,
  giữ WebSite/SearchAction. Tên Shop Bigbike độc lập với ô Tên shop. Không đổi tên SEO toàn web.
- **Lưu ý triển khai:** bộ kiểm `bigbike-web/scripts/check-no-runtime-business-data.mjs` hiện chặn
  email/địa chỉ/tài khoản mạng xã hội cố định. Yêu cầu mới cần ngoại lệ được ghi rõ và giới hạn
  đúng dữ liệu schema trang chủ; không tắt bộ kiểm hoặc lách qua cách ghép chuỗi.
- **Trạng thái:** Đã sửa và nạp bản mới; tình trạng kiểm công cụ ngoài ghi ở phần kết quả sau triển khai.

## F2 / DEV-2 — HTML danh mục có hai bản giới thiệu

- **Mức theo phiếu:** Cao.
- **Bằng chứng:** `bigbike-web/app/[locale]/(storefront)/danh-muc/[slug]/page.tsx:228` tạo
  `beforeGridNode`, rồi truyền cùng nội dung vào `CatalogDefault` ở fallback (`:292`) và
  `CatalogClient` ở nhánh chính (`:303`) của Suspense. Hai nhánh xuất hiện trong HTML trả về;
  nhánh chờ được bỏ sau khi trang tải xong.
- **Loại trừ:** `components/ui/collapsible-content.tsx` chỉ có một `{children}`;
  khối thu gọn/mở rộng đang dùng một nội dung và thay chiều cao. Không có bằng chứng chính
  component thu gọn tạo hai bản nội dung.
- **JSON-LD:** trang hiện đã phát tại server (`page.tsx:266`), ngoài khối giới thiệu.
  `LHtml` nhận HTML đã lọc, không có thao tác thêm JSON-LD; bộ lọc không cho thẻ script.
  15 lượt kiểm DOM chưa tái hiện nhân đôi script nên không kết luận đã xác định nguyên nhân
  riêng của hiện tượng gián đoạn này.
- **Hướng xử lý:** loại việc phát intro ở cả hai nhánh; giữ intro duy nhất khi dựng HTML và
  giữ bố cục hiện tại. Kiểm lại HTML/DOM, đổi trang và tải lại; không chỉ ẩn bản sao bằng CSS.
- **Trạng thái:** Đã sửa; kiểm HTML/DOM 5 lần/trang và thu gọn/điều hướng qua trình duyệt đạt.

## F3 / DEV-3 — Description đang gom toàn bộ intro

- **Mức theo phiếu:** Vừa.
- **Bằng chứng:** trang danh mục `page.tsx:210` lấy chữ của cả intro rồi cắt 500 ký tự;
  không ưu tiên `category.seo.description`. HTTP thật có cả nhãn Danh mục/Category,
  tên hãng và tiêu đề bảng trong CollectionPage.description.
- **Dữ liệu sẵn có:** API backend trả mô tả SEO riêng đúng locale và intro riêng. Với bốn
  danh mục đã đọc, mô tả SEO đều có giá trị; không cần thêm trường dữ liệu hay đổi API.
- **Hướng xử lý:** ưu tiên SEO description theo locale; khi trống chỉ lấy `.bb-ci-body`.
  Làm sạch chữ và rút gọn ở ranh giới câu, tối đa 160 ký tự theo phiếu. Không dùng nhãn,
  FAQ hoặc bảng làm fallback. Không sửa nội dung giá/số liệu do bên nội dung quản lý.
- **Trường hợp cần quy định trước khi lập trình:** nếu câu đầu tiên dài hơn 160 ký tự,
  không thể đồng thời giữ nguyên câu và đạt giới hạn; phiếu chưa nêu cách xử lý. Cũng chưa
  nêu fallback khi cả SEO description và `.bb-ci-body` đều trống. Không tự viết câu quảng cáo mới.
  Khi owner yêu cầu triển khai luôn, đã thông báo áp dụng cắt ở cuối từ kèm dấu … nếu câu đầu vượt
  giới hạn; thiếu cả hai nguồn thì bỏ thuộc tính mô tả, không tự tạo nội dung. Quy tắc đã ghi tại
  `SEO_RULE_014` trước khi sửa mã nguồn.
- **Trạng thái:** Đã sửa và kiểm trên website mới.

## F4 / DEV-4 — Lang mất tại bộ lọc HTML của web

- **Mức theo phiếu:** Thấp.
- **Bằng chứng admin:** `bigbike-admin/src/lib/categoryIntro.js:285` bổ sung lang khi cần;
  `:515` dựng wrapper có lang. API thật trên backend trả wrapper `lang="vi"` cho ba danh mục VI
  và `lang="en"` cho tai nghe EN.
- **Bằng chứng web:** `bigbike-web/lib/utils/html.ts:39` dùng danh sách thuộc tính cho phép;
  danh sách ở `:155` không có lang. HTML công khai mất thuộc tính này sau khi qua bộ lọc.
- **Hướng xử lý:** sửa đúng khâu hiển thị để wrapper có lang theo route; kiểm thêm trường hợp
  trang EN dùng nội dung VI dự phòng theo `CATEGORY_RULE_002`. Không cần sửa lại dữ liệu danh mục
  hoặc đổ lỗi cho thao tác lưu của nhân viên.
- **Trạng thái:** Đã sửa và kiểm trên website mới.

## Ghi chú CSP / Pixel ngoài phạm vi DEV-1–DEV-4

- Chromium tái hiện chặn `static.cloudflareinsights.com/beacon.min.js`. `next.config.ts:523`
  không có domain đó trong script-src. Đây cũng là hiện tượng đã được ghi tại
  `docs/engineering/DEPLOYMENT_GUIDE.md`, không phải lỗi mới do phiếu này.
- `next.config.ts:533` đúng là có `form-action 'self'`. Chưa tái hiện lỗi form-action của Meta
  trong các lượt mở trang trên; không được suy ra mọi sự kiện Meta đều mất hoặc đều hoạt động.
- Lượt đọc thêm trang tai nghe VI xác nhận `fbq` đã nạp (phiên bản `2.9.427`),
  `connect.facebook.net/en_US/fbevents.js` và cấu hình Pixel hiện hữu đều trả 200.
  Chỉ việc thư viện nạp thành công chưa chứng minh sự kiện đã đến hệ thống quảng cáo;
  lượt này không ghi nhận phản hồi gửi sự kiện `/tr/` và không tạo sự kiện giả để thử.
- `ANALYTICS_RULE_001` và `INTEGRATION_GUIDE.md` mục Meta Pixel yêu cầu một cài đặt Pixel,
  không tự thêm bản thứ hai. Không tự mở rộng CSP trong việc sửa schema; cần bằng chứng
  đường gửi sự kiện bị chặn trước khi chọn thay đổi chính xác.

## Kiểm tra nền trước sửa và giới hạn tại thời điểm đó

- `npx vitest run lib/seo/category-intro.test.ts __tests__/seo/json-ld.test.ts __tests__/utils/html.test.ts components/ui/collapsible-content.test.tsx`
  — **4 file / 47 bài kiểm đạt**. Đây là bộ kiểm đang có, chưa bao phủ đầy đủ yêu cầu mới.
- Kiểm trình duyệt: Chromium desktop 1440×900; chưa kiểm mobile/tablet hoặc ảnh so sánh giao diện.
- Tại mốc trước sửa, chưa chạy lint/build; kết quả sau sửa ghi bên dưới.
- Chưa có kết quả nghiệm thu Google Rich Results / schema.org cho graph mới.
- Các thay đổi chưa commit đã có từ trước trong admin/backend/web/docs được giữ nguyên.
- Phạm vi dự kiến sửa: web + tài liệu + bài kiểm liên quan; hiện chưa thấy cần migration hoặc
  sửa dữ liệu shop. Giữ việc biên tập chữ danh mục ngoài phiếu như owner yêu cầu.

## Kết quả sau sửa và triển khai

### Thay đổi

- **DEV-1:** thay hai builder doanh nghiệp cũ bằng `lib/seo/homepage-business.ts`, đúng graph trong
  phiếu, chỉ gọi từ server page trang chủ VI/EN. Giữ nguyên WebSite/SearchAction và tên/SEO lấy từ admin.
  Đã gỡ các helper tách địa chỉ/giờ cũ không còn caller. Guard dữ liệu cố định chỉ miễn đúng file
  hồ sơ và đúng ba nhãn email/địa chỉ/tài khoản mạng xã hội (`SEO_RULE_012`).
- **DEV-2:** bỏ nhánh Suspense nội bộ đang phát lại intro trong trang danh mục vốn đã render động
  theo URL. Giữ một `CatalogClient` có dữ liệu đầu vào từ server; không thay vị trí intro, bộ lọc,
  phân trang hoặc component thu gọn. JSON-LD tiếp tục phát riêng tại server page (`SEO_RULE_013`).
- **DEV-3:** ưu tiên SEO description theo locale, sau đó chỉ chữ `.bb-ci-body`. Dùng ranh giới câu
  theo ngôn ngữ, tối đa hai câu/160 ký tự; không nhầm TP.HCM hoặc số thập phân thành câu riêng.
  Thiếu nguồn thì bỏ thuộc tính mô tả. Các trường hợp câu đầu quá dài có kiểm riêng (`SEO_RULE_014`).
- **DEV-4:** bộ lọc HTML giữ thuộc tính ngôn ngữ và đặt lang wrapper theo route; script/event handler
  vẫn bị loại bỏ. Không sửa admin, API backend hoặc bản ghi nội dung.

### Các bước đã chạy

| Kiểm tra | Kết quả |
|---|---|
| `npm run lint` (web), guard dữ liệu runtime | Đạt; kiểm ESLint trực tiếp lại các file cuối đã sửa cũng đạt |
| Prettier trực tiếp 12 file web đã chạm | Đạt; không dựa vào việc chưa stage file để bỏ qua định dạng |
| `npm run test` (web) | **110 file / 746 bài đạt** |
| Bài kiểm sanitizer sau chỉnh khai báo kiểu DOM | **15 bài đạt**; thay đổi khai báo kiểu không đổi hành vi đã kiểm |
| `npx tsc --noEmit` | Đạt |
| `bash deploy/nginx/tests/domain-boundary-config-test.sh --self-test` | Kiểm dương và hai kiểm âm đều đạt |
| Docker production build riêng web, dùng `.env.vps` | Đạt; Next.js biên dịch, kiểm TypeScript và dựng 95 trang thành công |
| Kiểm image mới tại `localhost:3100` trước nạp | Trang chủ VI/EN và 5 trang danh mục đều đúng số script/intro/lang/mô tả trong HTML và DOM |
| Playwright trên `https://bigbike.vn`, chạy một worker | **10 kịch bản đạt**, ở 375/768/1440px |
| 4 trang danh mục × 5 lần tải | HTML/DOM đều 1 intro, 6 câu hỏi, 3 JSON-LD, mỗi loại 1; không lỗi hydration |
| Trang thiếu SEO (`/danh-muc/giay-mua-he/`) | Description lấy đúng intro, tối đa 160 ký tự |
| Thu/mở và điều hướng danh mục bằng menu | Đạt, không nhân đôi nội dung hoặc script |
| Đi từ trang chủ → danh mục con → trang chủ qua liên kết thật | Số script lần lượt **2 → 3 → 2**, không lỗi trang |
| Lệnh curl/grep/wc nguyên dạng trong phiếu | Trả về **6** |
| Schema.org validator với **toàn bộ HTML trang chủ mới** | **0 lỗi / 0 cảnh báo**; nhận SportingGoodsStore, Organization liên kết và WebSite |

Đã đọc danh sách 30 danh mục trong mỗi locale bằng API thật: không có bản ghi nào chứa nhiều root intro;
5 danh mục/locale thiếu SEO description đều có `.bb-ci-body` cho dự phòng. Không tạo/sửa dữ liệu thử.

### Image và website đang chạy

Đã chạy:

```bash
docker compose --env-file .env.vps build bigbike-web
docker compose --env-file .env.vps up -d --no-deps --no-build bigbike-web
```

- Image hiện hành: `sha256:4d8a09f75bdb11aa12d6784b7f0cd0f8bcadc515836deeeb1105bb8820d874a0`.
- Tag bản mới: `bigbike-web:seo-20261022`.
- Container `bigbike-web` dùng đúng image trên, trạng thái **healthy**; startup revalidation HTTP 200.
- Image trước giữ ở `bigbike-web:before-seo-20261022`
  (`sha256:f1022aab4dfb984cf1068dc9ca4d8b7bad98b01d5d2d588e0ef1ee96c4d931ac`).
- Container kiểm tạm đã dọn; backend/admin và các dịch vụ dữ liệu vẫn giữ container đang chạy.
- Không sửa `.env.vps`, không commit/push. Những thay đổi có từ trước trong workspace được giữ nguyên.

### Giới hạn và việc ngoài phiếu

- Schema.org ở chế độ lấy URL báo không lấy được trang. Đã kiểm thay bằng chính HTML công khai mới
  từ website qua `POST https://validator.schema.org/validate` với trường `html`; phản hồi HTTP 200,
  `totalNumErrors=0`, `totalNumWarnings=0`. Không coi đây là bằng chứng công cụ đã fetch URL thành công.
- Google Rich Results mở được giao diện nhưng trả **“Log in and try again”**. Chưa có kết quả từ Google
  xác nhận Local business; không ghi bước này là đạt. Owner có thể kiểm lại bằng tài khoản Google
  trên URL đã triển khai. Không mở rộng CSP hoặc thay cấu hình bảo vệ website để vượt kiểm tra ngoài.
- Console vẫn ghi cảnh báo Cloudflare beacon đã có trước phiếu. Playwright giữ cảnh báo này riêng
  trong annotation; không coi console hoàn toàn sạch. Không gặp thêm lỗi trang/hydration trong các ca đạt.
- Cổng thử localhost không nằm trong danh sách origin được API cho phép, nên đọc giỏ có cảnh báo CORS
  ở cổng thử; không sửa cấu hình để cho phép. Kiểm trình duyệt chính thức đã chạy lại trên domain thật
  và đạt. Không có thay đổi nghiệp vụ giỏ hàng.
- Meta Pixel giữ một cài đặt hiện hữu. Đã kiểm thư viện/cấu hình nạp được; chưa khẳng định toàn bộ sự
  kiện đã đến hệ thống quảng cáo. Phần CSP/Pixel tiếp tục là ghi chú ngoài DEV-1–DEV-4.
- Khi kiểm HTML mới, đoạn chữ cuối trang chủ còn ghi giờ Chủ nhật đến **18:00**, trong khi graph theo
  phiếu là **17:00**. Đây là nội dung đang nhập qua `home_content_bottom_html`, không phải giá trị của
  graph mới; cần bên nội dung đối chiếu lại giờ. Chưa sửa trường nội dung này trong phiếu thay schema.

Bằng chứng gọn trong git:
`docs/audits/evidence/home-category-structured-data-2026-10-22/verification-summary.json`.
Log chi tiết trên máy: `/tmp/bigbike-seo-{lint,tests,typecheck,docker-build,docker-deploy,live-e2e}-20261022.log`;
phản hồi validator tại `/tmp/bigbike-seo-schema-validator-20261022.json`, HTML nguồn và header tại
`/tmp/bigbike-seo-live-{home,headers}-20261022.*`, ảnh trang chủ tại
`/tmp/bigbike-seo-home-desktop-20261022.png`.
