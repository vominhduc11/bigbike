# Bộ template nhập sản phẩm BigBike — Hướng dẫn cho AI & người dùng

Chỉ còn **1 file duy nhất**: `mau-day-du.json`. Mỗi object trong mảng = **một sản phẩm hoàn chỉnh** (hàng hoá + nội dung). Nạp ở trang quản trị: **Sản phẩm → Nhập từ file**, hai bước *Kiểm tra* (xem trước, chưa lưu) → *Xác nhận nhập* (lưu thật).

> **Trước đây** bộ này gồm 2 file (CSV hàng hoá + JSON nội dung, khớp nhau bằng SKU). **Từ 2026-07-06 gộp về 1 file JSON** — file JSON chứa được trọn vẹn cả hàng hoá (giá, kho, ảnh, biến thể, SEO) lẫn nội dung (mô tả, FAQ, dải tin cậy, cam kết, video…), nên không cần CSV nữa.

---

## ⛔ 5 quy tắc BẮT BUỘC (sai là hỏng)

1. **`sku` và `categoryId` là bắt buộc ở mọi object.** `categoryId` là **slug danh mục** (ví dụ `mu-bao-hiem`), `brandId` là **slug thương hiệu** (ví dụ `ls2`) — **KHÔNG** phải mã nội bộ dạng `cat_...`/`brand_...`. Khi **tạo mới** phải có thêm `name` (tiếng Việt) và `translations.en.name` (tiếng Anh) — thiếu tên tiếng Anh sẽ báo lỗi dòng đó.
2. **Mọi ảnh phải nằm trong kho ảnh của shop (MinIO).** Dùng đường dẫn `/media/...` **hoặc** URL đầy đủ `https://media.bigbike.vn/bigbike-media/...`. **KHÔNG** dán ảnh từ host ngoài (Google Drive, Imgur, CDN bên thứ ba, link `bigbike.vn/wp-content/...` cũ) — sẽ bị loại và sản phẩm mất ảnh. Chưa có ảnh trong kho → **để trống**, bổ sung sau trong trang quản trị.
3. **JSON KHÔNG được có khoá lạ.** Chỉ dùng đúng các khoá liệt kê bên dưới. Thừa 1 khoá (kể cả khoá ghi chú `_comment`) → **cả file bị từ chối**. Muốn ghi chú thì ghi ở file hướng dẫn này, không ghi trong file JSON.
4. **KHÔNG để chữ nháp lọt ra khách:** bỏ hết `[Cần ảnh: ...]`, `[gắn link]`, `[Bigbike kiểm tra bổ sung]`. Link sản phẩm khác phải là URL thật hoặc bỏ.
5. **URL (canonical, link nội dung) dùng tên miền thật** (`bigbike.vn`), **không** dùng địa chỉ máy chủ thử nghiệm (`http://103.x.x.x:...`).

> Import **luôn tạo sản phẩm ở trạng thái Nháp** và **bỏ qua "Đã xuất bản"**. Sau khi nạp xong, vào trang quản trị **bấm đăng tay** để lên web.

---

## Cấu trúc file: mảng `[ { sản phẩm 1 }, { sản phẩm 2 } ]`

Mỗi sản phẩm dùng các khoá sau. **Khoá nào không có nội dung thì bỏ hẳn khoá đó**, đừng để rỗng vô nghĩa. Khi cập nhật lại: khoá không đưa vào → dữ liệu cũ **giữ nguyên** (xem "Cập nhật sản phẩm đã có").

### Nhận diện & hàng hoá
| Khoá | Kiểu | Ghi chú |
|---|---|---|
| `sku` | chuỗi | **BẮT BUỘC.** Mã model — dùng để đối chiếu cập nhật (trùng SKU → cập nhật đúng sản phẩm thay vì tạo trùng). |
| `slug` | chuỗi | Đường dẫn trang (ví dụ `scs-cam-s`). |
| `name` | chuỗi | Tên tiếng Việt. |
| `categoryId` | chuỗi | **BẮT BUỘC.** slug danh mục (ví dụ `mu-bao-hiem`). |
| `brandId` | chuỗi | slug thương hiệu (ví dụ `ls2`). |
| `gender` | chuỗi | `Nam` / `Nữ` / `Unisex`, hoặc bỏ. |
| `retailPrice` | số | Giá bán lẻ (VNĐ, số nguyên, **không** dấu phẩy/chấm ngăn cách). |
| `salePrice` | số | Giá khuyến mãi (tuỳ chọn). |
| `image` | obj | Ảnh đại diện: `{ "url": "...", "alt": "..." }`. |
| `gallery` | mảng | Thư viện ảnh: `[ { "url": "...", "alt": "...", "sortOrder": 0 } ]`. |
| `shortDescription` | chuỗi | Mô tả ngắn (HTML đơn giản). |
| `specificationsHtml` | chuỗi | Bảng thông số kỹ thuật (HTML thô). |
| `seo` | obj | `{ "title": "...", "description": "...", "canonicalUrl": "https://bigbike.vn/product/..." }`. |
| `variants` | mảng | Biến thể (màu/size) — xem dưới. |
| `relatedProductIds` | mảng chuỗi | SKU sản phẩm liên quan. Chỉ nên trỏ SKU **đang Đã xuất bản**. |
| `accessoryProductIds` | mảng chuỗi | SKU phụ kiện bán kèm (cùng lưu ý trên). |

