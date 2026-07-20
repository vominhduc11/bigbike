# Bộ template nhập sản phẩm BigBike — Hướng dẫn cho AI & người dùng

Chỉ còn **1 file duy nhất**: `mau-day-du.json`. Mỗi object trong mảng = **một sản phẩm hoàn chỉnh** (hàng hoá + nội dung). Nạp ở trang quản trị: **Sản phẩm → Nhập từ file**, hai bước *Kiểm tra* (xem trước, chưa lưu) → *Xác nhận nhập* (lưu thật).

> **Trước đây** bộ này gồm 2 file (CSV hàng hoá + JSON nội dung, khớp nhau bằng SKU). **Từ 2026-07-06 gộp về 1 file JSON** — file JSON chứa hàng hoá và nội dung chính cần nhập hàng loạt (giá, biến thể, SEO, mô tả, FAQ, dải tin cậy, cam kết…), nên không cần CSV nữa. Ảnh/video/sản phẩm liên quan vẫn sửa trực tiếp trong trang quản trị khi muốn đổi thật.
>
> **Từ 2026-07-07: mỗi cột song ngữ gộp chung thành 1 object lồng nhau** ngay tại vị trí cột đó — ví dụ tên sản phẩm giờ là `"name": { "nameVI": "...", "nameEN": "..." }` thay vì `"name": "..."` ở ngoài + `translations.en.name` ở một khối riêng cuối object. Khoá `translations` cấp cao nhất **không còn tồn tại**. File `mau-day-du.json` và file **Export JSON** của từng sản phẩm đều dùng đúng shape này — nhập và xuất từng sản phẩm luôn khớp nhau.
>
> **Từ 2026-07-19: nút "Tải dữ liệu hiện tại" / export toàn bộ catalog đã gỡ khỏi hộp thoại Nhập.** Không còn cách tải toàn bộ sản phẩm hiện có làm một file mẫu từ Admin. Muốn lấy sườn nhập chung thì dùng `mau-day-du.json` trong bộ này; muốn lấy dữ liệu đang có của một sản phẩm cụ thể thì mở trang chi tiết sản phẩm đó và bấm **Export JSON**.
>
> **Cũng từ 2026-07-07: "Phù hợp với ai" và "Bảng size" tách khỏi `descriptionBlocks`** thành 2 khoá riêng cấp cao nhất `suitabilitySection`/`sizeGuideSection` (đảo lại quyết định trước đó là để chúng làm khối `type: "suitability"`/`"sizeGuide"` trong mảng mô tả) — trình dựng mô tả sản phẩm trên trang quản trị chỉ còn 4 khối Notion: **mô tả**, **hình ảnh**, **ảnh phải + chữ trái**, **ảnh trái + chữ phải**.
>
> **Từ 2026-07-07: cột tiếng Việt và tiếng Anh của MỌI cặp song ngữ luôn xuất hiện song song trên file XUẤT RA, mỗi khi object/khối đó đã được dùng.** File **Export JSON** của 1 sản phẩm in đủ cả 2 vế của mỗi cặp VI/EN — từng phần tử trong các mảng (`faqs[]`, `commitments[]`, `highlights.positiveNotes/negativeNotes[]`), và từng khối trong `descriptionBlocks` (`html/htmlEn`, `alt/altEn`, `caption/captionEn`, `subheading/subheadingEn`, `heading/headingEn`) cũng như `suitabilitySection`/`sizeGuideSection` khi 2 khoá này có được dùng (`title/titleEn`, `html/htmlEn`) — **vế nào chưa có nội dung thì hiện `null`, không còn bị bỏ hẳn khoá**. Nhưng nếu cả object/mảng đó không được dùng đến (vd sản phẩm không có FAQ nào, hoặc không dùng `sizeGuideSection`) thì khoá cha vẫn **bỏ hẳn** như trước — quy tắc chỉ null-fill 2 vế của một cặp đã tồn tại, không tự tạo ra khối rỗng.
>
> **Từ 2026-07-15 (quyết định của chủ shop): file XUẤT RA của từng sản phẩm phải đầy đủ, còn file NHẬP VÀO được thiếu.** Khi bấm **Export JSON** ở trang chi tiết một sản phẩm, hệ thống xuất cả `publishStatus`, `image` (ảnh đại diện), `gallery` (gallery ảnh sản phẩm), `videos`, `relatedProductIds`, `accessoryProductIds`, `variants[].id`, `variants[].imageUrl`, `variants[].imageAlt`, `variants[].gallery`. Nhưng khi nạp JSON, các nhóm này **không bắt buộc**; nếu file có sẵn thì hệ thống vẫn cho nạp và tự lược bỏ trước khi lưu Nháp. Muốn đổi ảnh/video/sản phẩm liên quan/hoàn thiện bộ bảo hộ hoặc đăng bán thì sửa trực tiếp trong trang quản trị.
>
> Riêng nhóm object cấp sản phẩm sau LUÔN xuất hiện trên file XUẤT RA, kể cả khi sản phẩm không có nội dung gì cho khoá đó: `shortDescription`, `specifications`, `specStats`, `trustBadges`, `quickAnswerSummary`, `originBrandCountry`, `seo` (`titleVI/EN`, `descriptionVI/EN`; `canonicalUrl` không tính). Sản phẩm không có dữ liệu nào ở khoá đó → cả 2 vế VI/EN hiện `"...": null` thay vì bỏ hẳn cả khoá. `name`/`slug` luôn có sẵn (bắt buộc) nên trong thực tế luôn xuất hiện, không đổi gì.
>
> Quy tắc "song song VI/EN" này **chỉ áp dụng cho file XUẤT RA**. Khi bạn tự soạn file NHẬP VÀO (tạo mới hoặc cập nhật), vẫn được **bỏ hẳn** một vế (hoặc cả object/cả khối, kể cả với nhóm cấp sản phẩm luôn-xuất-hiện ở trên) không có nội dung như trước — hệ thống không phân biệt được "khoá vắng mặt" với "khoá có giá trị `null`" khi đọc file (JSON `null` và khoá bị bỏ hẳn được xử lý giống hệt nhau lúc nhập), nên cách viết nào cũng hợp lệ. `canonicalUrl` (trong `seo`) và những khoá không phải cặp song ngữ (`sortOrder`, `icon`, `id`, `sku`, `retailPrice`…) không nằm trong quy tắc null-fill — vẫn bỏ hẳn khi không có nội dung, không ghi `null`.
>
> **Cũng từ 2026-07-07: `salePrice` (Giá sale) luôn xuất hiện trên file XUẤT RA**, ở cả cấp sản phẩm và từng biến thể trong `variants[]` — sản phẩm/biến thể nào không giảm giá thì hiện `"salePrice": null` thay vì bị bỏ hẳn khoá. **Riêng khi tự soạn file NHẬP VÀO để cập nhật biến thể đã có sẵn, `variants[].salePrice` KHÔNG giống các khoá khác ở trên** — ghi tường minh `"salePrice": null` sẽ **xoá thật** giá khuyến mãi đang có của biến thể đó; muốn giữ nguyên giá khuyến mãi hiện tại (không đổi gì), bắt buộc phải **bỏ hẳn khoá** `salePrice` ra khỏi biến thể đó, không được ghi `null`. (`salePrice` cấp sản phẩm thì null hay bỏ hẳn khoá đều an toàn như nhau — không xoá nhầm dữ liệu.)
>
> **Từ 2026-07-07: `retailPrice`/`salePrice` cấp sản phẩm có thể làm "giá chung" cho biến thể chưa tự khai giá riêng.** Trước đây, sản phẩm có `variants[]` thì **mỗi biến thể bắt buộc phải tự có `retailPrice` riêng**, không có ngoại lệ. Nay: nếu sản phẩm **có** `retailPrice` cấp sản phẩm hợp lệ (`> 0`), biến thể nào **không** khai `retailPrice` riêng sẽ **tự dùng trọn giá chung đó** (cả `retailPrice` lẫn `salePrice` cấp sản phẩm) làm giá hiệu lực — hiển thị lẫn tính tiền. Biến thể nào **có** khai `retailPrice` riêng thì dùng đúng giá (và `salePrice`) riêng đó, **không** rơi về giá chung nữa dù không khai `salePrice` riêng (biến thể đó xem như không giảm giá, chứ không tự lấy `salePrice` chung). **Nếu sản phẩm không có `retailPrice` cấp sản phẩm hợp lệ VÀ biến thể cũng không có `retailPrice` riêng → vẫn báo lỗi** (không có giá nào để dùng). **Cấm:** biến thể có `salePrice` riêng mà KHÔNG có `retailPrice` riêng — bị từ chối lúc lưu, vì `salePrice` đó sẽ bị bỏ qua âm thầm nếu không có `retailPrice` riêng đi kèm.
>
> **Từ 2026-07-20 (quyết định của chủ shop): file JSON do AI soạn để nhập — `categoryId`/`brandId` LUÔN LUÔN là `"uncategorized"`/`"uncategorized-brand"` (Chưa phân loại) cho MỌI sản phẩm, không ngoại lệ.** AI không còn phải khớp/đoán đúng danh mục hoặc thương hiệu thật của shop, cũng không cần được cấp danh sách danh mục/thương hiệu hiện có nữa (xem quy tắc 1 và mẫu prompt cuối file). Sau khi nạp xong, admin **tự vào trang quản trị mở từng sản phẩm và gán lại đúng danh mục/thương hiệu thật** — bước thủ công bắt buộc sau mỗi lần nhập bằng file do AI soạn. File mẫu `mau-day-du.json` trong bộ này **chỉ minh hoạ cấu trúc dữ liệu** (tên khoá, kiểu dữ liệu, cách lồng object song ngữ…) — giá trị `categoryId`/`brandId` cụ thể đang có trong file mẫu **không phải slug bắt buộc phải theo**; khi soạn file nhập thật bằng AI vẫn luôn thay 2 khoá này bằng `"uncategorized"`/`"uncategorized-brand"`, không copy nguyên giá trị mẫu.

