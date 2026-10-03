# Kiểm tra dữ liệu có cấu trúc trang sản phẩm — 23/09/2026

## Phạm vi và căn cứ

- Trang được đội SEO gửi: [Áo giáp Taichi RSJ729](https://bigbike.vn/product/ao-giap-moto-adventure-taichi-rsj729-drymaster-kompass/) và [kết quả Rich Results Test](https://search.google.com/test/rich-results/result?id=Owe7tHzoS_qEYbwqqFOCsA).
- Quy tắc chuẩn: `docs/business/BUSINESS_RULES.md` — `REVIEW_RULE_001`–`004`, `SEO_RULE_011`; `docs/engineering/DATA_CONTRACT.md` — "Product rating denormalization".
- Đường phát schema: `bigbike-web/app/[locale]/(storefront)/product/[slug]/page.tsx` → `bigbike-web/lib/seo/json-ld.ts`; phần HTML hiển thị trong `bigbike-web/components/catalog/PurchaseSection.tsx` và `purchase/RatingBlock.tsx`.
- Đầu quản trị `bigbike-admin/src/screens/ReviewListScreen.jsx` và `ReviewDetailScreen.jsx` duyệt review; máy chủ `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminReviewService.java` chỉ tính lại điểm/số lượt từ review `APPROVED` (đoạn `recomputeProductReviewAggregate`). Hai đầu này không gây ra khai báo trùng và không cần sửa.
- Kiểm tra đọc trên container `bigbike-postgres` sau `docker ps`: `SELECT p.id, p.sku, p.rating, p.rating_count, COUNT(r.id) FILTER (WHERE r.status = 'APPROVED') ... FROM products p LEFT JOIN reviews r ON r.product_id = p.id WHERE p.slug = 'ao-giap-moto-adventure-taichi-rsj729-drymaster-kompass' GROUP BY p.id, p.sku, p.rating, p.rating_count`. Kết quả: `rating = NULL`, `rating_count = 0`, `approved_reviews = 0`.

### F1 — Google thấy thêm một sản phẩm thiếu thông tin bán hàng

- **Mức độ:** Medium — lỗi SEO trên trang chi tiết; luồng bán hàng và giá khách thấy vẫn đúng.
- **Lệch ở đâu:** JSON-LD đã khai `ProductGroup` hợp lệ với 4 lựa chọn, mỗi lựa chọn có SKU, giá VND và tình trạng hàng. Khối HTML hiển thị sao lại tạo thêm một `Product` microdata chỉ có tên. Rich Results Test đánh dấu thực thể trùng `#__sid=md0` không hợp lệ vì thiếu `offers`, `review` hoặc `aggregateRating`.
- **Hậu quả vận hành:** Báo cáo Google có một mục sản phẩm lỗi dù khai báo bán hàng chính đã hợp lệ; đội SEO khó phân biệt lỗi thật với cảnh báo tùy chọn về đánh giá.
- **Cần owner quyết:** Không. `SEO_RULE_011` đã xác định một khai báo sản phẩm gốc theo giá/SKU thật; `REVIEW_RULE_001`–`004` cấm điểm và số review giả.
- **Đã sửa:** Làm rõ tài liệu chuẩn; gỡ Product/AggregateRating microdata trùng khỏi phần HTML; giữ nguyên sao, số lượt đánh giá và form khách viết đánh giá. JSON-LD vẫn khai `aggregateRating` khi có điểm và số review đã duyệt hợp lệ. Cập nhật kiểm thử giao diện cho cả sản phẩm có và chưa có review.
- **Còn xác minh:** Chạy lại Rich Results Test trên URL công khai sau khi bản web mới được triển khai. Với sản phẩm này, cảnh báo tùy chọn về `review`/`aggregateRating` có thể còn vì hiện chưa có review được duyệt; không tạo dữ liệu ngẫu nhiên để xóa cảnh báo.

## Kiểm tra

- `npm test -- components/catalog/PurchaseSection.test.tsx __tests__/seo/json-ld.test.ts`: đạt 45/45.
- `npm test -- __tests__/merchant/variant-link.test.ts`: đạt 4/4.
- `npm run lint`: đạt.
- `npm run build`: đạt.
- `npx prettier --check components/catalog/PurchaseSection.tsx components/catalog/purchase/RatingBlock.tsx components/catalog/PurchaseSection.test.tsx`: đạt.
- Dựng bản web vừa build trên cổng tạm `3107`, đọc HTML qua HTTP rồi tắt cổng: URL trong báo cáo Google trả 200, có đúng một `ProductGroup`, 4 biến thể với SKU/Offer thật và không có Product microdata trùng. Bản EN cũng có một `ProductGroup`; URL chọn sẵn biến thể có một `Product` với SKU/Offer; một sản phẩm đơn đang bán có một `Product` với SKU/Offer. Không đổi container production.
- Truy vấn đọc trên `bigbike-postgres` không tìm thấy sản phẩm `PUBLISHED` nào đang có `rating_count > 0`; trường hợp có đánh giá thật được kiểm bằng fixture trong unit test, chưa thể đối chiếu trên trang bán hàng thật.
- Hygiene: không đổi CSS; quét các file TSX đã sửa không thấy mojibake/HTML numeric escape; guard dữ liệu business hardcode đạt trong `npm run lint`.

## Bổ sung 24/09/2026 — F2: biến thể thiếu màu trong Merchant listings

- Mở chính kết quả Rich Results Test đã chia sẻ bằng trình duyệt: Google quét lúc 15:14 ngày 23/09 (giờ Việt Nam), trước khi image web chứa bản sửa F1 được nạp lúc 22:22. Kết quả cũ có thêm 4 Merchant listings không hợp lệ; mỗi biến thể báo lỗi quan trọng `Missing field "color"`, ngoài các cảnh báo tùy chọn về mô tả, giao hàng và đổi trả. Product snippets còn một Product microdata trùng thiếu `offers` (F1) và một ProductGroup hợp lệ với cảnh báo tùy chọn `review`/`aggregateRating`.
- **Nguyên nhân F2 vẫn có trên bản live trước lần sửa này:** `ProductGroup.variesBy` khai `https://schema.org/color`, nhưng `buildVariantProductJsonLd` chưa lấy `options[].value` của từng biến thể để phát `color`. Public API xác nhận 4 giá trị thật: ĐEN, ĐEN ĐỎ, KHAKI, XÁM; không cần suy từ tên hay thêm dữ liệu giả.
- **Đã sửa:** `SEO_RULE_011` quy định thuộc tính biến thể lấy đúng lựa chọn có giá trị. JSON-LD giờ phát `color`/`size` theo lựa chọn thực trên cả `hasVariant` và URL chọn sẵn; `variesBy` chỉ liệt kê chiều có giá trị ở mọi biến thể. Không đổi API, dữ liệu sản phẩm hoặc giao diện.
- **Kiểm tra:** `npm test -- __tests__/seo/json-ld.test.ts __tests__/merchant/variant-link.test.ts` đạt 32/32; `npm run lint`, ESLint/Prettier trên tệp đã sửa và `git diff --check` đạt. `docker compose --env-file .env.vps build bigbike-web` tạo image cuối `sha256:ea55a28cb5aa6713cb0f562e68454ba6ca67b41f0a38a896ded7c9ba59955058`; `up -d --no-deps --no-build bigbike-web` nạp đúng image này và container `healthy`. HTML công khai của sản phẩm có một `ProductGroup`, 4 SKU/Offer với 4 màu thật, không có Product microdata trùng; URL `?variant=wp-var-34436` có một `Product` với SKU, Offer và màu ĐEN.
- **Giới hạn xác minh:** Rich Results Test mới từ môi trường kiểm tra trả `Something went wrong — Log in and try again`, nên chưa có kết luận Google mới. Link kết quả cũ là snapshot trước triển khai và không tự cập nhật. Các cảnh báo tùy chọn về review/rating vẫn đúng khi sản phẩm chưa có review được duyệt; không điền điểm giả.
