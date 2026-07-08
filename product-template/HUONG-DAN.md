# Bộ template nhập sản phẩm BigBike — Hướng dẫn cho AI & người dùng

Chỉ còn **1 file duy nhất**: `mau-day-du.json`. Mỗi object trong mảng = **một sản phẩm hoàn chỉnh** (hàng hoá + nội dung). Nạp ở trang quản trị: **Sản phẩm → Nhập từ file**, hai bước *Kiểm tra* (xem trước, chưa lưu) → *Xác nhận nhập* (lưu thật).

> **Trước đây** bộ này gồm 2 file (CSV hàng hoá + JSON nội dung, khớp nhau bằng SKU). **Từ 2026-07-06 gộp về 1 file JSON** — file JSON chứa được trọn vẹn cả hàng hoá (giá, kho, ảnh, biến thể, SEO) lẫn nội dung (mô tả, FAQ, dải tin cậy, cam kết, video…), nên không cần CSV nữa.
>
> **Từ 2026-07-07: mỗi cột song ngữ gộp chung thành 1 object lồng nhau** ngay tại vị trí cột đó — ví dụ tên sản phẩm giờ là `"name": { "nameVI": "...", "nameEN": "..." }` thay vì `"name": "..."` ở ngoài + `translations.en.name` ở một khối riêng cuối object. Khoá `translations` cấp cao nhất **không còn tồn tại**. Nút **"Tải dữ liệu hiện tại"** cũng trả về đúng shape mới này — nhập và xuất luôn khớp nhau.
>
> **Cũng từ 2026-07-07: "Phù hợp với ai" và "Bảng size" tách khỏi `descriptionBlocks`** thành 2 khoá riêng cấp cao nhất `suitabilitySection`/`sizeGuideSection` (đảo lại quyết định trước đó là để chúng làm khối `type: "suitability"`/`"sizeGuide"` trong mảng mô tả) — trình dựng mô tả trên trang quản trị giờ chỉ còn 4 loại khối: tiêu đề đoạn văn/ảnh/tính năng.
>
> **Từ 2026-07-07: cột tiếng Việt và tiếng Anh của MỌI cặp song ngữ luôn xuất hiện song song trên file XUẤT RA, mỗi khi object/khối đó đã được dùng.** Bấm **"Tải dữ liệu hiện tại"** (hoặc tải 1 sản phẩm) in đủ cả 2 vế của mỗi cặp VI/EN — từng phần tử trong các mảng (`faqs[]`, `commitments[]`, `highlights.positiveNotes/negativeNotes[]`), và từng khối trong `descriptionBlocks` (`text/textEn`, `html/htmlEn`, `items/itemsEn`, `alt/altEn`, `caption/captionEn`, `subheading/subheadingEn`, `heading/headingEn`) cũng như `suitabilitySection`/`sizeGuideSection` khi 2 khoá này có được dùng (`title/titleEn`, `html/htmlEn`) — **vế nào chưa có nội dung thì hiện `null`, không còn bị bỏ hẳn khoá**. Nhưng nếu cả object/mảng đó không được dùng đến (vd sản phẩm không có FAQ nào, hoặc không dùng `sizeGuideSection`) thì khoá cha vẫn **bỏ hẳn** như trước — quy tắc chỉ null-fill 2 vế của một cặp đã tồn tại, không tự tạo ra khối rỗng.
>
> **Từ 2026-07-07 (mới nhất — quyết định của chủ shop): riêng nhóm object cấp sản phẩm sau LUÔN xuất hiện trên file XUẤT RA, kể cả khi sản phẩm không có nội dung gì cho khoá đó** (khác với mảng/khối ở trên — nhóm này không bị bỏ hẳn dù rỗng hoàn toàn): `shortDescription`, `specifications`, `specStats`, `trustBadges`, `quickAnswerSummary`, `originBrandCountry`, `seo` (`titleVI/EN`, `descriptionVI/EN`; `canonicalUrl` không tính). Sản phẩm không có dữ liệu nào ở khoá đó → cả 2 vế VI/EN hiện `"...": null` thay vì bỏ hẳn cả khoá. `name`/`slug` luôn có sẵn (bắt buộc) nên trong thực tế luôn xuất hiện, không đổi gì. **Ngoại lệ đã chốt từ trước — không áp dụng quy tắc này:** `image` (ảnh đại diện) và `gallery` (bộ sưu tập ảnh) vẫn bỏ hẳn khoá khi không dùng, y như `videos`/`variants`/các mảng khác — nhóm ảnh không phải cặp song ngữ và có ý nghĩa PATCH riêng (chỉ áp dụng lúc tạo mới).
>
> Quy tắc "song song VI/EN" này **chỉ áp dụng cho file XUẤT RA**. Khi bạn tự soạn file NHẬP VÀO (tạo mới hoặc cập nhật), vẫn được **bỏ hẳn** một vế (hoặc cả object/cả khối, kể cả với nhóm cấp sản phẩm luôn-xuất-hiện ở trên) không có nội dung như trước — hệ thống không phân biệt được "khoá vắng mặt" với "khoá có giá trị `null`" khi đọc file (JSON `null` và khoá bị bỏ hẳn được xử lý giống hệt nhau lúc nhập), nên cách viết nào cũng hợp lệ. `canonicalUrl` (trong `seo`) và những khoá không phải cặp song ngữ (`sortOrder`, `icon`, `id`, `sku`, `retailPrice`…) không nằm trong quy tắc null-fill — vẫn bỏ hẳn khi không có nội dung, không ghi `null`.
>
> **Cũng từ 2026-07-07: `salePrice` (Giá sale) luôn xuất hiện trên file XUẤT RA**, ở cả cấp sản phẩm và từng biến thể trong `variants[]` — sản phẩm/biến thể nào không giảm giá thì hiện `"salePrice": null` thay vì bị bỏ hẳn khoá. **Riêng khi tự soạn file NHẬP VÀO để cập nhật biến thể đã có sẵn, `variants[].salePrice` KHÔNG giống các khoá khác ở trên** — ghi tường minh `"salePrice": null` sẽ **xoá thật** giá khuyến mãi đang có của biến thể đó; muốn giữ nguyên giá khuyến mãi hiện tại (không đổi gì), bắt buộc phải **bỏ hẳn khoá** `salePrice` ra khỏi biến thể đó, không được ghi `null`. (`salePrice` cấp sản phẩm thì null hay bỏ hẳn khoá đều an toàn như nhau — không xoá nhầm dữ liệu.)
>
> **Từ 2026-07-07: `retailPrice`/`salePrice` cấp sản phẩm có thể làm "giá chung" cho biến thể chưa tự khai giá riêng.** Trước đây, sản phẩm có `variants[]` thì **mỗi biến thể bắt buộc phải tự có `retailPrice` riêng**, không có ngoại lệ. Nay: nếu sản phẩm **có** `retailPrice` cấp sản phẩm hợp lệ (`> 0`), biến thể nào **không** khai `retailPrice` riêng sẽ **tự dùng trọn giá chung đó** (cả `retailPrice` lẫn `salePrice` cấp sản phẩm) làm giá hiệu lực — hiển thị lẫn tính tiền. Biến thể nào **có** khai `retailPrice` riêng thì dùng đúng giá (và `salePrice`) riêng đó, **không** rơi về giá chung nữa dù không khai `salePrice` riêng (biến thể đó xem như không giảm giá, chứ không tự lấy `salePrice` chung). **Nếu sản phẩm không có `retailPrice` cấp sản phẩm hợp lệ VÀ biến thể cũng không có `retailPrice` riêng → vẫn báo lỗi** (không có giá nào để dùng). **Cấm:** biến thể có `salePrice` riêng mà KHÔNG có `retailPrice` riêng — bị từ chối lúc lưu, vì `salePrice` đó sẽ bị bỏ qua âm thầm nếu không có `retailPrice` riêng đi kèm.