---

## ⛔ 5 quy tắc BẮT BUỘC (sai là hỏng)

1. **`categoryId` là bắt buộc ở mọi object — kể cả khi chỉ cập nhật sản phẩm đã có.** `categoryId` là **slug danh mục** (ví dụ `mu-bao-hiem`), `brandId` là **slug thương hiệu** (ví dụ `ls2`) — **KHÔNG** phải mã nội bộ dạng `cat_...`/`brand_...`. Slug này phải **khớp đúng danh mục/thương hiệu đang tồn tại thật** trong shop — hệ thống chỉ đối chiếu, không tự tạo danh mục/thương hiệu mới lúc nhập; slug không khớp cái nào đang có → dòng đó báo lỗi `NOT_FOUND`, không tự nạp. **Nếu dùng AI soạn file** (theo mẫu prompt ở cuối file này): `categoryId`/`brandId` **LUÔN LUÔN** là `"uncategorized"`/`"uncategorized-brand"` (danh mục/thương hiệu **Chưa phân loại**) cho **MỌI** sản phẩm, không ngoại lệ. AI không tự khớp/đoán danh mục hoặc thương hiệu thật của sản phẩm (kể cả khi biết rõ đó là thương hiệu/nhóm sản phẩm có thật ngoài đời), không cần hỏi lại người bán, không cần được cấp danh sách danh mục/thương hiệu hiện có của shop. `brandId` trong trường hợp này luôn ghi tường minh `"uncategorized-brand"` — **không bỏ trống khoá** — để nhất quán hiện đúng chữ "Chưa phân loại" giống danh mục. Sau khi nạp xong, admin **tự vào trang quản trị mở từng sản phẩm và gán lại đúng danh mục/thương hiệu thật** — bước thủ công bắt buộc sau mỗi lần nhập bằng file do AI soạn.
   **Nếu tự tay soạn file** (không qua AI) và biết rõ đúng slug thật thì ghi thẳng slug đó — **không tự đặt/đoán slug** cho một danh mục hoặc thương hiệu chưa chắc đã có trong hệ thống (kể cả khi đó là thương hiệu/nhóm sản phẩm có thật ngoài đời — ví dụ bịa `"kovix"` khi shop chưa từng bán hàng Kovix, hoặc bịa `"khoa-chong-trom"` khi shop chưa có danh mục khoá) — phải hỏi lại người bán để lấy đúng slug đang dùng trong Admin (Danh mục/Thương hiệu), hoặc tạm dùng `"uncategorized"`/`"uncategorized-brand"` rồi vào Admin gán lại đúng sau. Hai khoá xử lý khác nhau khi bỏ trống: `categoryId` **luôn bắt buộc phải có giá trị** — bỏ trống báo lỗi "Thiếu danh mục", **không** tự hiểu là "Chưa phân loại"; `brandId` **được phép bỏ hẳn khoá** nếu chưa rõ thương hiệu — sản phẩm sẽ không gắn thương hiệu nào (hiện dấu "—"), khác với gán tường minh `"uncategorized-brand"` (hiện đúng chữ "Chưa phân loại").
   Khi **tạo mới** phải có `name.nameVI` và `name.nameEN` — thiếu tên tiếng Anh sẽ báo lỗi dòng đó. Khi **cập nhật** sản phẩm cũ: nếu file **không** đổi tên, có thể bỏ hẳn khoá `name` (tên VI/EN cũ được giữ nguyên); nhưng nếu file **có** đổi `nameVI`, bắt buộc phải kèm `nameEN` mới trong cùng khoá `name` đó.
   - **Ma trận bắt buộc theo có/không biến thể (PRODUCT_RULE_005, áp dụng ngay cả khi import, vì import gọi thẳng luồng lưu sản phẩm thường):** Luôn bắt buộc: `name` (khi tạo mới)/`categoryId`/`brandId`/`gender`. Sản phẩm **KHÔNG có `variants`**: `sku` và `retailPrice` **cấp sản phẩm** cũng bắt buộc — thiếu 1 trong 2 sẽ báo lỗi dòng đó. Sản phẩm **CÓ `variants`**: `sku` cấp sản phẩm vẫn bắt buộc; mỗi phần tử trong `variants[]` bắt buộc phải có `sku` riêng — còn `retailPrice` riêng của từng biến thể **chỉ bắt buộc nếu sản phẩm không có `retailPrice` cấp sản phẩm hợp lệ** làm giá chung thay thế (xem mục Biến thể và ghi chú "giá chung" ở đầu file, 2026-07-07). Ảnh (`image`, `variants[].imageUrl`) **không bao giờ bắt buộc lúc import** vì import luôn tạo Nháp — ảnh chỉ bắt buộc khi admin bấm "Đăng" thủ công sau đó trong trang quản trị.
