# Prompt: Refactor `bigbike-web` về đúng chất Next.js (gỡ lớp port WordPress)

> **Trạng thái hoàn tất (2026-07-11):** Lớp WordPress theme port đã được gỡ khỏi mã ứng dụng. Không còn `Wp*`, `bb-wp-*`, theme loader, bundle `wp-theme-*.css`, `components/wp/` hoặc `public/wp-content/themes/`. Nội dung bên dưới được giữ làm hồ sơ yêu cầu và bối cảnh trước refactor; không dùng các mục "còn lại" làm trạng thái hiện hành.

> Dán toàn bộ nội dung dưới đây cho Claude Code khi mở tại thư mục `bigbike-web`.

---

Bạn là kỹ sư phụ trách refactor dự án **bigbike-web** (Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4). Nhiệm vụ: **clean code toàn bộ dự án và tái cấu trúc về đúng chất Next.js**, loại bỏ lớp "port theme WordPress cũ" (bundle `wp-theme-*.css` nạp/gỡ động, prefix `Wp*` trải khắp component layer), thay bằng giải pháp React + Tailwind thuần.

Đây là refactor **bảo toàn hành vi** (behavior-preserving): chỉ đổi cách code được tổ chức và triển khai, **không** đổi thứ người dùng nhìn thấy hay nghiệp vụ chạy.

## 0. Trạng thái hiện tại — đọc trước khi bắt đầu (cập nhật 2026-07-10)

Bản prompt gốc viết 2026-06-20; từ đó tới nay code đã đổi khá nhiều. Mục này là bản đồ sơ bộ đã verify tại thời điểm cập nhật — **chạy lại các lệnh liệt kê bên dưới để xác nhận số liệu trước khi lập kế hoạch lô**, vì file có thể đã tiếp tục đổi.

**Đã xong, không cần làm lại:**
- jQuery + `home.min.js`: đã gỡ hoàn toàn, không còn trong repo (`find . -iname "home.min.js"` rỗng; `grep -ri jquery` trên source thật chỉ còn lại trong *comment* giải thích lịch sử, không còn code thật dùng jQuery).
- `lib/hooks/useDetachWpHandlers.ts`, `lib/wp-theme-routes.ts`: đã bị xoá.
- Hành vi tương tác (header sticky/headroom, hamburger/drawer, scroll-to-top, v.v.) đã chuyển sang React thuần tại `components/wp/WpThemeInteractions.tsx` — file này **không còn jQuery**, chỉ còn cần đổi tên/vị trí cho khớp quy ước mới, không cần viết lại logic.

**Còn lại — phạm vi thật của lần refactor này** (verify bằng `find components app -iname "Wp*.tsx" | wc -l` → 40 file; `grep -rl "Wp[A-Z]" app --include="*.tsx" | wc -l` → 45 file):
- 40 file `components/wp/Wp*.tsx` (gồm cả 4 subfolder `cart/`, `checkout/`, `category-sidebar/`, `purchase/`), dùng ở ~45 file trong `app/`. Đây **không còn là "lớp port mỏng"** như giả định ban đầu — prefix `Wp` đã thành quy ước đặt tên cho gần như toàn bộ component layer (cart, checkout, catalog, header, footer, account, purchase…). Đổi tên/cấu trúc toàn bộ chỗ này có bán kính ảnh hưởng lớn hơn nhiều so với kế hoạch gốc → bắt buộc chia lô theo domain, không đổi hết cùng lúc.
- `components/wp/WpThemeStylesheet.tsx`: cơ chế tự nạp/gỡ 8 bundle `public/wp-content/themes/bigbike/css/wp-theme-{auth,cart,category,checkout,home,news,product,static}.css` theo route. Vẫn còn nguyên, chưa đụng.
- Asset CSS tương ứng dưới `public/wp-content/themes/bigbike/`.