---

## ⛔ 5 quy tắc BẮT BUỘC (sai là hỏng)

1. **`categoryId` là bắt buộc ở mọi object — kể cả khi chỉ cập nhật sản phẩm đã có.** `categoryId` là **slug danh mục** (ví dụ `mu-bao-hiem`), `brandId` là **slug thương hiệu** (ví dụ `ls2`) — **KHÔNG** phải mã nội bộ dạng `cat_...`/`brand_...`. Khi **tạo mới** phải có `name.nameVI` và `name.nameEN` — thiếu tên tiếng Anh sẽ báo lỗi dòng đó. Khi **cập nhật** sản phẩm cũ: nếu file **không** đổi tên, có thể bỏ hẳn khoá `name` (tên VI/EN cũ được giữ nguyên); nhưng nếu file **có** đổi `nameVI`, bắt buộc phải kèm `nameEN` mới trong cùng khoá `name` đó.
   - **Ma trận bắt buộc theo có/không biến thể (PRODUCT_RULE_005, áp dụng ngay cả khi import, vì import gọi thẳng luồng lưu sản phẩm thường):** Luôn bắt buộc: `name` (khi tạo mới)/`categoryId`/`brandId`/`gender`. Sản phẩm **KHÔNG có `variants`**: `sku` và `retailPrice` **cấp sản phẩm** cũng bắt buộc — thiếu 1 trong 2 sẽ báo lỗi dòng đó. Sản phẩm **CÓ `variants`**: `sku` cấp sản phẩm vẫn bắt buộc; mỗi phần tử trong `variants[]` bắt buộc phải có `sku` riêng — còn `retailPrice` riêng của từng biến thể **chỉ bắt buộc nếu sản phẩm không có `retailPrice` cấp sản phẩm hợp lệ** làm giá chung thay thế (xem mục Biến thể và ghi chú "giá chung" ở đầu file, 2026-07-07). Ảnh (`image`, `variants[].imageUrl`) **không bao giờ bắt buộc lúc import** vì import luôn tạo Nháp — ảnh chỉ bắt buộc khi admin bấm "Đăng" thủ công sau đó trong trang quản trị.
