# Finding: đường dẫn tiếng Anh của sản phẩm bị mất âm thầm (`slug_en`)

- **Status:** FIXED 2026-08-06 (F-1, F-2, F-3); F-4 ghi nhận là hành vi chốt, không sửa.
- **Trigger:** báo lỗi từ owner — mở `/admin/products/wp-prod-35026`, tab EN, ô "Đường dẫn"
  luôn trống; nhập rồi Lưu báo thành công nhưng ô trống lại, tải lại trang vẫn mất.

## F-1 — Root cause: `normalizeProduct` bỏ sót `slugEn` (ĐÃ SỬA)

- **Location:** `bigbike-admin/src/lib/contracts.js` → `normalizeProduct()`.
- **Evidence:** hàm lọc response theo danh sách trắng và không liệt kê `slugEn`, trong khi hai hàm
  anh em cùng file có đủ — `normalizeCategory` và `normalizeContentItem`. Mọi lệnh đọc/ghi sản phẩm
  đều đi qua nó (`adminApi.js` → `parseDetailPayload(payload, normalizeProduct)`).
  Backend không hề sai: `products.slug_en` có dữ liệu, `Product` record trả `slugEn` top-level,
  `GET /api/v1/products/scs-s7x-motorcycle-bluetooth-helmet-headset` trả đúng giá trị.
- **Impact:** hai tầng.
  1. Hiển thị: `buildFormFromItem` đọc `item.slugEn` ra `undefined` → ô EN luôn trống, kể cả sau khi
     lưu thành công (`saveMutation.onSuccess` dựng lại form từ response cũng qua normalizer này).
  2. **Mất dữ liệu:** vì form nạp rỗng, bất kỳ lần Lưu nào cũng gửi `translations.en.slug` rỗng;
     `ProductFieldApplier.applyTranslations` full-replace → ghi `slug_en = NULL`.
     Số đo lúc phát hiện: **85/321 sản phẩm** đang có `slug_en` nằm trong diện rủi ro.
- **Fix:** thêm `slugEn` vào `normalizeProduct`. Test chặn hồi quy:
  `src/lib/contracts.product.test.js` + nhánh EN trong `ProductDetailScreen.test.jsx`
  (mock `contentLang` trước đây khoá cứng `'vi'` nên toàn bộ nhánh EN chưa từng được kiểm).

## F-2 — Nhập hàng loạt xoá `slug_en` + `origin_brand_country_en` (ĐÃ SỬA)

- **Location:** `bigbike-backend/.../service/admin/ProductImportService.java` →
  `backfillTranslationsFromExisting`.
- **Evidence:** hàm backfill 11/13 trường EN, thiếu `slug` và `originBrandCountry` — trong khi
  javadoc của chính nó cam kết một khối `translations.en` khai thiếu "must not silently wipe every
  other existing EN field".
- **Fix:** bổ sung 2 trường; hàm đổi sang `static` package-private để test trực tiếp (cùng khuôn
  `stripHighlightInlineImages`). Test: `ProductImportServiceTest`.

## F-3 — Link xem trước Google bản EN sai route (ĐÃ SỬA)

- **Location:** `bigbike-admin/src/screens/ProductDetailScreen.jsx`, khối SERP preview.
- **Evidence:** dựng `bigbike.vn/products/{slugEn}/` — thiếu prefix `/en`, dùng route danh sách
  (số nhiều), và hiện "Chưa có trang tiếng Anh" khi `slugEn` trống. `PRODUCT_RULE_003` quy định
  trang EN **luôn tồn tại** tại `/en/product/{slugEn hoặc slug}/`.
- **Fix:** thêm helper `englishUrlFromSlugs()` trong `product-detail/constants.js` + sửa câu gợi ý
  `products.detail.slugHintEn` (khoá `serpNoEnglishUrl` của sản phẩm đã gỡ vì không còn nơi dùng).

## F-4 — `slugEn` trùng `slug` VI của chính sản phẩm: KHÔNG chặn (chốt hành vi)

- **Location:** `bigbike-backend/.../service/admin/CatalogRequestValidator.java` →
  `validateEnglishSlug` (tham số `viSlug` không được dùng).
- **Evidence:** `DATA_CONTRACT.md`/`API_CONTRACT.md` từng mô tả case này phải trả `DUPLICATE`,
  nhưng code chưa từng chặn. Số đo: **13/321 sản phẩm** đang có `slug = slug_en`.
- **Decision (owner 2026-08-06):** **giữ nguyên, không chặn.** Sản phẩm mang tên vốn là tiếng Anh
  (mã máy: `komine-jk-176`, `rs-taichi-rsj345`, `scs-g7-plus` — 9/13 trường hợp) thì hai slug trùng
  nhau là hợp lệ. Chặn cứng sẽ khoá oan nhóm này. Thay vào đó màn hình quản trị hiện **cảnh báo mềm**
  (`FormField` có prop `warning` mới) để admin của sản phẩm tên tiếng Việt nhận ra nhập nhầm.
  Ràng buộc duy nhất **chéo sản phẩm** vẫn chặn cứng như cũ.
  Đã cập nhật `BUSINESS_RULES.md` (`PRODUCT_RULE_003`) + `API_CONTRACT.md` cho khớp code.

## Dữ liệu hỏng kèm theo

4/13 sản phẩm trùng slug có **tên tiếng Việt** nhưng slug VI đã bị thay bằng bản tiếng Anh:

| Sản phẩm | slug VI hiện tại | slug VI cũ (từ bảng `redirects`) |
|---|---|---|
| Tai nghe bluetooth SCS S7X (`wp-prod-35026`) | `scs-s7x-motorcycle-bluetooth-helmet-headset` | `tai-nghe-scs-s7x-bluetooth-cho-mu-bao-hiem` |
| Giày moto touring ILM M1006 | `ilm-m1006-touring-motorcycle-boots` | `ilm-m1006` |
| Túi đeo hông moto GIVI PWB05 | `givi-pwb05-motorcycle-waist-bag` | `givi-pwb05` |
| ÁO BẢO HỘ MOTO NỮ LS2 ZOOM LADY (`wp-prod-41190`) | `motorcycle-protective-jacket-for-women-ls2-zoom-lady-for-cold-weather` | không tìm được lịch sử |

Owner đã duyệt khôi phục; thực hiện qua API admin (không `UPDATE` thẳng DB) để hệ thống tự sinh
redirect 301 và làm mới cache web.

## Ghi chú phụ (chưa sửa, ngoài phạm vi)

- `audit_logs` cho PRODUCT không lưu bất kỳ khoá `_en` nào (`slugEn`, `nameEn`, …) → mọi thay đổi
  phía tiếng Anh không truy vết được. Chính điều này khiến F-1 khó chẩn đoán.
- `translations.en.sizeGuide` là **write-only**: request nhận và ghi vào `size_guide_en`, nhưng
  `ProductTranslations.ProductContent` không có field này và `toDomain` đọc `entity.getSizeGuide()`
  không qua resolve locale → dữ liệu lưu rồi không bao giờ hiện lại.
- `JpaCatalogReadSupport.toTranslations` gate `anyEnglish` không xét `slugEn` → sản phẩm chỉ có
  slug EN sẽ trả `translations: null`.