### Biến thể — `variants` (nếu sản phẩm có màu/size)
Mỗi biến thể:
```json
{ "sku": "MDS-CAB-TANCAR-BK-XS",
  "options": [ { "optionName": "Size", "optionValue": "XS" } ],
  "retailPrice": 12000000, "salePrice": null, "isAvailable": true,
  "imageUrl": "/media/...", "imageAlt": "..." }
```
- `sku` **bắt buộc, duy nhất** cho mỗi biến thể. Hệ thống đối chiếu biến thể **theo SKU** khi cập nhật → giữ lịch sử tồn kho, không xoá nhầm.
- `options`: mỗi thuộc tính một cặp `optionName`/`optionValue` (ví dụ `{ "optionName": "Màu", "optionValue": "Đen" }`, `{ "optionName": "Size", "optionValue": "L" }`). Tên biến thể tự sinh từ options — không nhập tay.

### Tiếng Anh — `translations`
```json
"translations": { "en": {
  "name": "...", "shortDescription": "...", "specificationsHtml": "...",
  "seoTitle": "...", "seoDescription": "..." } }
```
`translations.en.name` **nên có** (bắt buộc khi tạo mới). Các trường EN khác tuỳ chọn.

---

## Nội dung marketing (tuỳ chọn — bỏ khoá nào không có)

### Quick Answer — `quickAnswerSummary`
Chuỗi thường (không HTML), **40–60 từ**, tối đa 600 ký tự. Tóm tắt sản phẩm là gì / cho ai / giá.

### Ô số liệu nổi bật — `specStats` (**tối đa 4**)
Mỗi ô: `{ "value": "~35h", "label": "Pin nghe nhạc", "valueEn": "~35h", "labelEn": "Music battery", "sortOrder": 1 }`
`value` ≤60 ký tự, `label` ≤80. Đây là **con số bán hàng** (pin, tầm xa, chống nước…), không phải bảng thông số.

### Dải tin cậy — `trustBadges` (tối đa 12)
Mỗi mục: `{ "content": "Bảo hành 24 tháng chính hãng", "contentEn": "24-month official warranty", "sortOrder": 1 }` — `content` ≤200 ký tự.

### Cam kết — `commitments` (tối đa 12, hiện dưới nút mua)
Mỗi mục: `{ "icon": "shield-check", "title": "Bảo hành 24 tháng", "subtitle": "Thiết bị chính hãng", "titleEn": "...", "subtitleEn": "...", "sortOrder": 1 }`
`title` ≤200, `subtitle` ≤300. **`icon` chỉ nhận 12 key sau** (key lạ → tự đổi thành `shield-check`):
`truck` · `refresh-cw` · `shield-check` · `badge-check` · `credit-card` · `headphones` · `package` · `gift` · `clock` · `map-pin` · `wrench` · `award`

### Ưu điểm / Nhược điểm — `positiveNotes` / `negativeNotes` (mỗi bên tối đa 20)
Mỗi mục: `{ "content": "Pin ~35h, ít phải sạc", "contentEn": "~35h battery", "sortOrder": 1 }` — `content` ≤2000 ký tự.

### Câu hỏi thường gặp — `faqs` (tối đa 50)
Mỗi mục: `{ "question": "...?", "answer": "<p>Câu trả lời, cho phép HTML.</p>", "questionEn": "...?", "answerEn": "<p>...</p>", "sortOrder": 1 }`
`question` ≤500, `answer` ≤20000 (HTML đơn giản: `<p> <strong> <ul> <li>`).

### Video (mục riêng) — `videos` (tối đa 20)
Mỗi mục: `{ "url": "https://www.youtube.com/watch?v=XXXXXXXXXXX", "provider": "youtube", "title": "...", "description": "...", "sortOrder": 1 }`
`provider` chỉ nhận: **`youtube` · `tiktok` · `facebook` · `upload`** (nền tảng khác bị cấm). Link phải **đầy đủ** (không dùng link rút gọn `youtu.be`/`vt.tiktok.com`/`fb.watch`). `upload` = video đã ở trong kho (`/media/...`). Không có video → **bỏ khoá `videos`**.

### Mô tả chi tiết — `descriptionBlocks` / `descriptionBlocksEn`
Mảng các khối. Các loại khối dùng cho sản phẩm:

- **Tiêu đề:** `{ "type": "heading", "level": 2, "text": "..." }` (`level` = 2 hoặc 3)
- **Đoạn văn:** `{ "type": "paragraph", "html": "<p>...</p>" }`
- **Danh sách:** `{ "type": "list", "style": "bulleted", "items": ["...", "..."] }` (`style` = `bulleted`|`numbered`)
- **Tính năng (Lợi ích/Bằng chứng/Hạn chế):** `{ "type": "feature", "subheading": "Nhãn ngắn", "heading": "Tiêu đề tính năng", "html": "<p><strong>Lợi ích:</strong></p><p>...</p>" }`
- **Phù hợp với ai:** `{ "type": "suitability", "title": "PHÙ HỢP VỚI AI", "cards": [ { "audience": "Nhóm khách", "advice": "Lời khuyên" } ] }`
- **Bảng size:** `{ "type": "sizeGuide", "title": "Bảng size", "html": "<table>...</table><p>Cách đo...</p>" }` — đây là **nguồn hiển thị bảng size trên web**.

> Ảnh trong `html` cũng phải theo quy tắc MinIO (`/media/...` hoặc `https://media.bigbike.vn/bigbike-media/...`). Không nhúng `<img src="link ngoài">`.

---

## Cập nhật nội dung cho sản phẩm ĐÃ CÓ sẵn (không tạo mới)

Muốn sửa/bổ sung cho sản phẩm **đã đăng bán** (thêm FAQ, sửa mô tả, đổi giá…) → nạp lại file JSON chỉ chứa những sản phẩm đó. Nguyên tắc an toàn (đã kiểm tra trong code):

- Vẫn phải có `sku` (khớp đúng sản phẩm đã tồn tại) và `categoryId` (điền đúng slug danh mục hiện tại, kể cả khi không đổi danh mục).
- Khoá **không đưa vào file** → dữ liệu hiện có của khoá đó **giữ nguyên, không đổi, không mất**. Đây là lý do luôn nhắc "khoá nào không có nội dung thì bỏ hẳn khoá đó".
- Khoá **có đưa vào** trong số `specStats`, `trustBadges`, `commitments`, `positiveNotes`, `negativeNotes`, `faqs`, `videos`, `gallery`, `variants` → **thay thế toàn bộ danh sách cũ bằng danh sách mới**, không cộng dồn. Muốn giữ mục cũ + thêm mục mới → phải liệt kê lại **đầy đủ cả cũ lẫn mới** trong cùng mảng đó.
- `descriptionBlocks` / `descriptionBlocksEn` cũng thay thế toàn bộ — sửa 1 đoạn vẫn phải dán lại **nguyên mảng khối mô tả đầy đủ** của sản phẩm đó (lấy từ trang quản trị hoặc từ file tải về), không chỉ đoạn muốn sửa.

> Mẹo: bấm **"Tải dữ liệu hiện tại"** trong hộp thoại Nhập để tải về file JSON **đầy đủ** của toàn bộ sản phẩm hiện có — sửa trực tiếp trên đó rồi nạp lại là an toàn nhất (đúng cấu trúc, không sót khoá).

---

## Prompt mẫu để đưa cho AI

```
Bạn tạo dữ liệu nhập sản phẩm cho cửa hàng BigBike theo ĐÚNG template đính kèm
(mau-day-du.json). Với mỗi sản phẩm tôi cung cấp, hãy trả về MỘT object JSON trong
một mảng JSON duy nhất, gồm:

- Hàng hoá: sku, slug, name, categoryId (slug danh mục), brandId (slug thương hiệu),
  gender, retailPrice, salePrice, image, gallery, shortDescription, specificationsHtml,
  seo, và variants nếu có màu/size.
- Tiếng Anh: translations.en (ít nhất name).
- Nội dung: descriptionBlocks, quickAnswerSummary, specStats (tối đa 4), trustBadges,
  commitments (icon đúng trong 12 key cho phép), positiveNotes, negativeNotes, faqs,
  và sizeGuide (khối trong descriptionBlocks) nếu là đồ mặc/mũ.

BẮT BUỘC:
- Mỗi object có sku + categoryId; categoryId/brandId là SLUG, không phải mã nội bộ.
- Mọi ảnh dùng /media/... hoặc https://media.bigbike.vn/bigbike-media/... ; chưa có
  ảnh thì để trống.
- JSON chỉ chứa các khoá trong hướng dẫn, KHÔNG thêm khoá lạ, KHÔNG thêm ghi chú.
- Không để chữ nháp [Cần ảnh]/[gắn link]; link sản phẩm khác dùng URL thật hoặc bỏ.
- Nội dung tiếng Việt có dấu đầy đủ, đúng chính tả.
```

Kiểm tra sau khi AI trả về: mở JSON bằng công cụ kiểm tra (jsonlint) xem có hợp lệ không; rà mọi ảnh đều thuộc kho MinIO; rà `categoryId`/`brandId` đúng slug.