2. **Mọi ảnh phải nằm trong kho ảnh của shop (MinIO).** Dùng đường dẫn `/media/...` **hoặc** URL đầy đủ `https://media.bigbike.vn/bigbike-media/...`. **KHÔNG** dán ảnh từ host ngoài (Google Drive, Imgur, CDN bên thứ ba, link `bigbike.vn/wp-content/...` cũ) — sẽ bị loại và sản phẩm mất ảnh. Chưa có ảnh trong kho → **để trống**, bổ sung sau trong trang quản trị. **Chỉ áp dụng khi tạo sản phẩm mới** — nạp lại file cho sản phẩm **đã có sẵn** thì `image`/`gallery`/`videos`/ảnh biến thể trong file **bị bỏ qua hoàn toàn**, ảnh/video cũ trên hệ thống luôn được giữ nguyên (xem mục "Cập nhật sản phẩm đã có").
3. **JSON KHÔNG được có khoá lạ.** Chỉ dùng đúng các khoá liệt kê bên dưới. Thừa 1 khoá (kể cả khoá ghi chú `_comment`) → **cả file bị từ chối**. Muốn ghi chú thì ghi ở file hướng dẫn này, không ghi trong file JSON.
4. **KHÔNG để chữ nháp lọt ra khách:** bỏ hết `[Cần ảnh: ...]`, `[gắn link]`, `[Bigbike kiểm tra bổ sung]`. Link sản phẩm khác phải là URL thật hoặc bỏ.
5. **URL (canonical, link nội dung) dùng tên miền thật** (`bigbike.vn`), **không** dùng địa chỉ máy chủ thử nghiệm (`http://103.x.x.x:...`).

> Import **luôn tạo sản phẩm ở trạng thái Nháp** và **bỏ qua "Đã xuất bản"**. Sau khi nạp xong, vào trang quản trị **bấm đăng tay** để lên web.

---

## Cấu trúc file: mảng `[ { sản phẩm 1 }, { sản phẩm 2 } ]`

Mỗi sản phẩm dùng các khoá sau. Khi cập nhật lại: khoá không đưa vào → dữ liệu cũ **giữ nguyên** (xem "Cập nhật sản phẩm đã có") — đây là quy tắc cho **file nhập thật**.

> **`mau-day-du.json` (file mẫu tham khảo trong bộ này) là ví dụ thật, lấy từ "Tải dữ liệu hiện tại":** mỗi object mẫu chỉ liệt kê khoá nào sản phẩm đó thực sự có; khoá tuỳ chọn hoàn toàn không dùng (cả VI lẫn EN đều không có, hoặc cả object/mảng không dùng) thì **bị bỏ hẳn** — **trừ nhóm object cấp sản phẩm luôn-xuất-hiện** (`shortDescription`, `specifications`, `specStats`, `trustBadges`, `quickAnswerSummary`, `originBrandCountry`, `seo`; xem quy tắc 2026-07-07 mới nhất ở đầu file) — nhóm này vẫn hiện đủ khoá với `null` dù sản phẩm không có nội dung gì. Với mọi cặp khoá song ngữ khác **đã có ít nhất 1 vế** (object hoặc phần tử mảng đó có được xuất ra), **cả 2 vế VI/EN luôn cùng xuất hiện** — vế nào chưa dịch thì hiện `null`. Khi copy ra làm file nhập thật: nếu đang **tạo mới**, chỉ cần điền khoá nào có nội dung — có thể **giữ nguyên `null`** ở vế chưa dịch (hệ thống hiểu như bỏ trống) hoặc xoá hẳn khoá đó đi, cả hai cách đều hợp lệ. Nếu đang **cập nhật sản phẩm đã có**, phải **xoá hẳn** khoá nào không muốn đổi trước khi nạp — gửi một khoá song ngữ chỉ có 1 trong 2 vế (vd `"name": { "nameEN": "..." }` không có `nameVI`) là hợp lệ và chỉ đổi đúng vế đó, vế còn lại giữ nguyên dữ liệu cũ; gửi `"nameVI": null` tương đương với bỏ hẳn khoá đó (không xoá dữ liệu cũ).

