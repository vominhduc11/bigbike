---
name: admin-module-audit
description: "Dùng khi cần audit và sửa toàn diện một module quản trị đã tồn tại trong bigbike-admin, thường là cặp list/detail screen của một entity như Brand, Category hoặc Product. Xác minh lifecycle, song ngữ, SEO, permission và API bằng docs plus code thật; không copy rule từ module khác; sửa trong phạm vi module; bổ sung test; và báo cáo rõ phần chưa chạy."
---

# admin-module-audit — Audit & sửa toàn diện 1 module quản trị

Sửa toàn diện `<Module>ListScreen.jsx` + `<Module>DetailScreen.jsx` trong bigbike-admin và mọi file 2 màn hình đó import trực tiếp — **không sửa lan sang module khác**.

> **Chọn đúng skill:** quét hết mọi module admin → dùng `admin-audit-all` (nó sẽ áp dụng skill này cho từng module). Audit một tính năng đi xuyên web + admin + máy chủ → dùng `feature-audit`. **Làm mới** một tính năng qua cả 3 app → dùng `feature-build`. Skill này chỉ dành cho audit **một** module admin đã có.

**Bài học bắt buộc nhớ trước khi bắt đầu:** Brand và Category cùng là "catalog taxonomy" nhưng khác nhau ở gần như mọi trục — số cờ trạng thái (1 hay 2), có cây cha-con hay không, mô hình song ngữ (dùng chung 1 giá trị hay dịch riêng thật), mặc định `showOnHomepage` khi tạo mới (`true` vs `false`), có endpoint preview trước xóa vĩnh viễn hay không. **Không bao giờ copy nguyên rule từ module đã audit trước sang module đang làm** — luôn đọc lại docs + code thật của chính module này, kể cả khi nó "nhìn giống" module cũ.

## ⚠️ Chế độ chạy liên tục — KHÔNG dừng giữa chừng để xin duyệt

Một lần gọi = **làm hết module trong phiên**. Không hỏi "có làm tiếp không?", không dừng giữa các bước để chờ duyệt. User gọi skill này nghĩa là đã đồng ý cho chạy tới xong.

- Các mốc P0→P3 chạy nối tiếp. In 1 dòng tiến độ sau mỗi mốc để user theo dõi — **không chờ trả lời**.
- **Gặp điểm cần owner quyết → hỏi user bằng 2–4 phương án cụ thể**. Dùng công cụ hỏi-chọn nếu môi trường có sẵn; nếu không có, đặt câu hỏi ngắn trong chat và chỉ tạm dừng phần phụ thuộc quyết định đó.
  - Gom 2–4 câu hỏi một lần thay vì hỏi lắt nhắt; hỏi ngay nếu phần còn lại phụ thuộc vào câu đó.
  - Mỗi câu 2–4 phương án cụ thể, phương án đề xuất để đầu ghi "(Đề xuất)", mô tả bằng **hậu quả vận hành** chứ không bằng thuật ngữ kỹ thuật.
  - Trả lời xong: áp dụng ngay, cập nhật docs nếu là rule, rồi đi tiếp — không hỏi lại "có tiếp không?".
  - Owner chọn "để sau" → gác món đó vào Known limitation và làm tiếp phần còn lại.
- **Chỉ dừng hẳn khi:** xong module, hoặc user bảo dừng.

## Ràng buộc chung (áp dụng mọi bước)

- Docs-first: mở đầu bằng bảng tra "sửa cái này thì đọc docs nào" trong `CLAUDE.md` (hoặc `AGENTS.md` §3–§4) để chốt danh sách docs phải đọc — chỉ đọc đúng section liên quan. Nếu docs ghi `NEEDS_VERIFICATION` / `NOT_FOUND_IN_REPO` / `CONFLICTING_EVIDENCE` cho điều cần biết → **không bịa** permission/field/lifecycle/validation/side effect; gác món phụ thuộc rule đó vào "Cần owner quyết" và **làm tiếp phần còn lại**.
- **Không tự "fix" thứ đã được `docs/audits/` ghi nhận là code bug** — đó là task riêng của owner. Gặp thì ghi vào phần Known limitation của báo cáo, không sửa.
- Không tạo mock runtime (guard `check:no-admin-runtime-mock` sẽ chặn).
- Không CSS class mới, CSS module mới, style inline, arbitrary Tailwind value, hay class `bb-*` mới — dùng Tailwind token + shadcn/ui + component admin hiện có. Font/màu theo `admin-tokens.css`, không hardcode hex.
- Keyboard navigation + focus visible; label/aria-label tiếng Việt có dấu đầy đủ; không raw `<button>/<input>/<select>` khi đã có primitive shadcn (`src/components/ui/`); không hiển thị `null`/`undefined`/`NaN`/`[object Object]`; fallback rõ ràng khi thiếu dữ liệu; màu avatar/logo chữ cái ổn định theo id/slug, không đổi theo thứ tự dòng.
- Chỉ đọc/sửa `bigbike-backend` + OpenAPI khi contract hiện tại thiếu hoặc lệch code thật — không thêm migration nếu không thật sự cần.