**Ngoài phạm vi — KHÔNG đụng (đây là tích hợp dữ liệu thật, không phải tàn dư UI):**
- `lib/utils/wp-media.ts` (`resolveWpUploadUrl`, `makeSlugThumbnailFallback`): resolve URL ảnh từ CDN cũ `cdn.bigbike.vn` + proxy MinIO cho trang `/tin-tuc`. Được đổi tên file/hàm nếu cần nhất quán, nhưng logic resolve, các path pattern (`/wp-content/uploads/`, `/media-proxy/wp-uploads/`, `/wp-uploads/`) và output phải giữ **y hệt byte-for-byte**.
- Rewrite `/wp-content/uploads/:path*` trong `next.config.ts` (dòng ~335) và exclude tương ứng trong `proxy.ts` matcher — URL public thật đang phục vụ ảnh legacy, không phải kiến trúc port cần dọn.
- `docs/prompts/dong-bo-ui-ux-responsive-theo-wp.md`, `docs/prompts/BAOCAO-lech-ui-wp-parity.md` và tài liệu đối chiếu UI-với-site-WP-gốc khác trong `docs/prompts/` — mục đích QA parity (so khớp UI với site cũ), không phải nợ kỹ thuật cần dọn.
- Đã có một đợt refactor "reuse/dedup" chạy trước, độc lập với việc gỡ port WP (xem `docs/audits/reuse-refactor-plan.md` + `docs/audits/reuse-refactor-results.md`). Đọc 2 file này trước khi bắt đầu — chúng đã chạm một phần các file trong danh sách trên (vd. đã gom `wp-media.ts`, đã thay `WpPagination` bằng `PaginationNav`) và có nhiều quyết định **Confirmed-Deferred** (hoãn có lý do). Không làm lại hoặc đảo ngược quyết định đã chốt ở đó mà không hỏi trước.

**Độ phủ test hiện tại — "test pass" KHÔNG đồng nghĩa "UI không đổi":**
- `playwright.config.ts`: chỉ 1 project — Chromium (Desktop Chrome). Không Firefox, không WebKit/Safari.
- `e2e/visual.e2e.ts` là file **duy nhất** so pixel thật (`toHaveScreenshot`). Chỉ cover **2/9 viewport** trong ma trận `e2e/helpers/viewports.ts` (`MOBILE` = 390×844, `DESKTOP` = 1440×900 — bỏ qua 2 tablet + 3 desktop size lớn hơn), và chỉ ~9 vùng/trang: header, footer, mobile bottom-nav, 1 product card, search overlay, mobile menu drawer, full-page home/PLP/PDP. Full-page cho phép lệch tới **6% pixel** (`maxDiffPixelRatio: 0.06`) mà vẫn pass. `dynamicMasks()` che hoàn toàn `img`, `video/iframe`, `.swiper`, hero banner, cart badge, chat FAB khỏi so sánh.
- `e2e/responsive.e2e.ts` quét 11 route × cả 9 viewport nhưng chỉ kiểm **tràn ngang** + **thanh cố định vừa viewport** — không so pixel.
- Hệ quả: checkout, giỏ hàng, tài khoản, đăng nhập/đăng ký, danh mục/thương hiệu chi tiết, tin tức, tìm kiếm, trang CMS tĩnh (`/lien-he`, `/gioi-thieu`, `/chinh-sach/*`…) **không có baseline pixel nào**; vùng ảnh/carousel/hero/badge trên MỌI trang cũng không được so pixel. Một lô "tất cả test xanh" vẫn có thể làm lệch UI ở các route/vùng này mà không ai biết — việc phải làm thêm cho từng lô: xem mục 5.

## 1. RÀNG BUỘC TUYỆT ĐỐI — không được vi phạm