### Nhận diện & hàng hoá
| Khoá | Kiểu | Ghi chú |
|---|---|---|
| `sku` | chuỗi | **SKU cấp sản phẩm.** Dùng để đối chiếu cập nhật (trùng SKU → cập nhật đúng sản phẩm thay vì tạo trùng). **Luôn bắt buộc** (kể cả khi sản phẩm có `variants`). |
| `slug` | obj | `{ "slugVI": "...", "slugEN": "..." }`. `slugVI` là đường dẫn trang tiếng Việt (ví dụ `scs-cam-s`). `slugEN` tuỳ chọn — bỏ trống thì web tự dùng `slugVI` cho cả 2 ngôn ngữ. |
| `name` | obj | `{ "nameVI": "...", "nameEN": "..." }`. `nameVI` là tên tiếng Việt; `nameEN` **bắt buộc kèm theo khi tạo mới** hoặc khi đổi `nameVI` (xem quy tắc 1). |
| `categoryId` | chuỗi | **BẮT BUỘC.** slug danh mục (ví dụ `mu-bao-hiem`). |
| `brandId` | chuỗi | **BẮT BUỘC.** slug thương hiệu (ví dụ `ls2`). |
| `gender` | chuỗi | **BẮT BUỘC.** `Nam` / `Nữ` / `Unisex`. |
| `originBrandCountry` | obj | `{ "originBrandCountryVI": "Trung Quốc", "originBrandCountryEN": "China" }` — xuất xứ thương hiệu, hiển thị ở ô "Thương hiệu (nước)" trên trang quản trị. Tối đa 120 ký tự mỗi vế, cả object tuỳ chọn. |
| `retailPrice` | số | Giá bán lẻ (VNĐ, số nguyên, **không** dấu phẩy/chấm ngăn cách). **Bắt buộc khi sản phẩm KHÔNG có `variants`**; khi có `variants` thì tuỳ chọn — có thể bỏ hẳn khoá này hoặc để `null` (2 cách tương đương, không ảnh hưởng khi nhập lại). File tải từ "Tải dữ liệu hiện tại" luôn ghi `null` thay vì bỏ khoá. |
| `salePrice` | số | Giá khuyến mãi (tuỳ chọn) — luôn có mặt trong file tải xuống, `null` khi sản phẩm không giảm giá. |
| `image` | obj | Ảnh đại diện: `{ "url": "...", "alt": "..." }`. **Chỉ dùng khi tạo mới** — sản phẩm đã có sẵn thì bỏ qua, ảnh cũ luôn giữ nguyên. |
| `gallery` | mảng | Thư viện ảnh: `[ { "url": "...", "alt": "...", "sortOrder": 0 } ]`. **Chỉ dùng khi tạo mới** — sản phẩm đã có sẵn thì bỏ qua, giữ nguyên. |
| `shortDescription` | obj | `{ "shortDescriptionVI": "...", "shortDescriptionEN": "..." }` — mô tả ngắn (HTML đơn giản), mỗi vế tuỳ chọn độc lập. |
| `specifications` | obj | `{ "specificationsVI": "...", "specificationsEN": "..." }` — bảng thông số kỹ thuật (HTML thô), mỗi vế tuỳ chọn độc lập. |
| `seo` | obj | `{ "titleVI": "...", "titleEN": "...", "descriptionVI": "...", "descriptionEN": "...", "canonicalUrl": "https://bigbike.vn/product/..." }`. `canonicalUrl` không tách VI/EN — dùng chung 1 khoá. |
| `variants` | mảng | Biến thể (màu/size) — xem dưới. |
| `relatedProductIds` | mảng chuỗi | SKU sản phẩm liên quan. Chỉ nên trỏ SKU **đang Đã xuất bản**. |
| `accessoryProductIds` | mảng chuỗi | SKU phụ kiện bán kèm (cùng lưu ý trên). |