2. **Ảnh trong nội dung LUÔN bị hệ thống xoá trắng khi nhập — không có ngoại lệ.** `descriptionBlocks`/`suitabilitySection`/`sizeGuideSection` dùng ảnh gì (kể cả ảnh đã đúng kho MinIO của shop) cũng đều bị lược bỏ trước khi lưu, giống hệt ảnh đại diện/gallery/video sản phẩm. Khối "Hình ảnh" và khối "Ảnh phải/trái + chữ" vẫn được giữ (không bị xoá cả khối) nhưng luôn ở trạng thái "chưa có ảnh" — vào trang quản trị bấm chọn ảnh cho từng khối sau khi nạp. `url` của khối "Hình ảnh" vẫn là ô **bắt buộc phải điền một giá trị** để file hợp lệ (không được để trống), nhưng giá trị đó **không được dùng** — điền tạm URL nào cũng được, không cần và không nên mất công tìm ảnh MinIO thật cho việc này.
3. **JSON KHÔNG được có khoá lạ.** Chỉ dùng đúng các khoá liệt kê bên dưới. Thừa 1 khoá (kể cả khoá ghi chú `_comment`) → **cả file bị từ chối**. Muốn ghi chú thì ghi ở file hướng dẫn này, không ghi trong file JSON.
4. **KHÔNG để chữ nháp lọt ra khách:** bỏ hết `[Cần ảnh: ...]`, `[gắn link]`, `[Bigbike kiểm tra bổ sung]`. Link sản phẩm khác phải là URL thật hoặc bỏ.
5. **URL (canonical, link nội dung)** dùng `bigbike.vn` hoặc IP vận hành đã chốt `http://103.1.236.148:3000/...` theo file mẫu. Không dùng host ngoài khác.

> Import **luôn lưu sản phẩm ở trạng thái Nháp**, kể cả khi tạo mới hoặc cập nhật sản phẩm đã có. Sau khi nạp xong, vào trang quản trị **bấm đăng tay** để lên web.

---

## Cấu trúc file: mảng `[ { sản phẩm 1 }, { sản phẩm 2 } ]`

Mỗi sản phẩm dùng các khoá sau. Khi cập nhật lại: khoá không đưa vào → dữ liệu cũ **giữ nguyên** (xem "Cập nhật sản phẩm đã có") — đây là quy tắc cho **file nhập thật**.

> **`mau-day-du.json` (file mẫu tham khảo trong bộ này) là file mẫu cho NHẬP VÀO, không phải bản sao của file Export JSON từng sản phẩm.** Với các khoá song ngữ dùng để nhập nội dung, file mẫu theo cùng shape null-fill VI/EN như file Export (xem bên dưới). Nhưng nhóm khoá chỉ có ý nghĩa khi Xuất và luôn bị hệ thống lược bỏ lúc Nhập — `publishStatus`, `image`, `gallery`, `videos`, `relatedProductIds`, `accessoryProductIds`, `variants[].id`, `variants[].imageUrl`, `variants[].imageAlt`, `variants[].gallery` — **không xuất hiện trong `mau-day-du.json`**, dù file Export JSON thật của một sản phẩm có đủ các khoá này. Mỗi object mẫu chỉ liệt kê khoá nào sản phẩm đó thực sự có; khoá tuỳ chọn hoàn toàn không dùng (cả VI lẫn EN đều không có, hoặc cả object/mảng không dùng) thì **bị bỏ hẳn** — **trừ nhóm object cấp sản phẩm luôn-xuất-hiện** (`shortDescription`, `specifications`, `specStats`, `trustBadges`, `quickAnswerSummary`, `originBrandCountry`, `seo`; xem quy tắc 2026-07-07 mới nhất ở đầu file) — nhóm này vẫn hiện đủ khoá với `null` dù sản phẩm không có nội dung gì. Với mọi cặp khoá song ngữ khác **đã có ít nhất 1 vế** (object hoặc phần tử mảng đó có được xuất ra), **cả 2 vế VI/EN luôn cùng xuất hiện** — vế nào chưa dịch thì hiện `null`. Khi copy ra làm file nhập thật: nếu đang **tạo mới**, chỉ cần điền khoá nào có nội dung — có thể **giữ nguyên `null`** ở vế chưa dịch (hệ thống hiểu như bỏ trống) hoặc xoá hẳn khoá đó đi, cả hai cách đều hợp lệ. Nếu đang **cập nhật sản phẩm đã có**, phải **xoá hẳn** khoá nào không muốn đổi trước khi nạp — gửi một khoá song ngữ chỉ có 1 trong 2 vế (vd `"name": { "nameEN": "..." }` không có `nameVI`) là hợp lệ và chỉ đổi đúng vế đó, vế còn lại giữ nguyên dữ liệu cũ; gửi `"nameVI": null` tương đương với bỏ hẳn khoá đó (không xoá dữ liệu cũ).

