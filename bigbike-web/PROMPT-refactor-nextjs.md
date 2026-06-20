# Prompt: Refactor `bigbike-web` về đúng chất Next.js (gỡ lớp port WordPress)

> Dán toàn bộ nội dung dưới đây cho Claude Code khi mở tại thư mục `bigbike-web`.

---

Bạn là kỹ sư phụ trách refactor dự án **bigbike-web** (Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4). Nhiệm vụ: **clean code toàn bộ dự án và tái cấu trúc về đúng chất Next.js**, loại bỏ lớp "port theme WordPress cũ" (jQuery `home.min.js`, các bundle `wp-theme-*.css` nạp/gỡ động, prefix `Wp*`), thay bằng giải pháp React + Tailwind thuần.

Đây là refactor **bảo toàn hành vi** (behavior-preserving): chỉ đổi cách code được tổ chức và triển khai, **không** đổi thứ người dùng nhìn thấy hay nghiệp vụ chạy.

## 1. RÀNG BUỘC TUYỆT ĐỐI — không được vi phạm

1. **UI/UX phải giữ nguyên 1:1.** Không đổi bố cục, khoảng cách, màu, font, animation, hành vi cuộn, sticky/headroom, drawer, hover, focus, trạng thái loading/empty/error, thứ tự tab/phần tử, ở **mọi breakpoint** (mobile / tablet / desktop). Coi bộ snapshot Playwright visual là "hợp đồng UI": pixel đổi = regression cho tới khi tôi duyệt.
2. **Không đổi logic nghiệp vụ.** Giá, tồn kho, giỏ hàng, thanh toán, đơn hàng, tài khoản, bảo hành, đổi trả, tìm kiếm, lọc/sắp xếp, phân trang, i18n (next-intl, route tiếng Việt), SEO/metadata/JSON-LD, analytics (GTM/Sentry) phải cho **kết quả y hệt**.
3. **Không đụng backend.** Không sửa endpoint, shape request/response, header, query param, contract trong `lib/api/*`, `lib/contracts/*`, `lib/schemas/*`. Không đổi biến môi trường, secrets, hay luồng `@t3-oss/env-nextjs`. Giữ guard `npm run check:no-runtime-business-data` luôn pass.
4. **Không đổi URL/route.** Mọi đường dẫn tiếng Việt (`/danh-muc-san-pham`, `/thanh-toan`, `/tai-khoan`, …) giữ nguyên để không vỡ SEO/redirect.
5. **Không thêm tính năng, không đổi nội dung chữ, không đổi dependency lớn** trừ khi để gỡ jQuery/theme WP và đã nêu trong kế hoạch được duyệt.
6. **Không refactor "vô hình".** Mỗi thay đổi phải qua được lưới test + visual diff trước khi đi tiếp.

## 2. Lưu ý Next.js 16 (BẮT BUỘC đọc trước khi viết code)

Đây **không phải** Next.js bạn quen — bản này có breaking changes về API, quy ước, cấu trúc file. Trước khi sửa bất kỳ thứ gì liên quan, **đọc tài liệu trong `node_modules/next/dist/docs/`** (đặc biệt phần App Router, CSS, `<Script>`, metadata, caching/ISR) và tuân theo mọi deprecation notice. Đối chiếu `AGENTS.md`. Không suy diễn theo trí nhớ cũ.

## 3. Phạm vi refactor (việc PHẢI làm)

**A. Gỡ lớp port WordPress → React/Tailwind thuần**
- Thay thế `components/wp/WpThemeScripts.tsx` (jQuery + `home.min.js` + Swiper/headroom/lozad + polyfill `jquery.sticky`) bằng hành vi React tương đương: header sticky/headroom, hamburger + drawer, scroll-to-top, search toggle, rating, lazy-load ảnh. Tận dụng `swiper` (đã có trong deps) cho carousel; bỏ jQuery.
- Thay `components/wp/WpThemeStylesheet.tsx` (tự nạp/gỡ `wp-theme-*.css` per-page) bằng CSS Module / Tailwind theo từng route. Xử lý đúng vấn đề "stylesheet không gỡ khi điều hướng client" mà file gốc đã mô tả — đọc kỹ comment trong file đó trước khi thay.
- Di chuyển dần các component `Wp*` (`components/wp/*` và `Wp*` rải trong `app/*`) sang tên/cấu trúc Next.js idiomatic (vd. `layout/`, `catalog/`, `content/`). Dọn `lib/hooks/useDetachWpHandlers.ts`, `lib/wp-theme-routes.ts`, `lib/utils/wp-media.ts`, class `bb-theme`/`bb-main`, đường dẫn `/wp-content/themes/bigbike/*` khi không còn cần.
- Mục tiêu cuối: không còn jQuery, không còn `home.min.js`, không còn bundle `wp-theme-*.css`, không còn prefix `Wp`.