### Biến thể — `variants` (nếu sản phẩm có màu/size)
Mỗi biến thể:
```json
{ "sku": "MDS-CAB-TANCAR-BK-XS",
  "options": [ { "optionName": "Size", "optionValue": "XS" } ],
  "retailPrice": 12000000, "salePrice": 11000000, "isAvailable": true,
  "imageUrl": "/media/...", "imageAlt": "..." }
```
- `sku` **bắt buộc, duy nhất** cho mỗi biến thể. Hệ thống đối chiếu biến thể **theo SKU** khi cập nhật → giữ lịch sử tồn kho, không xoá nhầm.
- **Không cần điền `id` cho biến thể.** Mã `id` (dạng `var_...`) do hệ thống tự sinh khi lưu — kể cả khi tạo mới lẫn khi biến thể mới xuất hiện trong lần cập nhật. Field này chỉ xuất hiện trong file **tải về** ("Tải dữ liệu hiện tại") vì đó là dữ liệu thật đã lưu; khi tự soạn file để nhập, bỏ hẳn khoá `id` — không tự bịa giá trị.
- `retailPrice` (từ 2026-07-06, nới lỏng 2026-07-07): **bắt buộc cho mỗi biến thể, TRỪ KHI sản phẩm đã có `retailPrice` cấp sản phẩm hợp lệ (`> 0`) làm "giá chung".** Bỏ trống `retailPrice` của biến thể → biến thể đó tự dùng trọn giá chung (cả `retailPrice` lẫn `salePrice` cấp sản phẩm) làm giá hiệu lực. Điền `retailPrice` riêng → biến thể đó dùng đúng giá riêng, không rơi về giá chung nữa (kể cả phần sale). Sản phẩm không có giá chung **và** biến thể cũng không có `retailPrice` riêng → dòng đó bị từ chối lỗi `variants[i].retailPrice`.
- `salePrice` **tuỳ chọn** — biến thể nào không giảm giá thì **bỏ hẳn khoá này** (đừng ghi `null`), chỉ thêm khi biến thể đó thực sự có giá khuyến mãi và phải **nhỏ hơn** `retailPrice` của chính biến thể đó. **Bắt buộc phải đi kèm `retailPrice` riêng của cùng biến thể đó** — biến thể không có `retailPrice` riêng mà vẫn khai `salePrice` riêng sẽ bị từ chối lỗi `variants[i].salePrice` (vì `salePrice` đó sẽ bị bỏ qua âm thầm, không có tác dụng gì).
- `imageUrl`/`imageAlt`/`gallery` của biến thể: nếu SKU khớp với biến thể **đã có sẵn**, ảnh trong file bị bỏ qua — ảnh cũ giữ nguyên. Chỉ áp dụng cho biến thể **hoàn toàn mới** (SKU chưa từng có).
- `options`: mỗi thuộc tính một cặp `optionName`/`optionValue` (ví dụ `{ "optionName": "Màu", "optionValue": "Đen" }`, `{ "optionName": "Size", "optionValue": "L" }`). Tên biến thể tự sinh từ options — không nhập tay. Đây là danh mục dùng chung, không tách VI/EN.

---

## Nội dung marketing (tuỳ chọn — bỏ khoá nào không có)

### Quick Answer — `quickAnswerSummary`
`{ "quickAnswerSummaryVI": "...", "quickAnswerSummaryEN": "..." }` — chuỗi thường (không HTML), **40–60 từ**, tối đa 600 ký tự mỗi vế. Tóm tắt sản phẩm là gì / cho ai / giá.

⚠️ **Đây LÀ khoá riêng ở cấp cao nhất của sản phẩm** (ngang hàng `sku`, `descriptionBlocks`...) — **KHÔNG** viết nội dung "trả lời nhanh" thành một khối `paragraph` bên trong `descriptionBlocks`. Nếu nhét vào `descriptionBlocks`, hệ thống sẽ hiểu đó là một đoạn mô tả bình thường, ô Quick Answer thật sẽ trống và nội dung bị lặp/lẫn vào Mô tả chi tiết.

### Ô số liệu nổi bật — `specStats`
`{ "specStatsVI": "...", "specStatsEN": "..." }` — dải **con số bán hàng nổi bật** (pin, tầm xa, chống nước…) dạng HTML thô, không phải bảng thông số kỹ thuật. Mỗi vế tuỳ chọn độc lập.

### Dải tin cậy — `trustBadges`
`{ "trustBadgesVI": "...", "trustBadgesEN": "..." }` — dải nhãn tin cậy (bảo hành, chính hãng, freeship…) dạng HTML thô. Mỗi vế tuỳ chọn độc lập.

### Cam kết — `commitments` (tối đa 12, hiện dưới nút mua)
Mỗi mục: `{ "icon": "shield-check", "title": "Bảo hành 24 tháng", "subtitle": "Thiết bị chính hãng", "titleEn": "...", "subtitleEn": "...", "sortOrder": 1 }`
`title` ≤200, `subtitle` ≤300. **`icon` chỉ nên dùng 12 key sau** (bỏ trống → tự dùng `shield-check`; key lạ không bị chặn khi nhập nhưng trang web sẽ hiển thị icon khiên mặc định thay vì icon đúng ý — nên luôn dùng đúng key trong danh sách):
`truck` · `refresh-cw` · `shield-check` · `badge-check` · `credit-card` · `headphones` · `package` · `gift` · `clock` · `map-pin` · `wrench` · `award`

### Ưu điểm / Nhược điểm — `highlights.positiveNotes` / `highlights.negativeNotes` (mỗi bên tối đa 20)
Gộp chung 1 khoá cha `highlights`, bên trong 2 mảng con `positiveNotes`/`negativeNotes`:
`"highlights": { "positiveNotes": [...], "negativeNotes": [...] }`.
Mỗi mục: `{ "content": "Pin ~35h, ít phải sạc", "contentEn": "~35h battery", "sortOrder": 1 }` — `content` ≤2000 ký tự.