## Thứ tự ưu tiên + checkpoint (đọc trước khi bắt tay)

Module lớn không chắc làm hết trong một lượt. **Làm theo đúng thứ tự ưu tiên dưới, không nhảy cóc**, và khi hết ngân sách thì dừng ở ranh giới sạch rồi khai báo phần đã hoãn — **tuyệt đối không im lặng bỏ bước cuối** (đã xảy ra thật: Category audit xong nhưng không có file Vitest nào, trong khi Brand có).

| Ưu tiên | Nội dung | Được phép hoãn? |
|---|---|---|
| **P0** | Bước 0–3: lifecycle/song ngữ/permission/contract THẬT + mọi sai lệch hành vi (sai rule, sai dialog, sai filter, thiếu khóa record hệ thống) | ❌ Không |
| **P1** | Bước 4–5: đủ state (loading/empty/error/read-only/busy/409), a11y, mobile, i18n | ❌ Không |
| **P2** | Bước 7: Vitest cho List + Detail | ❌ Không |
| **P3** | Playwright lifecycle spec + visual regression + ảnh 3 viewport | ✅ Được, nếu khai báo rõ lý do |

Sau mỗi mốc P, in 1 dòng tiến độ ngắn rồi **sang mốc kế ngay** — không chờ user duyệt.

## Bước 0 — Xác định module + đọc đúng docs của RIÊNG module này

1. Tìm 2 file màn hình: `bigbike-admin/src/screens/<Module>ListScreen.jsx` và `<Module>DetailScreen.jsx` (glob nếu tên không khớp 100%, ví dụ số ít/nhiều). Tìm thư mục con cùng tên nếu có (`<module>-list/`, `<module>-detail/`) — mọi file trong đó đều thuộc phạm vi bắt buộc.
2. Dùng `rg` tìm tiền tố rule của module trong `docs/business/BUSINESS_RULES.md` — đọc toàn bộ rule của module (kể cả rule mới sửa gần đây, ghi ngày).
3. Đọc `docs/business/STATE_MACHINES.md` — tìm đúng section entity. Nếu entity share section với entity khác (như Brand/Category share "Category / Brand State Machine") thì chỉ áp dụng phần mô tả **riêng cho entity đang audit** — đừng lấy nhầm phần của entity kia. Đối chiếu luôn bảng tóm tắt đầu file với phần chi tiết cuối file — hai chỗ từng lệch nhau (bảng gộp field mà phần chi tiết tách riêng).
4. Đọc `docs/engineering/API_CONTRACT.md` + `docs/engineering/DATA_CONTRACT.md` — đúng section entity: field, translations, SEO, Trash flow.
5. Đọc `docs/engineering/PERMISSION_MATRIX.md` — permission key thật. Nhiều module dùng chung 1 key với module khác (ví dụ Brand/Category cùng `catalog.read`/`catalog.update`, không có key riêng) — đừng suy đoán key riêng nếu docs không ghi. **Ghi lại key này, Bước 4 sẽ dùng.**

## Bước 1 — Xác lập lifecycle THẬT (đọc entity + service backend, đừng đoán)