**B. Clean code chung**
- Xóa dead code, import/export/biến/file không dùng, comment lỗi thời.
- Tách component & file quá lớn thành đơn vị nhỏ, một trách nhiệm.
- Đặt tên & cấu trúc thư mục nhất quán; gom logic trùng lặp về `lib/`.
- Gom CSS rời rạc/`!important`/style kế thừa từ WP về Tailwind utility + token trong `styles/brand-tokens.css` và `app/globals.css`.
- Siết TypeScript: bỏ `any` không cần, dùng type từ `lib/contracts`/`lib/schemas`; sửa hết cảnh báo lint.

## 4. Quy trình theo giai đoạn

Làm tuần tự, **mỗi giai đoạn dừng lại báo cáo và chờ tôi duyệt** trước khi sang giai đoạn sau. Không gộp nhiều giai đoạn.

**Giai đoạn 0 — Khảo sát & lập bản đồ (chưa sửa code).** Lập bản đồ đầy đủ lớp WP: liệt kê mọi file/đường dẫn/asset/class/script thuộc theme WP, ai phụ thuộc ai, hành vi nào do `home.min.js` đảm nhiệm. Liệt kê các "điểm nóng" cần clean (file lớn, trùng lặp, dead code). Nộp lại: bản đồ phụ thuộc + **kế hoạch chia lô** đề xuất (thứ tự, rủi ro, cách verify từng lô). Chờ duyệt.

**Giai đoạn 1 — Dựng lưới an toàn.** Chạy và xác nhận pass toàn bộ: `npm run lint`, `npm run test`, `npm run build`, `npm run test:e2e`. Chụp **baseline** visual/responsive/effects (`npm run test:e2e:visual`, `:responsive`, `:effects`) làm mốc so sánh. Báo cáo trạng thái gốc + lỗi sẵn có (nếu có) trước khi đụng vào.

**Giai đoạn 2 → N — Refactor theo lô nhỏ.** Đề xuất thứ tự an toàn (gợi ý: clean code thuần không-rủi-ro trước → tách CSS theo route → thay từng hành vi JS của `home.min.js` bằng React → đổi tên/dời `Wp*` → gỡ asset WP cuối cùng). Mỗi lô: phạm vi nhỏ, tự kiểm bằng cổng verify ở mục 5, **1 commit/lô** với mô tả rõ "trước/sau", rồi báo cáo và chờ tín hiệu đi tiếp.

## 5. Cổng verify BẮT BUỘC sau mỗi lô

Một lô chỉ "xong" khi tất cả pass:
- `npm run lint` (gồm `check:no-runtime-business-data`) — sạch.
- `npm run test` (vitest) — pass.
- `npm run build` — không lỗi, không cảnh báo mới.
- `npm run test:e2e` + `test:e2e:visual` + `:responsive` + `:effects` — **không có** visual diff ngoài ý muốn. Nếu snapshot đổi: mặc định coi là regression, dừng và giải thích, chờ tôi duyệt — **không tự cập nhật snapshot**.
- Tự rà: route/URL, i18n, metadata/JSON-LD, analytics không đổi; không lộ business data vào runtime.

## 6. Quy tắc làm việc

- **Plan-first:** không sửa code khi kế hoạch lô chưa được duyệt.
- **Lô nhỏ, commit nhỏ:** không refactor lan man ngoài phạm vi lô hiện tại.
- **Dừng và hỏi tôi khi:** phát hiện hành vi WP không thể tái lập 1:1 bằng React, một thay đổi buộc phải chạm UI/nghiệp vụ/backend, hoặc snapshot đổi mà bạn cho là "đúng".
- **Không** tự ý nâng cấp dependency, đổi config build/CI, hay đổi env.
- Báo cáo ngắn gọn sau mỗi lô: đã làm gì, file nào đổi, kết quả cổng verify, đề xuất lô kế tiếp.

## 7. Định nghĩa HOÀN THÀNH

Toàn dự án sạch code, không còn dấu vết theme WP (jQuery/`home.min.js`/`wp-theme-*.css`/prefix `Wp`); kiến trúc đúng chất Next.js 16; **UI/UX, nghiệp vụ, backend, route, i18n, SEO, analytics không đổi**; toàn bộ cổng verify ở mục 5 pass; lịch sử commit theo lô rõ ràng, dễ review/rollback.

**Bắt đầu bằng Giai đoạn 0 và chờ tôi duyệt.**