### Câu hỏi thường gặp — `faqs` (tối đa 50)
Mỗi mục: `{ "question": "...?", "answer": "<p>Câu trả lời, cho phép HTML.</p>", "questionEn": "...?", "answerEn": "<p>...</p>", "sortOrder": 1 }`
`question` ≤500, `answer` ≤20000 (HTML đơn giản: `<p> <strong> <ul> <li>`).

### Video (mục riêng) — `videos` (tối đa 20)
Mỗi mục: `{ "url": "https://www.youtube.com/watch?v=XXXXXXXXXXX", "provider": "youtube", "title": "...", "description": "...", "sortOrder": 1 }`
`provider` nên ghi đúng: **`youtube` · `tiktok` · `facebook` · `upload`** (chỉ mang tính hiển thị/ghi chú — hệ thống tự nhận diện nền tảng từ chính `url`). Nền tảng khác YouTube/TikTok/Facebook bị cấm ở `url`. Link YouTube được phép dùng dạng rút gọn `youtu.be/...` (ổn định, chấp nhận bình thường); **TikTok/Facebook thì không** — phải dùng link đầy đủ, không dùng `vt.tiktok.com`/`vm.tiktok.com`/`fb.watch`. `upload` = video đã ở trong kho (`/media/...`). Không có video → **bỏ khoá `videos`**. **Chỉ dùng khi tạo mới** — sản phẩm đã có sẵn thì bỏ qua, video cũ luôn giữ nguyên (sửa video phải làm trực tiếp trong trang quản trị).

### Mô tả chi tiết — `descriptionBlocks`
Mảng các khối — **1 mảng duy nhất, mỗi khối mang cả 2 ngôn ngữ** (không còn khoá `descriptionBlocksEn` riêng). Tiếng Việt là bản chính quyết định số khối/thứ tự khối; mỗi field dịch được có thêm field song song tên `...En` cùng trong khối đó (tuỳ chọn, bỏ trống được). Các loại khối dùng cho sản phẩm:

- **Tiêu đề:** `{ "type": "heading", "level": 2, "text": "...", "textEn": "..." }` (`level` = 2 hoặc 3)
- **Đoạn văn:** `{ "type": "paragraph", "html": "<p>...</p>", "htmlEn": "<p>...</p>" }`
- **Danh sách:** `{ "type": "list", "style": "bulleted", "items": ["...", "..."], "itemsEn": ["...", "..."] }` (`style` = `bulleted`|`numbered`; `itemsEn` phải cùng số dòng và cùng thứ tự với `items`)
- **Ảnh riêng:** `{ "type": "image", "url": "...", "alt": "...", "altEn": "...", "caption": "...", "captionEn": "..." }` — `url` bắt buộc và dùng chung cho cả 2 ngôn ngữ (không dịch), `alt`/`caption` (và bản `En`) tuỳ chọn.
- **Tính năng (Lợi ích/Bằng chứng/Hạn chế):** `{ "type": "feature", "side": "left", "url": "...", "alt": "...", "altEn": "...", "caption": "...", "captionEn": "...", "subheading": "Nhãn ngắn", "subheadingEn": "...", "heading": "Tiêu đề tính năng", "headingEn": "...", "html": "<p><strong>Lợi ích:</strong></p><p>...</p>", "htmlEn": "<p>...</p>", "listStyle": "bulleted", "items": ["...", "..."], "itemsEn": ["...", "..."] }` — khối 2 cột ảnh–chữ; `url`/`side`/`listStyle` dùng chung cho cả 2 ngôn ngữ (bỏ trống ảnh → web render full-width chỉ chữ), `side` = `auto`|`left`|`right` (bỏ trống/`auto` → tự xen kẽ trái/phải). Không field nào bắt buộc riêng lẻ, nhưng khối phải có ít nhất ảnh hoặc chữ (VI hoặc EN).

> Ảnh trong `html`/`htmlEn`/`url` cũng phải theo quy tắc MinIO (`/media/...` hoặc `https://media.bigbike.vn/bigbike-media/...`). Không nhúng `<img src="link ngoài">` hay dùng `url` ảnh ngoài kho.
>
> Khối chưa dịch tiếng Anh: khi tự soạn file nhập, bỏ hẳn các field `...En` của khối đó (không gửi field trống `""`) — web sẽ tự hiển thị bản tiếng Việt khi khách xem trang tiếng Anh. File **xuất ra** ("Tải dữ liệu hiện tại") thì luôn in đủ field `...En` với giá trị `null` cho khối chưa dịch, thay vì bỏ hẳn (xem quy tắc 2026-07-07 ở đầu file) — cả `null` lẫn bỏ hẳn khoá đều được web hiểu là "chưa dịch, dùng bản tiếng Việt".

### "Phù hợp với ai" — `suitabilitySection` · "Bảng size" — `sizeGuideSection`