1. **UI/UX phải giữ nguyên 1:1.** Không đổi bố cục, khoảng cách, màu, font, animation, hành vi cuộn, sticky/headroom, drawer, hover, focus, trạng thái loading/empty/error, thứ tự tab/phần tử, ở **mọi breakpoint** (mobile / tablet / desktop). Coi bộ snapshot Playwright visual là "hợp đồng UI": pixel đổi = regression cho tới khi tôi duyệt.
2. **Không đổi logic nghiệp vụ.** Giá, tồn kho, giỏ hàng, thanh toán, đơn hàng, tài khoản, bảo hành, đổi trả, tìm kiếm, lọc/sắp xếp, phân trang, i18n (next-intl, route tiếng Việt), SEO/metadata/JSON-LD, analytics (GTM/Sentry) phải cho **kết quả y hệt**.
3. **Không đụng backend.** Không sửa endpoint, shape request/response, header, query param, contract trong `lib/api/*`, `lib/contracts/*`, `lib/schemas/*`. Không đổi biến môi trường, secrets, hay luồng `@t3-oss/env-nextjs`. Giữ guard `npm run check:no-runtime-business-data` luôn pass.
4. **Không đổi URL/route.** Mọi đường dẫn tiếng Việt (`/danh-muc-san-pham`, `/thanh-toan`, `/tai-khoan`, …) giữ nguyên để không vỡ SEO/redirect.
5. **Không đụng `lib/utils/wp-media.ts` và rewrite `/wp-content/uploads/:path*`** (`next.config.ts` + `proxy.ts`). Đây là tích hợp ảnh legacy thật (CDN `cdn.bigbike.vn` cũ) cho `/tin-tuc`, không phải tàn dư UI cần xoá — xem mục 0. Chỉ được đổi tên nếu cần, logic/path/output phải giữ y hệt.
6. **Không thêm tính năng, không đổi nội dung chữ, không đổi dependency lớn** trừ khi để gỡ theme WP và đã nêu trong kế hoạch được duyệt.
7. **Không refactor "vô hình".** Mỗi thay đổi phải qua được lưới test + visual diff trước khi đi tiếp.

## 2. Lưu ý Next.js 16 (BẮT BUỘC đọc trước khi viết code)

Đây **không phải** Next.js bạn quen — bản này có breaking changes về API, quy ước, cấu trúc file. Trước khi sửa bất kỳ thứ gì liên quan, **đọc tài liệu trong `node_modules/next/dist/docs/`** (đặc biệt phần App Router, CSS, `<Script>`, metadata, caching/ISR) và tuân theo mọi deprecation notice. Đối chiếu `AGENTS.md`. Không suy diễn theo trí nhớ cũ.

## 3. Phạm vi refactor (việc PHẢI làm)

**A. Gỡ lớp port WordPress còn lại → React/Tailwind thuần**
- Đổi tên/di chuyển 40 file `components/wp/Wp*.tsx` (gồm subfolder `cart/`, `checkout/`, `category-sidebar/`, `purchase/`) sang tên & vị trí Next.js idiomatic theo domain (vd. `components/layout/`, `components/catalog/`, `components/cart/`, `components/checkout/`, `components/account/`…), cập nhật toàn bộ ~45 điểm import trong `app/`. Đây là phần việc lớn nhất và rủi ro nhất — nhiều điểm import, có test đi kèm (`WpProductSwipeItem.test.tsx`, `WpPurchaseSection.test.tsx`) phải đổi song song. Chia lô theo domain (vd. lô "layout" gồm `WpHeader`/`WpFooter`/`WpMenuClient`/…, lô "cart", lô "checkout", lô "catalog", lô "account"…), không đổi tất cả cùng lúc.
- Thay `WpThemeStylesheet.tsx` (tự nạp/gỡ `wp-theme-*.css` per-route qua `useServerInsertedHTML` + DOM link tự quản) bằng CSS Module / Tailwind theo từng route. File này giải quyết đúng vấn đề "React/Next.js không tự gỡ stylesheet khi điều hướng client" (dẫn thẳng `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`) — đọc kỹ comment trong file trước khi thay, và giải pháp thay thế **phải giữ đúng tính chất đó**: không chớp trắng UI, không lẫn CSS giữa 2 route khi chuyển trang nhanh.
- Port nội dung 8 file `public/wp-content/themes/bigbike/css/wp-theme-{auth,cart,category,checkout,home,news,product,static}.css` sang Tailwind utility / token trong `styles/brand-tokens.css` + `app/globals.css`, theo từng route tương ứng với việc thay `WpThemeStylesheet`. Chỉ xoá asset CSS cũ + thư mục `public/wp-content/themes/` sau khi đã port xong và verify không lệch UI (visual snapshot pass).
- `WpThemeInteractions.tsx` đã là React thuần (jQuery/`home.min.js` đã gỡ ở lần refactor trước — xem mục 0). Việc còn lại với file này chỉ là đổi tên/di chuyển, **không cần viết lại logic**.
- Dọn class CSS còn sót kiểu `bb-theme`/`bb-main` nếu không còn ai dùng sau khi port CSS xong.
- Mục tiêu cuối: không còn bundle `wp-theme-*.css`, không còn thư mục `public/wp-content/themes/`, không còn prefix `Wp` trong component layer. **Giữ nguyên** `lib/utils/wp-media.ts` và rewrite `/wp-content/uploads/:path*` — xem mục 0 và ràng buộc #5 ở mục 1, đây không thuộc phạm vi dọn.