### Nhận diện & hàng hoá
| Khoá | Kiểu | Ghi chú |
|---|---|---|
| `sku` | chuỗi | **SKU cấp sản phẩm.** Dùng để đối chiếu cập nhật (trùng SKU → cập nhật đúng sản phẩm thay vì tạo trùng). **Luôn bắt buộc** (kể cả khi sản phẩm có `variants`). |
| `slug` | obj | `{ "slugVI": "...", "slugEN": "..." }`. `slugVI` là đường dẫn trang tiếng Việt (ví dụ `scs-cam-s`). `slugEN` tuỳ chọn — bỏ trống thì web tự dùng `slugVI` cho cả 2 ngôn ngữ. |
| `name` | obj | `{ "nameVI": "...", "nameEN": "..." }`. `nameVI` là tên tiếng Việt; `nameEN` **bắt buộc kèm theo khi tạo mới** hoặc khi đổi `nameVI` (xem quy tắc 1). |
| `categoryId` | chuỗi | **BẮT BUỘC.** slug danh mục (ví dụ `mu-bao-hiem`). File do AI soạn: luôn `"uncategorized"` (xem quy tắc 1). |
| `brandId` | chuỗi | **BẮT BUỘC.** slug thương hiệu (ví dụ `ls2`). File do AI soạn: luôn `"uncategorized-brand"` (xem quy tắc 1). |
| `gender` | chuỗi | **BẮT BUỘC.** `Nam` / `Nữ` / `Unisex`. |
| `originBrandCountry` | obj | `{ "originBrandCountryVI": "Trung Quốc", "originBrandCountryEN": "China" }` — xuất xứ thương hiệu, hiển thị ở ô "Thương hiệu (nước)" trên trang quản trị. Tối đa 120 ký tự mỗi vế, cả object tuỳ chọn. |
| `retailPrice` | số | Giá bán lẻ (VNĐ, số nguyên, **không** dấu phẩy/chấm ngăn cách). **Bắt buộc khi sản phẩm KHÔNG có `variants`**; khi có `variants` thì tuỳ chọn — có thể bỏ hẳn khoá này hoặc để `null` (2 cách tương đương, không ảnh hưởng khi nhập lại). File Export JSON từng sản phẩm luôn ghi `null` thay vì bỏ khoá. |
| `salePrice` | số | Giá khuyến mãi (tuỳ chọn) — luôn có mặt trong file tải xuống, `null` khi sản phẩm không giảm giá. |
| `image` / `gallery` | obj/mảng | File **xuất ra có thể có đầy đủ** ảnh đại diện và gallery. Khi **nhập vào**, 2 nhóm này không bắt buộc; nếu có thì hệ thống tự lược bỏ, không dùng để tạo/sửa ảnh. Ảnh sửa trực tiếp trong trang quản trị. |
| `shortDescription` | obj | `{ "shortDescriptionVI": "...", "shortDescriptionEN": "..." }` — mô tả ngắn (HTML đơn giản), mỗi vế tuỳ chọn độc lập. |
| `specifications` | obj | `{ "specificationsVI": "...", "specificationsEN": "..." }` — bảng thông số kỹ thuật (HTML thô), mỗi vế tuỳ chọn độc lập. |
| `seo` | obj | `{ "titleVI": "...", "titleEN": "...", "descriptionVI": "...", "descriptionEN": "...", "canonicalUrl": "https://bigbike.vn/product/..." }`. `canonicalUrl` không tách VI/EN — dùng chung 1 khoá. |
| `variants` | mảng | Biến thể (màu/size) — xem dưới. |
| `relatedProductIds` / `accessoryProductIds` | mảng chuỗi | File **xuất ra có đầy đủ** sản phẩm liên quan và hoàn thiện bộ bảo hộ. Khi **nhập vào**, 2 nhóm này không bắt buộc; nếu có thì hệ thống tự lược bỏ, không dùng để sửa liên kết. |

### Biến thể — `variants` (nếu sản phẩm có màu/size)
Mỗi biến thể:
```json
{ "sku": "MDS-CAB-TANCAR-BK-XS",
  "options": [ { "optionName": "Size", "optionValue": "XS" } ],
  "retailPrice": 12000000, "salePrice": 11000000, "isAvailable": true }
```
- `sku` **bắt buộc, duy nhất** cho mỗi biến thể. Hệ thống đối chiếu biến thể **theo SKU** khi cập nhật → giữ lịch sử tồn kho, không xoá nhầm.
- **Không cần điền `id` cho biến thể khi nhập.** Mã `id` do hệ thống tự sinh và hệ thống đối chiếu lại bằng SKU khi nhập. File **tải về có thể có `id` đầy đủ**, nhưng khi nạp lại hệ thống tự bỏ qua `id`, không dùng để đối chiếu.
- `retailPrice` (từ 2026-07-06, nới lỏng 2026-07-07): **bắt buộc cho mỗi biến thể, TRỪ KHI sản phẩm đã có `retailPrice` cấp sản phẩm hợp lệ (`> 0`) làm "giá chung".** Bỏ trống `retailPrice` của biến thể → biến thể đó tự dùng trọn giá chung (cả `retailPrice` lẫn `salePrice` cấp sản phẩm) làm giá hiệu lực. Điền `retailPrice` riêng → biến thể đó dùng đúng giá riêng, không rơi về giá chung nữa (kể cả phần sale). Sản phẩm không có giá chung **và** biến thể cũng không có `retailPrice` riêng → dòng đó bị từ chối lỗi `variants[i].retailPrice`.
- `salePrice` **tuỳ chọn** — biến thể nào không giảm giá thì **bỏ hẳn khoá này** (đừng ghi `null`), chỉ thêm khi biến thể đó thực sự có giá khuyến mãi và phải **nhỏ hơn** `retailPrice` của chính biến thể đó. **Bắt buộc phải đi kèm `retailPrice` riêng của cùng biến thể đó** — biến thể không có `retailPrice` riêng mà vẫn khai `salePrice` riêng sẽ bị từ chối lỗi `variants[i].salePrice` (vì `salePrice` đó sẽ bị bỏ qua âm thầm, không có tác dụng gì).
- `imageUrl`/`imageAlt`/`gallery` của biến thể: file **xuất ra có thể có đầy đủ** ảnh màu đại diện và gallery theo màu. Khi **nhập vào**, các trường này không bắt buộc; nếu có thì hệ thống tự lược bỏ, không dùng để tạo/sửa ảnh biến thể.
- `options`: mỗi thuộc tính một cặp `optionName`/`optionValue` (ví dụ `{ "optionName": "Màu", "optionValue": "Đen" }`, `{ "optionName": "Size", "optionValue": "L" }`). Tên biến thể tự sinh từ options — không nhập tay. Đây là danh mục dùng chung, không tách VI/EN.