**KHOÁ RIÊNG cấp cao nhất** (ngang hàng `sku`, `descriptionBlocks`...) — 2 mục này **KHÔNG còn** là khối bên trong `descriptionBlocks` nữa (đảo lại so với trước). Mỗi khoá là **1 object đơn**, không phải phần tử trong mảng:

- **Phù hợp với ai:** `"suitabilitySection": { "title": "PHÙ HỢP VỚI AI", "titleEn": "...", "html": "<ul>...</ul>", "htmlEn": "<ul>...</ul>" }` — đây là **nguồn hiển thị khối "Phù hợp với ai" trên web**, theo từng ngôn ngữ.
- **Bảng size:** `"sizeGuideSection": { "title": "Bảng size", "titleEn": "...", "html": "<table>...</table><p>Cách đo...</p>", "htmlEn": "<table>...</table><p>...</p>" }` — đây là **nguồn hiển thị bảng size trên web**, theo từng ngôn ngữ.
- Không có nội dung gì cả (cả VI lẫn EN) → **bỏ hẳn khoá** đó (giống mọi khoá tuỳ chọn khác) — web tự ẩn khối. Nếu khoá có được dùng nhưng chỉ có bản tiếng Việt, file xuất ra vẫn in đủ `titleEn`/`htmlEn` với giá trị `null` thay vì bỏ hẳn (xem quy tắc 2026-07-07 ở đầu file) — khi tự soạn file nhập, bỏ hẳn field đó cũng cho kết quả tương đương. Ảnh trong `html`/`htmlEn` của 2 khoá này cũng phải theo quy tắc MinIO như trên.

---

## Cập nhật nội dung cho sản phẩm ĐÃ CÓ sẵn (không tạo mới)

Muốn sửa/bổ sung cho sản phẩm **đã đăng bán** (thêm FAQ, sửa mô tả, đổi giá…) → nạp lại file JSON chỉ chứa những sản phẩm đó. Nguyên tắc an toàn (đã kiểm tra trong code):

- Vẫn phải có `sku` (khớp đúng sản phẩm đã tồn tại) và `categoryId` (điền đúng slug danh mục hiện tại, kể cả khi không đổi danh mục).
- Khoá **không đưa vào file** → dữ liệu hiện có của khoá đó **giữ nguyên, không đổi, không mất**. Đây là lý do luôn nhắc "khoá nào không có nội dung thì bỏ hẳn khoá đó".
- Với các khoá song ngữ lồng nhau (`name`, `slug`, `shortDescription`, `specifications`, `specStats`, `trustBadges`, `quickAnswerSummary`, `originBrandCountry`, `seo`): chỉ cần gửi **vế nào muốn đổi** trong object đó — vd `"trustBadges": { "trustBadgesEN": "..." }` chỉ đổi bản tiếng Anh, bản tiếng Việt giữ nguyên. Bỏ hẳn cả khoá cha (vd bỏ hẳn khoá `trustBadges`) mới là "không đổi gì cả ở cột đó".
- **Ảnh và video luôn giữ nguyên dữ liệu cũ, bất kể file ghi gì** — `image` (ảnh đại diện), `gallery` (bộ sưu tập ảnh, kể cả ảnh gắn trong đó), `videos` (video sản phẩm), và ảnh/gallery riêng của **từng biến thể đã có sẵn** (`variants[].imageUrl`, `variants[].imageAlt`, `variants[].gallery`). Muốn đổi ảnh/video của sản phẩm đã đăng bán, phải sửa trực tiếp trong trang quản trị — nạp file **không** dùng để thay ảnh/video của sản phẩm cũ. (Biến thể **mới thêm** trong cùng lần nạp — không khớp SKU nào đã có — vẫn lấy ảnh từ file bình thường, vì biến thể đó chưa có ảnh cũ để giữ.)
- Khoá **có đưa vào** trong số `commitments`, `highlights.positiveNotes`, `highlights.negativeNotes`, `faqs`, `variants` (trừ ảnh/gallery biến thể — xem trên) → **thay thế toàn bộ danh sách cũ bằng danh sách mới**, không cộng dồn. Muốn giữ mục cũ + thêm mục mới → phải liệt kê lại **đầy đủ cả cũ lẫn mới** trong cùng mảng đó. (`positiveNotes`/`negativeNotes` là 2 mảng con độc lập trong `highlights` — chỉ đưa `highlights.positiveNotes` thì `negativeNotes` cũ vẫn giữ nguyên, và ngược lại.)
- `descriptionBlocks` cũng thay thế toàn bộ — sửa 1 đoạn vẫn phải dán lại **nguyên mảng khối mô tả đầy đủ** của sản phẩm đó (lấy từ trang quản trị hoặc từ file tải về), không chỉ đoạn muốn sửa.
- `suitabilitySection`/`sizeGuideSection` cũng thay thế **toàn bộ object** khi có đưa vào file — khác với nhóm "khoá song ngữ lồng nhau" ở trên (không merge riêng từng vế VI/EN), phải gửi đủ cả `title`/`titleEn`/`html`/`htmlEn` muốn giữ, không chỉ vế muốn sửa.