**B. Clean code chung**
- Xóa dead code, import/export/biến/file không dùng, comment lỗi thời.
- Tách component & file quá lớn thành đơn vị nhỏ, một trách nhiệm.
- Đặt tên & cấu trúc thư mục nhất quán; gom logic trùng lặp về `lib/`.
- Gom CSS rời rạc/`!important`/style kế thừa từ WP về Tailwind utility + token trong `styles/brand-tokens.css` và `app/globals.css`.
- Siết TypeScript: bỏ `any` không cần, dùng type từ `lib/contracts`/`lib/schemas`; sửa hết cảnh báo lint.

## 4. Quy trình theo giai đoạn

Làm tuần tự, **mỗi giai đoạn dừng lại báo cáo và chờ tôi duyệt** trước khi sang giai đoạn sau. Không gộp nhiều giai đoạn.

**Giai đoạn 0 — Khảo sát & lập bản đồ (chưa sửa code).** Mục 0 ở trên là bản đồ sơ bộ đã verify tại 2026-07-10 — **chạy lại các lệnh liệt kê ở đó trước** để xác nhận số liệu còn đúng (file có thể đã đổi tiếp từ lúc viết prompt này). Sau đó bổ sung: import graph đầy đủ giữa các file `Wp*` (ai import ai, để suy ra thứ tự đổi tên an toàn — file lá trước, file bị import nhiều nơi làm sau), "điểm nóng" cần clean thêm (file lớn, trùng lặp, dead code) ngoài những gì mục 0 đã liệt kê. Đọc `docs/audits/reuse-refactor-plan.md` + `docs/audits/reuse-refactor-results.md` trước khi lập kế hoạch, để không giẫm lên quyết định đã chốt ở đợt refactor dedup trước. Nộp lại: bản đồ phụ thuộc đầy đủ + **kế hoạch chia lô** đề xuất (thứ tự, rủi ro, cách verify từng lô). Chờ duyệt.

**Giai đoạn 1 — Dựng lưới an toàn.** Chạy và xác nhận pass toàn bộ: `npm run lint`, `npm run test`, `npm run build`, `npm run test:e2e`. Chụp **baseline** visual/responsive/effects (`npm run test:e2e:visual`, `:responsive`, `:effects`) làm mốc so sánh. Báo cáo trạng thái gốc + lỗi sẵn có (nếu có) trước khi đụng vào — lưu ý baseline có thể **đã có lỗi/fail sẵn từ trước, không do refactor này** (xem tiền lệ ở `docs/audits/reuse-refactor-results.md` mục 0); không tự sửa các lỗi đó trừ khi được yêu cầu riêng.

**Giai đoạn 2 → N — Refactor theo lô nhỏ.** Đề xuất thứ tự an toàn (gợi ý: clean code thuần không-rủi-ro trước → tách CSS theo route (mục 3.A ý 2-3) → đổi tên/dời `Wp*` theo domain, domain rủi ro thấp trước (mục 3.A ý 1) → gỡ asset WP cuối cùng khi không còn ai tham chiếu). Mỗi lô: phạm vi nhỏ (một domain / một route), đảm bảo route/breakpoint liên quan đã có baseline snapshot được duyệt trước khi sửa (mục 5), tự kiểm bằng cổng verify ở mục 5, **1 commit/lô** với mô tả rõ "trước/sau", rồi báo cáo và chờ tín hiệu đi tiếp.