---

## Nội dung marketing (tuỳ chọn — bỏ khoá nào không có)

### Quick Answer — `quickAnswerSummary`
`{ "quickAnswerSummaryVI": "...", "quickAnswerSummaryEN": "..." }` — chuỗi thường (không HTML), **40–60 từ**, tối đa 600 ký tự mỗi vế. Tóm tắt sản phẩm là gì / cho ai / giá.

⚠️ **Đây LÀ khoá riêng ở cấp cao nhất của sản phẩm** (ngang hàng `sku`, `descriptionBlocks`...) — **KHÔNG** viết nội dung "trả lời nhanh" thành nội dung của một khối trong `descriptionBlocks`. `descriptionBlocks` của sản phẩm giờ chỉ nhận khối `feature` (xem mục "Mô tả chi tiết" bên dưới) — nhét nội dung Quick Answer vào đó (kể cả gói trong khối `feature` chữ-thuần) sẽ khiến ô Quick Answer thật trống và nội dung bị lặp/lẫn vào Mô tả chi tiết.

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

### Video sản phẩm
File **xuất ra có thể có `videos` đầy đủ**. Khi **nhập vào**, `videos` không bắt buộc; nếu có thì hệ thống tự lược bỏ, không dùng để tạo/sửa video. Video sản phẩm sửa trực tiếp trong trang quản trị sau khi nạp sản phẩm Nháp.

### Mô tả chi tiết — `descriptionBlocks`
Mảng các khối — **1 mảng duy nhất, mỗi khối mang cả 2 ngôn ngữ** (không còn khoá `descriptionBlocksEn` riêng). Tiếng Việt là bản chính quyết định số khối/thứ tự khối; mỗi field dịch được có thêm field song song tên `...En` cùng trong khối đó (tuỳ chọn, bỏ trống được). **Từ 2026-07-20, chỉ còn đúng 1 loại khối dùng cho sản phẩm** (khối "Mô tả"/`paragraph` và "Hình ảnh"/`image` đã bị bỏ khỏi menu sản phẩm — file nạp có 2 loại này trong `descriptionBlocks` sẽ bị từ chối):

- **Ảnh phải + chữ trái / ảnh trái + chữ phải:** `{ "type": "feature", "side": "right", "url": "...", "alt": "...", "altEn": "...", "caption": "...", "captionEn": "...", "subheading": "Nhãn ngắn", "subheadingEn": "...", "heading": "Tiêu đề tính năng", "headingEn": "...", "html": "<p><strong>Lợi ích:</strong></p><p>...</p>", "htmlEn": "<p>...</p>" }`. Dùng `side: "right"` cho ảnh phải + chữ trái, `side: "left"` cho ảnh trái + chữ phải. Không field nào bắt buộc riêng lẻ, nhưng khối phải có ít nhất ảnh hoặc chữ (VI hoặc EN) — lưu ý `url` dù có điền cũng bị xoá khi nạp (giống khối Hình ảnh trước đây), chỉ phần chữ được giữ. Muốn khối chỉ có chữ thì bỏ hẳn `url`/`alt`/`caption`; muốn khối chỉ có ảnh thì bỏ hẳn `subheading`/`heading`/`html`. **Không còn `listStyle`/`items`/`itemsEn`** (owner decision 2026-07-19, `V341__drop_feature_block_highlight_list.sql`) — admin đã gỡ phần nhập danh sách khỏi khối feature, backend không đọc 3 field này nữa; nội dung "Lợi ích/Hạn chế" viết trực tiếp trong `html`/`htmlEn`.

Không dùng `paragraph`, `image`, `heading`, `list`, `video`, `callout`, `divider`, `prosCons` trong `descriptionBlocks` của sản phẩm. Những kiểu đó không thuộc template mô tả sản phẩm hiện tại và file nạp sẽ báo lỗi dòng đó.

> Ảnh chèn trong `html`/`htmlEn` (đoạn văn, "Phù hợp với ai", "Bảng size") cũng bị xoá bỏ vô điều kiện khi nạp, giữ lại phần chữ xung quanh — không còn phân biệt ảnh đúng/sai nguồn MinIO, nên **không cần** dùng ảnh thật ở đây khi soạn file nhập.
>
> Khối chưa dịch tiếng Anh: khi tự soạn file nhập, bỏ hẳn các field `...En` của khối đó (không gửi field trống `""`) — web sẽ tự hiển thị bản tiếng Việt khi khách xem trang tiếng Anh. File **Export JSON** từng sản phẩm thì luôn in đủ field `...En` với giá trị `null` cho khối chưa dịch, thay vì bỏ hẳn (xem quy tắc 2026-07-07 ở đầu file) — cả `null` lẫn bỏ hẳn khoá đều được web hiểu là "chưa dịch, dùng bản tiếng Việt".

### "Phù hợp với ai" — `suitabilitySection` · "Bảng size" — `sizeGuideSection`

**KHOÁ RIÊNG cấp cao nhất** (ngang hàng `sku`, `descriptionBlocks`...) — 2 mục này **KHÔNG còn** là khối bên trong `descriptionBlocks` nữa (đảo lại so với trước). Mỗi khoá là **1 object đơn**, không phải phần tử trong mảng:

- **Phù hợp với ai:** `"suitabilitySection": { "title": "PHÙ HỢP VỚI AI", "titleEn": "...", "html": "<ul>...</ul>", "htmlEn": "<ul>...</ul>" }` — đây là **nguồn hiển thị khối "Phù hợp với ai" trên web**, theo từng ngôn ngữ.
- **Bảng size:** `"sizeGuideSection": { "title": "Bảng size", "titleEn": "...", "html": "<table>...</table><p>Cách đo...</p>", "htmlEn": "<table>...</table><p>...</p>" }` — đây là **nguồn hiển thị bảng size trên web**, theo từng ngôn ngữ.
- Không có nội dung gì cả (cả VI lẫn EN) → **bỏ hẳn khoá** đó (giống mọi khoá tuỳ chọn khác) — web tự ẩn khối. Nếu khoá có được dùng nhưng chỉ có bản tiếng Việt, file xuất ra vẫn in đủ `titleEn`/`htmlEn` với giá trị `null` thay vì bỏ hẳn (xem quy tắc 2026-07-07 ở đầu file) — khi tự soạn file nhập, bỏ hẳn field đó cũng cho kết quả tương đương. Ảnh trong `html`/`htmlEn` của 2 khoá này cũng phải theo quy tắc MinIO như trên.
- ⚠️ **`suitabilitySection`/`sizeGuideSection` CHỈ có đúng 4 trường: `title`, `titleEn`, `html`, `htmlEn`.** Không có `url`/`urlEn` hay bất kỳ trường nào khác — dễ nhầm vì khối "Hình ảnh"/"Ảnh + chữ" trong `descriptionBlocks` có dùng `url`, nhưng 2 khoá này thì không. Thêm nhầm 1 trường lạ (kể cả để `null`) → vi phạm quy tắc 3 (JSON không được có khoá lạ) → **cả file bị từ chối khi nhập**, không sản phẩm nào lọt qua.