> Mẹo: bấm **"Tải dữ liệu hiện tại"** trong hộp thoại Nhập để tải về file JSON **đầy đủ** của toàn bộ sản phẩm hiện có — sửa trực tiếp trên đó rồi nạp lại là an toàn nhất (đúng cấu trúc, không sót khoá, cùng shape với file nhập).

---

## Prompt mẫu để đưa cho AI

```
Bạn tạo dữ liệu nhập sản phẩm cho cửa hàng BigBike theo ĐÚNG template đính kèm
(mau-day-du.json). Với mỗi sản phẩm tôi cung cấp, hãy trả về MỘT object JSON trong
một mảng JSON duy nhất, gồm:

- Hàng hoá: sku, categoryId (slug danh mục), brandId (slug thương hiệu), gender,
  retailPrice, salePrice, image, gallery, và variants nếu có màu/size.
- Các cột song ngữ — MỖI CỘT LÀ 1 OBJECT LỒNG chứa cả 2 ngôn ngữ, không tách rời:
  name: { nameVI, nameEN }, slug: { slugVI, slugEN }, shortDescription:
  { shortDescriptionVI, shortDescriptionEN }, specifications:
  { specificationsVI, specificationsEN }, specStats:
  { specStatsVI, specStatsEN }, trustBadges:
  { trustBadgesVI, trustBadgesEN }, originBrandCountry (xuất xứ
  thương hiệu, vd "Trung Quốc"/"China"): { originBrandCountryVI, originBrandCountryEN },
  seo: { titleVI, titleEN, descriptionVI, descriptionEN, canonicalUrl } (canonicalUrl
  dùng chung 1 khoá, không tách VI/EN). nameVI + nameEN bắt buộc khi tạo mới.
- Nội dung: descriptionBlocks, quickAnswerSummary: { quickAnswerSummaryVI,
  quickAnswerSummaryEN } (KHOÁ RIÊNG cấp cao nhất — không viết vào trong
  descriptionBlocks), commitments (icon đúng trong 12 key cho phép), highlights
  (gồm 2 mảng con positiveNotes/negativeNotes), faqs, và sizeGuideSection (KHOÁ RIÊNG
  cấp cao nhất, không phải khối trong descriptionBlocks) nếu là đồ mặc/mũ.

BẮT BUỘC:
- Mỗi object có categoryId + brandId + gender; categoryId/brandId là SLUG, không phải
  mã nội bộ.
- Sản phẩm KHÔNG có variants: bắt buộc thêm sku + retailPrice cấp sản phẩm.
- Sản phẩm CÓ variants: bắt buộc thêm sku cấp sản phẩm; MỖI biến thể trong variants phải có
  sku riêng (không bỏ trống). retailPrice cấp sản phẩm là TUỲ CHỌN — nếu điền, nó trở
  thành "giá chung" cho biến thể nào không tự khai retailPrice riêng; nếu bỏ hẳn, MỖI
  biến thể bắt buộc phải tự có retailPrice riêng (không bỏ trống). Biến thể có
  retailPrice riêng thì salePrice riêng (nếu có) mới có tác dụng — biến thể không có
  retailPrice riêng mà khai salePrice riêng sẽ bị từ chối.
- Mọi ảnh dùng /media/... hoặc https://media.bigbike.vn/bigbike-media/... ; chưa có
  ảnh thì để trống (ảnh không bắt buộc lúc nhập — import luôn tạo Nháp, ảnh chỉ bắt
  buộc khi admin bấm "Đăng" sau đó).
- JSON chỉ chứa các khoá trong hướng dẫn, KHÔNG thêm khoá lạ, KHÔNG thêm ghi chú.
- Mỗi cột song ngữ PHẢI là object lồng { ...VI, ...EN } — KHÔNG tách tên VI ra ngoài
  rồi dồn hết bản tiếng Anh vào một khối translations riêng (shape cũ đã bỏ).
- Không để chữ nháp [Cần ảnh]/[gắn link]; link sản phẩm khác dùng URL thật hoặc bỏ.
- Nội dung tiếng Việt có dấu đầy đủ, đúng chính tả.
- Biến thể trong variants KHÔNG cần khoá `id` — hệ thống tự sinh mã này khi lưu, không tự bịa giá trị `id`.
```

Kiểm tra sau khi AI trả về: mở JSON bằng công cụ kiểm tra (jsonlint) xem có hợp lệ không; rà mọi ảnh đều thuộc kho MinIO; rà `categoryId`/`brandId` đúng slug; rà mỗi cột song ngữ đều là object lồng (không còn khoá `translations` rời).