- Có mấy cờ trạng thái? 1 cờ gộp Trash+hiển thị (kiểu Brand: `isVisible`) hay 2 cờ độc lập (kiểu Category: `deleted` + `isVisible`) hay hoàn toàn khác (workflow nhiều state kiểu Order)?
- Có `DELETE .../{id}` (soft-delete), `POST .../{id}/restore`, `DELETE .../{id}/permanent` không? Có endpoint preview ảnh hưởng trước xóa vĩnh viễn không (như Category's `permanent-delete-impact`, trả số liệu TRƯỚC khi xác nhận), hay số liệu chỉ trả SAU khi xóa xong (như Brand)?
- Có "record hệ thống" bị khóa cứng không (như `uncategorized-brand`/`uncategorized`)? Nếu có: nó bị ẩn khỏi list admin hay vẫn hiện nhưng khóa thao tác ghi? **Kiểm tra riêng từng nút** trong hàm render action của hàng danh sách — khóa 1 nút (vd nút Xóa) không chứng minh các nút khác (vd toggle ẩn/hiện) cũng đã khóa; đã từng phát hiện gap kiểu này.
- Xóa vĩnh viễn có side-effect reassignment dữ liệu liên quan không? Vô điều kiện (mọi bản ghi liên kết đều chuyển) hay có điều kiện (chỉ bản ghi mất hết liên kết mới chuyển)? Field trả về tên gì, một số hay nhiều số?
- Có cấu trúc cha-con/cây không? Nếu có: ẩn cha còn con hiển thị có bị chặn (409) không — chặn theo con trực tiếp hay đệ quy toàn cây? Trash (soft-delete/restore/permanent) có cascade toàn bộ cây không, vô điều kiện hay có check riêng?

## Bước 2 — Xác lập mô hình song ngữ THẬT

- Tên/slug dùng chung 1 giá trị cho VI/EN (kiểu Brand — không có editor riêng cho EN) hay dịch riêng thật qua `translations.en.*`/`nameEn`/`slugEn` (kiểu Category)?
- Field EN nào bắt buộc khi lưu (chặn lưu nếu thiếu) theo `TRANSLATION_RULE_00x`, field nào tùy chọn và fallback về VI?
- `slugEn` có đang hoạt động thật (unique riêng, tự sinh redirect 301 khi đổi/xóa) hay chỉ là cột legacy admin không ghi/sửa?
- SEO có theo đúng cơ chế presence-flag chung (`ProductFieldApplier`/tương đương): không gửi `seo` → giữ nguyên; gửi `seo: {}` → xóa hết kể cả ảnh chia sẻ? Form phải luôn gửi block `seo` khi lưu, và dùng `SeoCard` có sẵn (`src/components/SeoCard.jsx`) chứ không dựng lại form SEO riêng.
- `showOnHomepage` (nếu module có) độc lập với mọi cờ trạng thái — xác nhận giá trị mặc định thật khi tạo mới không gửi field (đã thấy Brand mặc định `true`, Category mặc định `false` — hai module khác nhau, đừng copy).

**Lưu ý phân biệt:** "song ngữ của DỮ LIỆU" (mục này) khác "song ngữ của GIAO DIỆN" (Bước 6). Giao diện admin khóa tiếng Việt nhưng vẫn đi qua i18n — không được hardcode chuỗi.

## Bước 3 — Đối chiếu OpenAPI vs code thật — đừng tin OpenAPI hay comment cũ mù quáng

`bigbike-openapi.json` **thường lệch code thật** (đã xác nhận thực tế: spec Category thiếu 3 path + 2 param + ghi sai default). Với mỗi endpoint của module:
1. Đọc trực tiếp Controller (`AdminXxxController.java` hay tương đương) — đây là nguồn sự thật cuối cùng.
2. So với OpenAPI — path/param/default nào thiếu hoặc sai thì ghi lại để sửa ở Bước 8.
3. Đừng tin Javadoc/comment cũ trong code — đối chiếu logic method thật (đã từng gặp comment mô tả sai hành vi, gắn nhầm lên method khác).

## Bước 4 — Audit List screen

**Component có sẵn — mở rộng chứ không copy, và lấy đúng đường dẫn:**

| Từ `src/components/layout/` (có barrel `index.js`) | Từ `src/components/` (import trực tiếp) |
|---|---|
| `Screen`, `ScreenHeader`, `FilterBar`, `MobileCardList`/`MobileCard`, `StickyActionBar`, `FormField`, `Modal`, `Tabs` | `AdminTable`, `StatusBadge`, `PaginationControls`, `PageSizeSelect`, `FilterSelect`, `FilterSearchInput`, `FilterChips`, `BulkActionBar`, `ReadOnlyBanner`, `StatePanel`, `ScreenSkeleton`, `ConfirmDialog`, `ColumnVisibilityToggle`, `ExportButton`, `SectionCard`, `DetailSection`, `SeoCard` |

Ngoài ra: `showConfirm()` ở `src/lib/confirm.js` cho xác nhận nhanh; primitive shadcn ở `src/components/ui/`. `SectionCard` **phải** dùng bản chung, không copy bản riêng vào screen.

- Desktop: hàng ≥48px, cột dễ quét (ảnh, tên, slug, các trạng thái liên quan, cập nhật lần cuối, thao tác), không hero/campaign UI.
- Mobile: `MobileCardList`, vùng chạm thao tác ≥44px, focus keyboard rõ ràng.
- Filter: tìm kiếm, đúng số filter trạng thái theo lifecycle thật ở Bước 1 (KHÔNG gộp 2 filter nếu module có 2 cờ độc lập), pagination + page size nếu component hỗ trợ, hiển thị filter đang áp dụng (`FilterChips`), nút "Làm mới", giữ dữ liệu cũ + báo "Đang cập nhật" khi đổi filter/refresh.
- State phải xử lý đủ: loading lần đầu, refreshing, empty toàn bộ, empty sau filter, error/retry, unknown status, not found, read-only, action busy/success/failure, pagination không hợp lệ, bản ghi thiếu ảnh/slug/dữ liệu phụ.
- Quyền: đọc đúng key đã ghi ở **Bước 0 mục 5** và route guard hiện tại; chỉ có quyền đọc → `ReadOnlyBanner` ở đầu trang + ẩn/disable thao tác ghi với `aria-disabled` (không chỉ disable bằng CSS).
- Thao tác: đúng những gì code hiện có, không tự thêm/bớt. Mỗi dialog phải nói đúng hành vi thật — nếu module có 2 khái niệm tách biệt (vd "ẩn khỏi web" khác "xóa mềm/Thùng rác" như Category) thì dialog phải phân biệt rõ, không dùng chung 1 câu mơ hồ. Cancel không gọi API; Confirm hiện busy + chặn submit lặp; sau thành công refresh đúng filter hiện tại; 409/403/404/lỗi mạng có message phân biệt rõ nguyên nhân (đặc biệt nhiều loại 409 khác nhau thì không gộp chung 1 thông báo).

## Bước 5 — Audit Detail screen

- Header dùng `dl/dt/dd` cho metadata, dùng cùng component trạng thái với list.
- Form chỉ hiển thị field có thật trong DTO/API hiện tại — không tự thêm field. Xử lý đủ: tạo mới, chỉnh sửa, dữ liệu thiếu, field trống, lỗi validation, trùng giá trị unique (tên/slug…) nếu backend trả lỗi, unsaved changes, save busy/success/failure, 409 từ record hệ thống hoặc xung đột dữ liệu, luôn gửi block `seo` nếu module có SEO.
- Panel hành động: desktop có thể sticky, mobile dùng `StickyActionBar`, nút Lưu ≥44px, trạng thái disabled/busy rõ ràng. Không tự thêm thao tác/workflow ngoài những gì contract/code hiện có (đừng tự thêm nút xóa mềm/khôi phục vào Detail nếu code hiện tại chỉ đặt 2 hành động đó ở List).
- Media (nếu có): loading, lỗi tải có fallback, alt text đúng vai trò từng ảnh (đừng dùng chung 1 alt nếu module có nhiều vai trò ảnh khác nhau), không có ảnh phải có trạng thái rõ ràng, ảnh hỏng không vỡ layout. Lightbox/media picker có sẵn (`MediaPickerModal`, `MediaPreviewLightbox`) phải giữ keyboard navigation, Escape, focus trap.
- Link nội bộ (sản phẩm/entity liên quan): tooltip đúng hành vi điều hướng thật, không tự ghi "mở tab mới" hay thêm `target="_blank"` nếu UI hiện tại chỉ điều hướng nội bộ.

## Bước 6 — i18n giao diện (bắt buộc, đừng bỏ qua)

Admin chạy qua `react-i18next`. Mọi chuỗi hiển thị — tiêu đề, nhãn, placeholder, nút, toast, aria-label, thông báo lỗi, tên cột, nội dung dialog — phải qua `t('...')`.

- Thêm/sửa key phải cập nhật **cả hai** file: `src/locales/vi.json` và `src/locales/en.json`. Thiếu file EN → chữ tiếng Việt lọt sang bản EN (lỗi đã gặp thật).
- Không hardcode chuỗi tiếng Việt thẳng trong JSX; không để key thừa không ai dùng.
- Namespace/khóa đặt theo đúng nhóm module đang có trong file locale, không tự đẻ cấu trúc mới.
- Tiếng Việt phải **có dấu đầy đủ**, không mojibake.

## Bước 7 — Test

**Đọc mẫu trước khi viết** (bám theo, không phát minh convention mới):

| Loại | File mẫu |
|---|---|
| Vitest List/Detail | `src/screens/BrandListScreen.test.jsx`, `src/screens/BrandDetailScreen.test.jsx` |
| Playwright lifecycle | `e2e/specs/brand-lifecycle.spec.ts`, `e2e/specs/category-lifecycle.spec.ts` |
| Fixture/login | `e2e/fixtures/admin-test.ts` |
| Viewport matrix | `e2e/utils/viewports.ts` (dùng hằng số ở đây, đừng hardcode số) |
| Visual regression | `e2e/specs/visual.spec.ts` |

- Unit/component (Vitest, chạy bằng `npm run test` trong `bigbike-admin`) cho List + Detail, bám đúng lifecycle/song ngữ/SEO đã xác lập ở Bước 1-2 (đừng copy ma trận test từ module khác đã audit trước): mọi state ở Bước 4-5, mọi transition lifecycle thật (kể cả các nhánh 409), khóa record hệ thống, song ngữ bắt buộc/tùy chọn đúng rule, SEO preserve/null/empty object, confirm cancel/confirm, busy/success/failure, 403/404/409, ảnh loading/error/fallback.
- Backend test bám đúng contract thật của module: filter list, create/update, mọi transition lifecycle (kể cả nhánh chặn — ví dụ ẩn cha còn con hiển thị nếu module có cây), permission read-only/write, 403/404/409.
- Playwright: dùng `/e2e <module>` (quy trình đầy đủ: fixture đăng nhập, helper, tiền tố `E2E_<MODULE>_`, ảnh so sánh, giới hạn tốc độ đăng nhập). Kiểm đủ luồng list/detail/filter/tạo/sửa/mọi transition lifecycle/confirm cancel-confirm/lỗi/refresh; viewport 1440/768/375.

## Bước 8 — Nếu phải sửa API/contract (chỉ khi Bước 3 phát hiện lệch)

1. Cập nhật `API_CONTRACT.md` (+ `DATA_CONTRACT.md`/`STATE_MACHINES.md` nếu chạm) trước.
2. Cập nhật OpenAPI — bù đúng gap đã ghi ở Bước 3 (path thiếu, param thiếu, default sai).
3. Cập nhật backend test.
4. Sau đó mới sửa frontend.

## Bước 9 — Ảnh màn hình trước/sau

Dùng skill `run-bigbike-admin` (driver Playwright committed) để chụp màn hình thật trên container `:4000` — không tự `npm run dev`, không tự start/restart stack. Driver tự đăng nhập SUPER_ADMIN và báo lỗi console/API. Chụp cả List + Detail ở 1440, 768, 375. Nếu container không chạy → **không tự bật**, ghi `Not run: hệ thống chưa chạy` và **đi tiếp Bước 10**, không dừng phiên vì thiếu ảnh.

## Bước 10 — Đóng gate + báo cáo

1. Dùng skill `hygiene` — bắt dead CSS, mojibake/mất dấu, business-data hardcode.
2. Dùng skill `preflight` — tối thiểu admin `npm run lint` + `npm run test` + `npm run build`; thêm `./mvnw test` nếu đã sửa backend; Playwright liên quan module.

**Definition of Done** — tick đủ mới được gọi là xong:

- [ ] P0: lifecycle/song ngữ/permission/SEO đã xác minh bằng code thật, không suy đoán từ module khác
- [ ] P1: đủ state + a11y + mobile + i18n 2 file locale
- [ ] P2: Vitest List + Detail có và pass
- [ ] Docs/OpenAPI đã update nếu Bước 3 phát hiện lệch
- [ ] `hygiene` + `preflight` pass, hoặc ghi rõ `Not run: <lý do>`
- [ ] Mọi phần hoãn đã được khai báo rõ trong báo cáo

Báo cáo cuối phải gồm:
- File đã thay đổi.
- Docs/contract/OpenAPI đã cập nhật (nếu có), kèm evidence path.
- Lifecycle/song ngữ/permission/SEO đã xác minh là gì THẬT SỰ cho module này (nói rõ, không mặc định giống module khác).
- Ảnh trước/sau ở 1440, 768, 375.
- Kết quả lint, unit test, backend test, Playwright — ghi `Not run: <lý do>` nếu không chạy được, không bịa pass.
- Known limitation/blocker còn lại + phần đã hoãn (kèm lý do).