### Quy tắc HTML bắt buộc cho các khối HTML thô
- `specifications`: dùng `<table class="shop_attributes">` với `style` gồm `width:100%;border-collapse:collapse;font-family:var(--bb-font-body);font-size:var(--bb-text-a4-content);color:var(--bb-text-primary);`; chỉ cần `<tbody>` — **KHÔNG cần `<thead>`** (khác `sizeGuideSection` bên dưới: hệ thống chỉ đọc `<tr>` ngoài `<thead>` khi chuyển về tab "Nhập có cấu trúc", có `<thead>` cũng không lỗi nhưng không bắt buộc); mỗi dòng `<tr><th scope="row" style="background:var(--bb-bg-surface-raised);color:var(--bb-text-primary);border:1px solid var(--bb-border-subtle);padding:12px 16px;">Tên</th><td style="border:1px solid var(--bb-border-subtle);padding:12px 16px;">Giá trị</td></tr>`; giữ nguyên các `var(--bb-...)` trên, không hardcode hex (`#111111`/`#f5f5f5`/`#dddddd`) hay `!important`; không gán cứng `font-size` riêng trên từng `th`/`td`.
- `specStats`: **COPY Y NGUYÊN khối HTML kèm TẤT CẢ `style="..."` inline, chỉ thay chữ** (số liệu + nhãn), KHÔNG rút gọn, KHÔNG bỏ bớt style. Bắt buộc giữ đủ: container `<div class="bb-specstats">` có `display:grid` + `border`/`background` dùng `var(--bb-border-subtle)` (đường kẻ ngăn ô); mỗi ô là `<div>` riêng có `display:flex;flex-direction:column` + `padding` + nền `var(--bb-bg-surface)`; trong ô đúng 2 `<span>` — số liệu trước (`font-weight:700;font-size:var(--bb-text-a2-page);line-height:1;text-transform:uppercase;color:var(--bb-action-primary)`), nhãn sau (`font-size:var(--bb-text-a5-meta);font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:var(--bb-text-secondary)` — **không thêm `opacity`**, làm nhạt màu lệch token). Tối đa 4 ô, giữ nguyên các `var(--bb-...)` — không hardcode hex. **Thiếu `display:grid`/viền/đệm ô hoặc dùng `<br>` thay ô → web hiển thị chữ căn giữa xếp dọc, KHÔNG ra dạng bảng số liệu.**
- `trustBadges`: **COPY Y NGUYÊN khối HTML kèm TẤT CẢ `style="..."` inline, chỉ thay chữ nhãn.** Container `<div class="bb-trust-badges">` có `display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;font-family:var(--bb-font-body);font-size:var(--bb-text-a5-meta);line-height:1;color:var(--bb-text-secondary)` (hàng ngang; `line-height:1` bắt buộc — khớp `leading-none` mà web ép trên dải này). Mỗi nhãn là `<span style="display:flex;align-items:center;gap:8px;line-height:1">` chứa **đúng 2 `<span>`**: chấm màu là **1 span RỖNG** tô nền bằng style (`height:6px;width:6px;background:var(--bb-action-primary)`) — **KHÔNG dùng ký tự "•"**, KHÔNG để chữ trần ngoài span — rồi span thứ hai chứa chữ. Giữ nguyên các `var(--bb-...)` — không hardcode hex.
- `suitabilitySection.html`: bọc trong `<ul class="suitability-list">`, mỗi dòng `<li><strong>Tên đối tượng</strong> → Lời khuyên</li>`.
- `sizeGuideSection.html`: **COPY Y NGUYÊN khối HTML kèm TẤT CẢ `style="..."` inline, chỉ thay chữ** (tên cột + số liệu), KHÔNG rút gọn, KHÔNG bỏ style, KHÔNG tự chọn màu/cỡ chữ khác — giữ nguyên mọi `var(--bb-...)`, đó là biến font/màu thật của web, không đổi thành hex hay px cụ thể. Bảng có đủ `<thead>`/`<tbody>`; `<table>` dùng đúng `style="width:100%;min-width:520px;border-collapse:collapse;font-family:var(--bb-font-body);font-size:var(--bb-text-a4-content);line-height:1.5;color:var(--bb-text-primary);margin:0 0 12px 0;"`; `<th>` dùng đúng `style="background:var(--bb-bg-surface-raised);color:var(--bb-text-primary);border:1px solid var(--bb-border-subtle);padding:12px 16px;text-align:center;font-weight:700;white-space:nowrap;"`; `<td>` dùng đúng `style="border:1px solid var(--bb-border-subtle);padding:12px 16px;text-align:center;vertical-align:middle;"`, riêng cột size (cột đầu tiên) thêm `font-weight:700` vào `<td>`. Ghi chú nếu có đặt trong `<p style="font-family:var(--bb-font-body);font-size:var(--bb-text-a5-meta);line-height:1.5;color:var(--bb-text-secondary);margin:8px 0 0 0;"><em>...</em></p>` bên NGOÀI `<table>`, không có ghi chú thì bỏ hẳn `<p>`. KHÔNG set width cố định theo px cho từng cột (chỉ `min-width` ở `<table>`), KHÔNG bọc `<table>` trong `<div>` nếu không cần, KHÔNG nền tối/đổ bóng/bo góc/gradient/emoji.
- Tất cả 5 mục trên: KHÔNG `<script>`, KHÔNG `<style>`, KHÔNG `id`.

---

## Cập nhật nội dung cho sản phẩm ĐÃ CÓ sẵn (không tạo mới)

Muốn sửa/bổ sung cho sản phẩm **đã đăng bán** (thêm FAQ, sửa mô tả, đổi giá…) → nạp lại file JSON chỉ chứa những sản phẩm đó. Nguyên tắc an toàn (đã kiểm tra trong code):