## 5. Cổng verify BẮT BUỘC sau mỗi lô

Một lô chỉ "xong" khi tất cả pass:
- `npm run lint` (gồm `check:no-runtime-business-data`) — sạch.
- `npm run test` (vitest) — pass.
- `npm run build` — không lỗi, không cảnh báo mới.
- `npm run test:e2e` + `test:e2e:visual` + `:responsive` + `:effects` — **không có** visual diff ngoài ý muốn. Nếu snapshot đổi: mặc định coi là regression, dừng và giải thích, chờ tôi duyệt — **không tự cập nhật snapshot**.
- **Trước khi bắt đầu một lô đụng CSS hoặc một route cụ thể:** kiểm tra route đó đã có baseline trong `e2e/visual.e2e.ts` ở đúng breakpoint bị ảnh hưởng chưa (mặc định chỉ có 2/9 viewport — xem mục 0). Nếu chưa có: **thêm test snapshot cho đúng route/breakpoint đó trước, chạy lấy baseline, báo tôi duyệt baseline — rồi mới refactor route đó.** Không refactor route chưa có lưới chụp lại được.
- **Vùng bị `dynamicMasks()` che** (ảnh, video/iframe, carousel/swiper, hero banner, cart badge, chat FAB) không được Playwright so sánh. Sau mỗi lô đụng tới các vùng này: tự chụp/so sánh thủ công before/after (trình duyệt thật hoặc screenshot tay), đính kèm trong báo cáo lô — không suy ra "không đổi" chỉ vì test xanh.
- Nêu rõ trong báo cáo lô rằng bộ test chỉ chạy Chromium (không Firefox/WebKit) — giới hạn đã biết, không tự mở rộng browser trừ khi được yêu cầu riêng, nhưng phải nói rõ để biết phạm vi đã-kiểm-tra thực sự.
- Tự rà: route/URL, i18n, metadata/JSON-LD, analytics không đổi; không lộ business data vào runtime.

## 6. Quy tắc làm việc

- **Plan-first:** không sửa code khi kế hoạch lô chưa được duyệt.
- **Lô nhỏ, commit nhỏ:** không refactor lan man ngoài phạm vi lô hiện tại.
- **Dừng và hỏi tôi khi:** phát hiện hành vi WP không thể tái lập 1:1 bằng React, một thay đổi buộc phải chạm UI/nghiệp vụ/backend, snapshot đổi mà bạn cho là "đúng", hoặc một quyết định trong `docs/audits/reuse-refactor-*.md` có vẻ mâu thuẫn với việc bạn sắp làm.
- **Không** tự ý nâng cấp dependency, đổi config build/CI, hay đổi env.
- **Không** đụng `lib/utils/wp-media.ts`, rewrite `/wp-content/uploads/:path*`, hay tài liệu `docs/prompts/*wp*` — xem mục 0 và ràng buộc #5 ở mục 1, ngoài phạm vi tuyệt đối.
- Báo cáo ngắn gọn sau mỗi lô: đã làm gì, file nào đổi, kết quả cổng verify, đề xuất lô kế tiếp.

## 7. Định nghĩa HOÀN THÀNH

Component layer & CSS sạch dấu vết theme WP: không còn prefix `Wp` trong `components/`/`app/`, không còn bundle `wp-theme-*.css`, không còn thư mục `public/wp-content/themes/` (jQuery/`home.min.js` đã gỡ từ đợt trước, không thuộc phạm vi lần này); kiến trúc đúng chất Next.js 16. **Giữ nguyên, không đổi:** `lib/utils/wp-media.ts`, rewrite `/wp-content/uploads/:path*` (tích hợp ảnh legacy thật). **UI/UX, nghiệp vụ, backend, route, i18n, SEO, analytics không đổi**; toàn bộ cổng verify ở mục 5 pass — bao gồm baseline snapshot cho mọi route/breakpoint bị đụng và xác nhận thủ công cho vùng bị `dynamicMasks()` che, không chỉ dựa vào "test xanh"; lịch sử commit theo lô rõ ràng, dễ review/rollback.

**Bắt đầu bằng Giai đoạn 0 và chờ tôi duyệt.**