- Vẫn phải có `sku` (khớp đúng sản phẩm đã tồn tại) và `categoryId` (điền đúng slug danh mục hiện tại, kể cả khi không đổi danh mục).
- Khoá **không đưa vào file** → dữ liệu hiện có của khoá đó **giữ nguyên, không đổi, không mất**. Đây là lý do luôn nhắc "khoá nào không có nội dung thì bỏ hẳn khoá đó".
- Với các khoá song ngữ lồng nhau (`name`, `slug`, `shortDescription`, `specifications`, `specStats`, `trustBadges`, `quickAnswerSummary`, `originBrandCountry`, `seo`): chỉ cần gửi **vế nào muốn đổi** trong object đó — vd `"trustBadges": { "trustBadgesEN": "..." }` chỉ đổi bản tiếng Anh, bản tiếng Việt giữ nguyên. Bỏ hẳn cả khoá cha (vd bỏ hẳn khoá `trustBadges`) mới là "không đổi gì cả ở cột đó".
- **Ảnh, video, sản phẩm liên quan và hoàn thiện bộ bảo hộ có thể xuất ra đầy đủ nhưng không quản lý qua file JSON nhập.** Khi nạp lại, hệ thống tự lược bỏ các nhóm này; muốn đổi thật thì sửa trực tiếp trong trang quản trị.
- Khoá **có đưa vào** trong số `commitments`, `highlights.positiveNotes`, `highlights.negativeNotes`, `faqs`, `variants` → **thay thế toàn bộ danh sách cũ bằng danh sách mới**, không cộng dồn. Muốn giữ mục cũ + thêm mục mới → phải liệt kê lại **đầy đủ cả cũ lẫn mới** trong cùng mảng đó. (`positiveNotes`/`negativeNotes` là 2 mảng con độc lập trong `highlights` — chỉ đưa `highlights.positiveNotes` thì `negativeNotes` cũ vẫn giữ nguyên, và ngược lại.)
- `descriptionBlocks` cũng thay thế toàn bộ — sửa 1 đoạn vẫn phải dán lại **nguyên mảng khối mô tả đầy đủ** của sản phẩm đó (lấy từ trang quản trị hoặc từ file tải về), không chỉ đoạn muốn sửa.
- `suitabilitySection`/`sizeGuideSection` cũng thay thế **toàn bộ object** khi có đưa vào file — khác với nhóm "khoá song ngữ lồng nhau" ở trên (không merge riêng từng vế VI/EN), phải gửi đủ cả `title`/`titleEn`/`html`/`htmlEn` muốn giữ, không chỉ vế muốn sửa.

> Mẹo: nút tải JSON toàn bộ sản phẩm hiện có đã gỡ. Khi cần tạo file nhập mới, dùng `mau-day-du.json` làm mẫu. Khi cần sửa dựa trên dữ liệu đang có của một sản phẩm cụ thể, mở trang chi tiết sản phẩm đó và bấm **Export JSON**, rồi giữ lại đúng object cần nạp lại.

---

## Prompt mẫu để đưa cho AI

```
Bạn tạo dữ liệu nhập sản phẩm cho cửa hàng BigBike theo ĐÚNG cấu trúc dữ liệu của
template đính kèm (mau-day-du.json) — file mẫu này chỉ để tham khảo cấu trúc (tên khoá,
kiểu dữ liệu), KHÔNG copy nguyên giá trị categoryId/brandId mẫu có trong đó. Với mỗi sản
phẩm tôi cung cấp, hãy trả về MỘT object JSON trong một mảng JSON duy nhất, gồm:

- Hàng hoá: sku, categoryId (luôn `"uncategorized"`), brandId (luôn `"uncategorized-brand"`),
  gender, retailPrice, salePrice, và variants nếu có màu/size.
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
  (gồm 2 mảng con positiveNotes/negativeNotes), faqs, suitabilitySection, và
  sizeGuideSection (KHOÁ RIÊNG cấp cao nhất, không phải khối trong descriptionBlocks)
  nếu sản phẩm cần các khối này.

BẮT BUỘC:
- Mỗi object PHẢI có categoryId: "uncategorized", brandId: "uncategorized-brand", và
  gender. Dùng ĐÚNG 2 giá trị cố định "uncategorized"/"uncategorized-brand" đó cho MỌI
  sản phẩm, không có ngoại lệ — KHÔNG tự khớp, KHÔNG tự đoán, KHÔNG tự đặt danh mục/thương
  hiệu thật nào khác cho sản phẩm dù bạn biết rõ đó là thương hiệu/nhóm sản phẩm có thật
  ngoài đời. Không cần hỏi lại tôi về danh mục/thương hiệu, cũng không cần danh sách danh
  mục/thương hiệu hiện có của shop — tôi sẽ tự vào Admin gán lại đúng danh mục/thương hiệu
  cho từng sản phẩm sau khi nhập xong.
- Sản phẩm KHÔNG có variants: bắt buộc thêm sku + retailPrice cấp sản phẩm.
- Sản phẩm CÓ variants: bắt buộc thêm sku cấp sản phẩm; MỖI biến thể trong variants phải có
  sku riêng (không bỏ trống). retailPrice cấp sản phẩm là TUỲ CHỌN — nếu điền, nó trở
  thành "giá chung" cho biến thể nào không tự khai retailPrice riêng; nếu bỏ hẳn, MỖI
  biến thể bắt buộc phải tự có retailPrice riêng (không bỏ trống). Biến thể có
  retailPrice riêng thì salePrice riêng (nếu có) mới có tác dụng — biến thể không có
  retailPrice riêng mà khai salePrice riêng sẽ bị từ chối.
- Ảnh trong descriptionBlocks/suitabilitySection/sizeGuideSection LUÔN bị xoá khi nạp, dù
  đúng kho MinIO hay không — không cần tìm ảnh thật cho các trường này lúc soạn file nhập.
  Khối "Ảnh + chữ" (feature) vẫn giữ, chỉ mất phần ảnh, cần chọn ảnh thật lại trong trang
  quản trị. Ảnh đại diện/gallery/video sản phẩm trong file tải về có thể giữ nguyên, hệ
  thống sẽ bỏ qua khi nạp Nháp.
- Quy tắc HTML cho specifications: bảng phải có <table class="shop_attributes"> với
  style="width:100%;border-collapse:collapse;font-family:var(--bb-font-body);
  font-size:var(--bb-text-a4-content);color:var(--bb-text-primary);". Chỉ cần <tbody> —
  KHÔNG cần <thead> (khác sizeGuideSection bên dưới). Mỗi dòng theo mẫu <tr>
  <th scope="row" style="background:var(--bb-bg-surface-raised);color:var(--bb-text-primary);
  border:1px solid var(--bb-border-subtle);padding:12px 16px;">Tên</th>
  <td style="border:1px solid var(--bb-border-subtle);padding:12px 16px;">Giá trị</td></tr>.
  Giữ nguyên các var(--bb-...) — KHÔNG đổi thành hex hay !important, KHÔNG gán cứng
  font-size riêng trên từng th/td.
- Quy tắc HTML cho specStats: COPY Y NGUYÊN kèm TẤT CẢ inline-style, chỉ thay chữ (số
  liệu + nhãn). KHÔNG rút gọn, KHÔNG bỏ style. Bắt buộc giữ: <div class="bb-specstats">
  có display:grid + border/background dùng var(--bb-border-subtle); mỗi ô là <div>
  riêng có display:flex;flex-direction:column + padding + nền var(--bb-bg-surface);
  trong ô đúng 2 <span> (số liệu trước font-size:var(--bb-text-a2-page) in đậm màu
  var(--bb-action-primary); nhãn sau font-size:var(--bb-text-a5-meta) in hoa màu
  var(--bb-text-secondary) — KHÔNG thêm opacity). Tối đa 4 ô. TUYỆT ĐỐI KHÔNG dùng <br>
  thay ô, KHÔNG bỏ display:grid — thiếu là web đổ ra chữ căn giữa xếp dọc, hỏng dạng
  bảng. Giữ nguyên các var(--bb-...) — không hardcode hex.
- Quy tắc HTML cho trustBadges: COPY Y NGUYÊN kèm TẤT CẢ inline-style, chỉ thay chữ
  nhãn. Container <div class="bb-trust-badges"> dùng style="display:flex;flex-wrap:wrap;
  align-items:center;gap:8px 16px;font-family:var(--bb-font-body);
  font-size:var(--bb-text-a5-meta);line-height:1;color:var(--bb-text-secondary)"
  (line-height:1 bắt buộc — khớp leading-none mà web ép trên dải này). Mỗi nhãn là
  <span style="display:flex;align-items:center;gap:8px;line-height:1"> chứa đúng 2
  <span>: chấm màu là 1 span RỖNG tô nền bằng style (height:6px;width:6px;
  background:var(--bb-action-primary)) — TUYỆT ĐỐI KHÔNG dùng ký tự "•", KHÔNG để chữ
  trần ngoài span — rồi span thứ hai chứa chữ. Giữ nguyên các var(--bb-...) — không
  hardcode hex.
- Quy tắc HTML cho suitabilitySection.html: bọc trong <ul class="suitability-list">,
  mỗi dòng đúng mẫu <li><strong>Tên đối tượng</strong> → Lời khuyên</li>.
- Quy tắc HTML cho sizeGuideSection.html: COPY Y NGUYÊN khối HTML kèm TẤT CẢ inline-style
  — chỉ thay chữ (tên cột + số liệu), KHÔNG rút gọn, KHÔNG bỏ style, KHÔNG tự chọn
  màu/cỡ chữ khác — giữ nguyên mọi var(--bb-...), đó là biến font/màu thật của web,
  không đổi thành hex hay px cụ thể. Bảng phải có đủ <thead>/<tbody>; <table> dùng đúng
  style="width:100%;min-width:520px;border-collapse:collapse;
  font-family:var(--bb-font-body);font-size:var(--bb-text-a4-content);line-height:1.5;
  color:var(--bb-text-primary);margin:0 0 12px 0;"; <th> dùng đúng
  style="background:var(--bb-bg-surface-raised);color:var(--bb-text-primary);
  border:1px solid var(--bb-border-subtle);padding:12px 16px;text-align:center;
  font-weight:700;white-space:nowrap;"; <td> dùng đúng style="border:1px solid
  var(--bb-border-subtle);padding:12px 16px;text-align:center;vertical-align:middle;",
  riêng cột size (cột đầu tiên) thêm font-weight:700 vào <td>. Ghi chú nếu có đặt trong
  <p style="font-family:var(--bb-font-body);font-size:var(--bb-text-a5-meta);
  line-height:1.5;color:var(--bb-text-secondary);margin:8px 0 0 0;"><em>...</em></p>
  bên ngoài <table>, không có ghi chú thì bỏ hẳn <p>. KHÔNG set width cố định theo px
  cho từng cột (chỉ min-width ở <table>), KHÔNG bọc <table> trong <div> nếu không cần,
  KHÔNG nền tối/đổ bóng/bo góc/gradient/emoji.
- Tất cả 5 mục HTML trên: KHÔNG <script>, KHÔNG <style>, KHÔNG id.
- JSON chỉ chứa các khoá trong hướng dẫn, KHÔNG thêm khoá lạ, KHÔNG thêm ghi chú. Đặc biệt suitabilitySection/sizeGuideSection CHỈ có đúng 4 trường title/titleEn/html/htmlEn — KHÔNG có url/urlEn (khác với khối feature (Ảnh + chữ) trong descriptionBlocks có dùng url). Thừa 1 trường lạ (kể cả để null) sẽ làm CẢ FILE bị từ chối khi nhập.
- Mỗi cột song ngữ PHẢI là object lồng { ...VI, ...EN } — KHÔNG tách tên VI ra ngoài
  rồi dồn hết bản tiếng Anh vào một khối translations riêng (shape cũ đã bỏ).
- Không để chữ nháp [Cần ảnh]/[gắn link]; link sản phẩm khác dùng URL thật hoặc bỏ.
- Nội dung tiếng Việt có dấu đầy đủ, đúng chính tả.
- Các khoá sau **không bắt buộc khi nhập**; nếu file tải về có sẵn thì giữ nguyên cũng được,
  hệ thống sẽ tự bỏ qua khi nạp Nháp: publishStatus, image, gallery, videos,
  relatedProductIds, accessoryProductIds, variants[].id, variants[].imageUrl,
  variants[].imageAlt, variants[].gallery.
```

Kiểm tra sau khi AI trả về: mở JSON bằng công cụ kiểm tra (jsonlint) xem có hợp lệ không; rà mọi sản phẩm đều có đúng `categoryId: "uncategorized"` và `brandId: "uncategorized-brand"` (AI không tự gán danh mục/thương hiệu thật nào khác); rà mỗi cột song ngữ đều là object lồng (không còn khoá `translations` rời). Sau khi nạp xong, nhớ vào Admin mở từng sản phẩm gán lại đúng danh mục/thương hiệu thật. (Không cần rà nguồn ảnh trong descriptionBlocks/suitabilitySection/sizeGuideSection nữa — ảnh ở đây luôn bị xoá khi nạp bất kể nguồn.)
