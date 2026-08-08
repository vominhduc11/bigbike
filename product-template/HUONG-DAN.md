# Bộ template nhập sản phẩm BigBike — Hướng dẫn cho AI & người dùng

Chỉ còn **1 file duy nhất**: `mau-day-du.json`. Mỗi object trong mảng = **một sản phẩm hoàn chỉnh** (hàng hoá + nội dung). Nạp ở trang quản trị: **Sản phẩm → Nhập từ file**, hai bước *Kiểm tra* (xem trước, chưa lưu) → *Xác nhận nhập* (lưu thật).

> ### ⛔ Từ 2026-08-08 (chủ shop chốt): **FILE NHẬP KHÔNG CÒN PHẦN BIẾN THỂ**
>
> Nạp file JSON **không bao giờ** tạo, sửa hay xoá biến thể (màu/size) nữa. Cụ thể:
> - **File soạn để nhập: bỏ hẳn khoá `variants`.** Không cần và không nên viết vào.
> - **Nạp file để cập nhật sản phẩm đang có biến thể → biến thể giữ nguyên 100%** (SKU, giá riêng, ảnh màu, tồn kho, mối gắn danh sách màu chuẩn). Trước đây nạp file sẽ thay thế toàn bộ danh sách biến thể và **xoá mất** biến thể nào không được liệt kê lại — nay không còn rủi ro đó.
> - **Nạp file để tạo sản phẩm mới → sản phẩm ra đời không có biến thể nào.** Vì vậy `retailPrice` cấp sản phẩm **luôn bắt buộc** (`> 0`) khi tạo mới — không còn cách "để giá ở từng biến thể".
> - **Thêm/sửa/xoá biến thể làm trực tiếp trong trang quản trị**, mục "Lựa chọn sản phẩm" ở trang chi tiết sản phẩm (có sẵn thêm từng cái, nhân bản, xoá hàng loạt, điền giá hàng loạt, trình tạo biến thể theo tổ hợp màu × size).
> - **File cũ vẫn nạp được:** file soạn trước đây hoặc file **Export JSON** tải về vẫn còn khoá `variants` — hệ thống vẫn nhận file, tự bỏ qua phần biến thể và hiện **cảnh báo vàng** trên bảng kiểm tra ("Tệp có phần biến thể — hệ thống đã bỏ qua"). Không phải sửa file tay.
> - **Export JSON vẫn xuất đầy đủ biến thể** để xem/đối chiếu — chỉ chiều nhập là bỏ qua.
>
> Mọi đoạn nói về `variants` ở phần dưới đây chỉ còn giá trị cho **file Export**, không áp dụng khi nhập.

> **Trước đây** bộ này gồm 2 file (CSV hàng hoá + JSON nội dung, khớp nhau bằng SKU). **Từ 2026-07-06 gộp về 1 file JSON** — file JSON chứa hàng hoá và nội dung chính cần nhập hàng loạt (giá, SEO, mô tả, FAQ, dải tin cậy, cam kết…), nên không cần CSV nữa. Ảnh/video/sản phẩm liên quan/biến thể vẫn sửa trực tiếp trong trang quản trị khi muốn đổi thật.
>
> **Từ 2026-07-07: mỗi cột song ngữ gộp chung thành 1 object lồng nhau** ngay tại vị trí cột đó — ví dụ tên sản phẩm giờ là `"name": { "nameVI": "...", "nameEN": "..." }` thay vì `"name": "..."` ở ngoài + `translations.en.name` ở một khối riêng cuối object. Khoá `translations` cấp cao nhất **không còn tồn tại**. File `mau-day-du.json` và file **Export JSON** của từng sản phẩm đều dùng đúng shape này — nhập và xuất từng sản phẩm luôn khớp nhau.
>
> **Từ 2026-07-19: nút "Tải dữ liệu hiện tại" / export toàn bộ catalog đã gỡ khỏi hộp thoại Nhập.** Không còn cách tải toàn bộ sản phẩm hiện có làm một file mẫu từ Admin. Muốn lấy sườn nhập chung thì dùng `mau-day-du.json` trong bộ này; muốn lấy dữ liệu đang có của một sản phẩm cụ thể thì mở trang chi tiết sản phẩm đó và bấm **Export JSON**.
>
> **Cũng từ 2026-07-07: "Phù hợp với ai" và "Bảng size" tách khỏi `descriptionBlocks`** thành 2 khoá riêng cấp cao nhất `suitabilitySection`/`sizeGuideSection` (đảo lại quyết định trước đó là để chúng làm khối `type: "suitability"`/`"sizeGuide"` trong mảng mô tả) — trình dựng mô tả sản phẩm trên trang quản trị chỉ còn 4 khối Notion: **mô tả**, **hình ảnh**, **ảnh phải + chữ trái**, **ảnh trái + chữ phải**.
>
> **Từ 2026-07-07: cột tiếng Việt và tiếng Anh của MỌI cặp song ngữ luôn xuất hiện song song trên file XUẤT RA, mỗi khi object/khối đó đã được dùng.** File **Export JSON** của 1 sản phẩm in đủ cả 2 vế của mỗi cặp VI/EN — từng phần tử trong các mảng (`faqs[]`, `commitments[]`, `highlights.positiveNotes/negativeNotes[]`), và từng khối trong `descriptionBlocks` (`html/htmlEn`, `alt/altEn`, `caption/captionEn`, `subheading/subheadingEn`, `heading/headingEn`) cũng như `suitabilitySection`/`sizeGuideSection` khi 2 khoá này có được dùng (`title/titleEn`, `html/htmlEn`) — **vế nào chưa có nội dung thì hiện `null`, không còn bị bỏ hẳn khoá**. Nhưng nếu cả object/mảng đó không được dùng đến (vd sản phẩm không có FAQ nào, hoặc không dùng `sizeGuideSection`) thì khoá cha vẫn **bỏ hẳn** như trước — quy tắc chỉ null-fill 2 vế của một cặp đã tồn tại, không tự tạo ra khối rỗng.
>
> **Từ 2026-07-15 (quyết định của chủ shop): file XUẤT RA của từng sản phẩm phải đầy đủ, còn file NHẬP VÀO được thiếu.** Khi bấm **Export JSON** ở trang chi tiết một sản phẩm, hệ thống xuất cả `publishStatus`, `image` (ảnh đại diện), `gallery` (gallery ảnh sản phẩm), `videos`, `relatedProductIds`, `accessoryProductIds` và cả mảng `variants` (kèm `id`, `imageUrl`, `imageAlt`, `gallery` của từng biến thể). Nhưng khi nạp JSON, các nhóm này **không bắt buộc**; nếu file có sẵn thì hệ thống vẫn cho nạp và tự lược bỏ trước khi lưu. Muốn đổi ảnh/video/sản phẩm liên quan/hoàn thiện bộ bảo hộ/biến thể hoặc đăng bán thì sửa trực tiếp trong trang quản trị.
>
> Riêng nhóm object cấp sản phẩm sau LUÔN xuất hiện trên file XUẤT RA, kể cả khi sản phẩm không có nội dung gì cho khoá đó: `shortDescription`, `specifications`, `specStats`, `trustBadges`, `quickAnswerSummary`, `originBrandCountry`, `seo` (`titleVI/EN`, `descriptionVI/EN`; `canonicalUrl` không tính). Sản phẩm không có dữ liệu nào ở khoá đó → cả 2 vế VI/EN hiện `"...": null` thay vì bỏ hẳn cả khoá. `name`/`slug` luôn có sẵn (bắt buộc) nên trong thực tế luôn xuất hiện, không đổi gì.
>
> Quy tắc "song song VI/EN" này **chỉ áp dụng cho file XUẤT RA**. Khi bạn tự soạn file NHẬP VÀO (tạo mới hoặc cập nhật), vẫn được **bỏ hẳn** một vế (hoặc cả object/cả khối, kể cả với nhóm cấp sản phẩm luôn-xuất-hiện ở trên) không có nội dung như trước — hệ thống không phân biệt được "khoá vắng mặt" với "khoá có giá trị `null`" khi đọc file (JSON `null` và khoá bị bỏ hẳn được xử lý giống hệt nhau lúc nhập), nên cách viết nào cũng hợp lệ. `canonicalUrl` (trong `seo`) và những khoá không phải cặp song ngữ (`sortOrder`, `icon`, `id`, `sku`, `retailPrice`…) không nằm trong quy tắc null-fill — vẫn bỏ hẳn khi không có nội dung, không ghi `null`.
>
> **Cũng từ 2026-07-07: `salePrice` (Giá sale) luôn xuất hiện trên file XUẤT RA**, ở cả cấp sản phẩm và từng biến thể trong `variants[]` — sản phẩm/biến thể nào không giảm giá thì hiện `"salePrice": null` thay vì bị bỏ hẳn khoá. `salePrice` cấp sản phẩm khi nhập thì ghi `null` hay bỏ hẳn khoá đều an toàn như nhau — không xoá nhầm dữ liệu. (Cảnh báo cũ về `variants[].salePrice: null` xoá thật giá khuyến mãi **không còn áp dụng** từ 2026-08-08: nhập file không đọc `variants` nữa.)
>
> **Từ 2026-07-07 (nay chỉ còn áp dụng cho biến thể tạo/sửa TRONG TRANG QUẢN TRỊ, không qua nhập file): `retailPrice`/`salePrice` cấp sản phẩm có thể làm "giá chung" cho biến thể chưa tự khai giá riêng.** Trước đây, sản phẩm có `variants[]` thì **mỗi biến thể bắt buộc phải tự có `retailPrice` riêng**, không có ngoại lệ. Nay: nếu sản phẩm **có** `retailPrice` cấp sản phẩm hợp lệ (`> 0`), biến thể nào **không** khai `retailPrice` riêng sẽ **tự dùng trọn giá chung đó** (cả `retailPrice` lẫn `salePrice` cấp sản phẩm) làm giá hiệu lực — hiển thị lẫn tính tiền. Biến thể nào **có** khai `retailPrice` riêng thì dùng đúng giá (và `salePrice`) riêng đó, **không** rơi về giá chung nữa dù không khai `salePrice` riêng (biến thể đó xem như không giảm giá, chứ không tự lấy `salePrice` chung). **Nếu sản phẩm không có `retailPrice` cấp sản phẩm hợp lệ VÀ biến thể cũng không có `retailPrice` riêng → vẫn báo lỗi** (không có giá nào để dùng). **Cấm:** biến thể có `salePrice` riêng mà KHÔNG có `retailPrice` riêng — bị từ chối lúc lưu, vì `salePrice` đó sẽ bị bỏ qua âm thầm nếu không có `retailPrice` riêng đi kèm.
>
> **Từ 2026-07-22:** khóa chuẩn cho danh mục là `categorySlugs: string[]`, theo đúng thứ tự; phần tử đầu là danh mục chính. Nên dùng ít nhất một slug danh mục đang hiển thị do shop cung cấp khi biết trước. Có thể dùng `categoryIds: string[]` thay cho slug list khi biết ID nội bộ; `categoryId` cũ chỉ là alias một phần tử trong giai đoạn chuyển đổi, không được gửi cùng mảng mới. Danh mục trùng bị gộp theo lần xuất hiện đầu; danh mục không tồn tại, đã ẩn hoặc nằm trong Thùng rác (**trừ giá trị `uncategorized`, xem ngay dưới**) sẽ làm lỗi đúng dòng nhập. Sau khi nạp, admin có thể gán lại danh mục thật và đổi thứ tự.
>
> **Cũng từ 2026-07-22 (owner chốt): `categorySlugs`/`categoryIds`/`categoryId` và `brandId` không còn bắt buộc khi dòng nhập TẠO SẢN PHẨM MỚI.** Bỏ hẳn cả 2 nhóm khoá này (không biết danh mục/thương hiệu thật, hoặc chưa muốn tra cứu) → sản phẩm vẫn nhập được, tự động gắn danh mục hệ thống **"Chưa phân loại"** (`uncategorized`) và thương hiệu hệ thống **"Chưa phân loại"** (`uncategorized-brand`) — đúng nhóm dùng để gom sản phẩm mồ côi khi xoá vĩnh viễn danh mục/thương hiệu, nay dùng thêm cho trường hợp nhập file không rõ phân loại. Hai giá trị này **chỉ dùng được qua đường nhập file** (không chọn được qua ô danh mục/thương hiệu trên trang quản trị — dropdown ở đó không liệt kê chúng), và sản phẩm nhập kiểu này vẫn ở **Nháp**: admin phải tự vào trang chi tiết sản phẩm gán danh mục + thương hiệu thật trước khi đăng bán (đăng bán vẫn đòi đủ 2 trường như trước, không đổi). Nếu **biết** đúng slug thật thì cứ điền như bình thường — cách này chỉ dành cho lúc chưa biết hoặc chưa muốn tra cứu. Hành vi mặc định-về-"Chưa phân loại" này **chỉ áp dụng khi tạo sản phẩm mới**; dòng nhập **cập nhật** sản phẩm đã có mà bỏ hẳn 2 nhóm khoá này vẫn **giữ nguyên** danh mục/thương hiệu hiện tại như trước (không bị đổi thành "Chưa phân loại").

---

## ⛔ 5 quy tắc BẮT BUỘC (sai là hỏng)

1. **`categorySlugs` nên điền khi tạo mới nếu đã biết danh mục thật, nhưng không còn bắt buộc (owner chốt 2026-07-22).** Đây là mảng slug danh mục theo thứ tự (ví dụ `["mu-bao-hiem", "phu-kien"]`); `brandId` là slug thương hiệu (ví dụ `ls2`). Hệ thống chỉ đối chiếu, không tự tạo; slug không tồn tại, bị ẩn hoặc nằm trong Thùng rác làm lỗi dòng đó. `categoryIds` là lựa chọn thay thế khi file có ID nội bộ; `categoryId` cũ là alias một slug trong giai đoạn chuyển đổi, tuyệt đối không gửi cùng `categorySlugs` hoặc `categoryIds`. Nếu dùng AI soạn file mà shop đã cung cấp slug danh mục đang hiển thị cho sản phẩm đó thì dùng đúng slug đó; **nếu chưa biết, AI có thể bỏ hẳn khoá `categorySlugs`/`brandId`** thay vì dừng lại hỏi hay tự đoán — xem ngay dưới.
   **Nếu tự tay soạn file** (không qua AI) và biết rõ đúng slug thật thì ghi thẳng danh sách slug theo thứ tự — **không tự đặt/đoán slug** cho danh mục hoặc thương hiệu chưa chắc đã có trong hệ thống (kể cả khi đó là thương hiệu/nhóm sản phẩm có thật ngoài đời — ví dụ bịa `"kovix"` khi shop chưa từng bán hàng Kovix, hoặc bịa `"khoa-chong-trom"` khi shop chưa có danh mục khoá) — phải hỏi lại người bán để lấy đúng slug đang dùng trong Admin, hoặc đơn giản là **bỏ hẳn khoá** đó. Từ 2026-07-22: `categorySlugs` bỏ trống lúc **tạo mới** không còn báo lỗi — sản phẩm tự gắn danh mục hệ thống **"Chưa phân loại"** (`uncategorized`) để admin gán lại sau (chi tiết ở changelog đầu file); `brandId` **được phép bỏ hẳn khoá** tương tự — sản phẩm tự gắn thương hiệu hệ thống **"Chưa phân loại"** (`uncategorized-brand`). Cả hai đều chỉ hiện dấu "—"/"Chưa phân loại" trên trang quản trị, không hiện gì trên web cho tới khi admin gán danh mục/thương hiệu thật. **Lưu ý:** hành vi tự-gán-"Chưa phân loại" này chỉ áp dụng khi **tạo sản phẩm mới**; dòng nhập **cập nhật** sản phẩm đã có bỏ hẳn 2 khoá này vẫn giữ nguyên danh mục/thương hiệu hiện tại, không bị đổi thành "Chưa phân loại" (xem mục "Cập nhật sản phẩm đã có" bên dưới).
   Khi **tạo mới** phải có `name.nameVI` và `name.nameEN` — thiếu tên tiếng Anh sẽ báo lỗi dòng đó. Khi **cập nhật** sản phẩm cũ: nếu file **không** đổi tên, có thể bỏ hẳn khoá `name` (tên VI/EN cũ được giữ nguyên); nhưng nếu file **có** đổi `nameVI`, bắt buộc phải kèm `nameEN` mới trong cùng khoá `name` đó.
   - **Ma trận trường bắt buộc (PRODUCT_RULE_005, áp dụng ngay cả khi import, vì import gọi thẳng luồng lưu sản phẩm thường):** Luôn bắt buộc: `name` (khi tạo mới)/`gender`. **Riêng `categorySlugs` (hoặc `categoryIds`)/`brandId` — từ 2026-07-22 không còn bắt buộc lúc import** (xem changelog đầu file): bỏ hẳn khi tạo mới thì tự gán "Chưa phân loại" thay vì báo lỗi; PRODUCT_RULE_005 áp dụng nguyên vẹn (bắt buộc cả 2, dù nháp hay đăng) chỉ cho form tạo/sửa 1 sản phẩm trên trang quản trị. **`sku` và `retailPrice` (`> 0`) cấp sản phẩm luôn bắt buộc khi TẠO MỚI** — thiếu 1 trong 2 sẽ báo lỗi dòng đó. Từ 2026-08-08 không còn phân nhánh "có/không biến thể": nhập file không tạo biến thể, nên sản phẩm mới luôn ở dạng không biến thể và luôn cần giá cấp sản phẩm. (Sau khi nạp, thêm biến thể trong trang quản trị thì mới đặt được giá riêng cho từng biến thể.) Ảnh **không bao giờ bắt buộc lúc nhập** vì nhập luôn tạo Nháp — ảnh chỉ bắt buộc khi admin bấm "Đăng" thủ công sau đó trong trang quản trị.
2. **Ảnh trong nội dung LUÔN bị hệ thống xoá trắng khi nhập — không có ngoại lệ.** `descriptionBlocks`/`suitabilitySection`/`sizeGuideSection` dùng ảnh gì (kể cả ảnh đã đúng kho MinIO của shop) cũng đều bị lược bỏ trước khi lưu, giống hệt ảnh đại diện/gallery/video sản phẩm. Khối "Hình ảnh" và khối "Ảnh phải/trái + chữ" vẫn được giữ (không bị xoá cả khối) nhưng luôn ở trạng thái "chưa có ảnh" — vào trang quản trị bấm chọn ảnh cho từng khối sau khi nạp. `url` của khối "Hình ảnh" vẫn là ô **bắt buộc phải điền một giá trị** để file hợp lệ (không được để trống), nhưng giá trị đó **không được dùng** — điền tạm URL nào cũng được, không cần và không nên mất công tìm ảnh MinIO thật cho việc này.
3. **JSON KHÔNG được có khoá lạ.** Chỉ dùng đúng các khoá liệt kê bên dưới. Thừa 1 khoá (kể cả khoá ghi chú `_comment`) → **cả file bị từ chối**. Muốn ghi chú thì ghi ở file hướng dẫn này, không ghi trong file JSON.
4. **KHÔNG để chữ nháp lọt ra khách:** bỏ hết `[Cần ảnh: ...]`, `[gắn link]`, `[Bigbike kiểm tra bổ sung]`. Link sản phẩm khác phải là URL thật hoặc bỏ.
5. **URL (canonical, link nội dung)** chỉ dùng `https://bigbike.vn/...` (hoặc `www.bigbike.vn`) theo file mẫu. Không dùng host ngoài khác. Từ 2026-08-06 địa chỉ IP `103.1.236.148` **không còn được chấp nhận** — file JSON dùng IP sẽ bị từ chối khi nạp.

> **Tạo sản phẩm MỚI qua nhập file luôn ở trạng thái Nháp.** Sau khi nạp xong, vào trang quản trị **bấm đăng tay** để lên web. **Cập nhật sản phẩm ĐÃ CÓ (kể cả đang bán) thì nạp file KHÔNG đổi trạng thái đăng bán** — sản phẩm đang bán vẫn tiếp tục hiển thị trên web sau khi nạp, chỉ nội dung/giá trong file mới được cập nhật (chi tiết ở mục "Cập nhật nội dung cho sản phẩm ĐÃ CÓ sẵn" bên dưới; sửa lỗi 2026-08-08 — bản trước có đoạn hướng dẫn sai, ép cả cập nhật về Nháp).

---

## Cấu trúc file: mảng `[ { sản phẩm 1 }, { sản phẩm 2 } ]`

Mỗi sản phẩm dùng các khoá sau. Khi cập nhật lại: khoá không đưa vào → dữ liệu cũ **giữ nguyên** (xem "Cập nhật sản phẩm đã có") — đây là quy tắc cho **file nhập thật**.

> **`mau-day-du.json` (file mẫu tham khảo trong bộ này) là file mẫu cho NHẬP VÀO, không phải bản sao của file Export JSON từng sản phẩm.** Với các khoá song ngữ dùng để nhập nội dung, file mẫu theo cùng shape null-fill VI/EN như file Export (xem bên dưới). Nhưng nhóm khoá chỉ có ý nghĩa khi Xuất và luôn bị hệ thống lược bỏ lúc Nhập — `publishStatus`, `image`, `gallery`, `videos`, `relatedProductIds`, `accessoryProductIds` và cả mảng `variants` — **không xuất hiện trong `mau-day-du.json`**, dù file Export JSON thật của một sản phẩm có đủ các khoá này. Mỗi object mẫu chỉ liệt kê khoá nào sản phẩm đó thực sự có; khoá tuỳ chọn hoàn toàn không dùng (cả VI lẫn EN đều không có, hoặc cả object/mảng không dùng) thì **bị bỏ hẳn** — **trừ nhóm object cấp sản phẩm luôn-xuất-hiện** (`shortDescription`, `specifications`, `specStats`, `trustBadges`, `quickAnswerSummary`, `originBrandCountry`, `seo`; xem quy tắc 2026-07-07 mới nhất ở đầu file) — nhóm này vẫn hiện đủ khoá với `null` dù sản phẩm không có nội dung gì. Với mọi cặp khoá song ngữ khác **đã có ít nhất 1 vế** (object hoặc phần tử mảng đó có được xuất ra), **cả 2 vế VI/EN luôn cùng xuất hiện** — vế nào chưa dịch thì hiện `null`. Khi copy ra làm file nhập thật: nếu đang **tạo mới**, chỉ cần điền khoá nào có nội dung — có thể **giữ nguyên `null`** ở vế chưa dịch (hệ thống hiểu như bỏ trống) hoặc xoá hẳn khoá đó đi, cả hai cách đều hợp lệ. Nếu đang **cập nhật sản phẩm đã có**, phải **xoá hẳn** khoá nào không muốn đổi trước khi nạp — gửi một khoá song ngữ chỉ có 1 trong 2 vế (vd `"name": { "nameEN": "..." }` không có `nameVI`) là hợp lệ và chỉ đổi đúng vế đó, vế còn lại giữ nguyên dữ liệu cũ; gửi `"nameVI": null` tương đương với bỏ hẳn khoá đó (không xoá dữ liệu cũ).

### Nhận diện & hàng hoá
| Khoá | Kiểu | Ghi chú |
|---|---|---|
| `sku` | chuỗi | **SKU cấp sản phẩm.** Dùng để đối chiếu cập nhật (trùng SKU → cập nhật đúng sản phẩm thay vì tạo trùng). **Luôn bắt buộc.** |
| `slug` | obj | `{ "slugVI": "...", "slugEN": "..." }`. `slugVI` là đường dẫn trang tiếng Việt (ví dụ `scs-cam-s`). `slugEN` tuỳ chọn — bỏ trống thì web tự dùng `slugVI` cho cả 2 ngôn ngữ. |
| `name` | obj | `{ "nameVI": "...", "nameEN": "..." }`. `nameVI` là tên tiếng Việt; `nameEN` **bắt buộc kèm theo khi tạo mới** hoặc khi đổi `nameVI` (xem quy tắc 1). |
| `categorySlugs` | mảng chuỗi | **Tuỳ chọn khi tạo mới (từ 2026-07-22).** Các slug danh mục đang hiển thị theo thứ tự; phần tử đầu là danh mục chính (ví dụ `["mu-bao-hiem", "phu-kien"]`). AI chỉ dùng slug shop đã cung cấp, không đoán. Bỏ hẳn khoá (hoặc ghi `["uncategorized"]`) → sản phẩm mới tự gắn danh mục "Chưa phân loại", admin gán lại sau. `categoryIds` là lựa chọn thay thế theo ID nội bộ; `categoryId` cũ chỉ là alias một phần tử và không được kết hợp với mảng mới. |
| `brandId` | chuỗi | **Tuỳ chọn.** slug thương hiệu (ví dụ `ls2`). Chưa rõ thương hiệu → bỏ hẳn khoá (hoặc ghi `"uncategorized-brand"`, tương đương) — sản phẩm mới tự gắn thương hiệu "Chưa phân loại", admin gán lại sau. |
| `gender` | chuỗi | **BẮT BUỘC.** `Nam` / `Nữ` / `Unisex`. |
| `originBrandCountry` | obj | `{ "originBrandCountryVI": "Trung Quốc", "originBrandCountryEN": "China" }` — xuất xứ thương hiệu, hiển thị ở ô "Thương hiệu (nước)" trên trang quản trị. Tối đa 120 ký tự mỗi vế, cả object tuỳ chọn. |
| `retailPrice` | số | Giá bán lẻ (VNĐ, số nguyên, **không** dấu phẩy/chấm ngăn cách). **Luôn bắt buộc khi tạo sản phẩm mới** (`> 0`) — từ 2026-08-08 sản phẩm tạo qua file không có biến thể nào để mang giá thay. Khi **cập nhật** sản phẩm đã có thì tuỳ chọn: bỏ hẳn khoá (hoặc `null`) = giữ nguyên giá cũ. File Export JSON có thể ghi `null` với sản phẩm chỉ có giá theo từng biến thể. |
| `salePrice` | số | Giá khuyến mãi (tuỳ chọn) — luôn có mặt trong file tải xuống, `null` khi sản phẩm không giảm giá. |
| `image` / `gallery` | obj/mảng | File **xuất ra có thể có đầy đủ** ảnh đại diện và gallery. Khi **nhập vào**, 2 nhóm này không bắt buộc; nếu có thì hệ thống tự lược bỏ, không dùng để tạo/sửa ảnh. Ảnh sửa trực tiếp trong trang quản trị. |
| `shortDescription` | obj | `{ "shortDescriptionVI": "...", "shortDescriptionEN": "..." }` — mô tả ngắn (HTML đơn giản), mỗi vế tuỳ chọn độc lập. |
| `specifications` | obj | `{ "specificationsVI": "...", "specificationsEN": "..." }` — bảng thông số kỹ thuật (HTML thô), mỗi vế tuỳ chọn độc lập. |
| `seo` | obj | `{ "titleVI": "...", "titleEN": "...", "descriptionVI": "...", "descriptionEN": "...", "canonicalUrl": "https://bigbike.vn/product/..." }`. `canonicalUrl` không tách VI/EN — dùng chung 1 khoá. |
| `relatedProductIds` / `accessoryProductIds` | mảng chuỗi | File **xuất ra có đầy đủ** sản phẩm liên quan và hoàn thiện bộ bảo hộ. Khi **nhập vào**, 2 nhóm này không bắt buộc; nếu có thì hệ thống tự lược bỏ, không dùng để sửa liên kết. |

### Biến thể (màu/size) — **KHÔNG nhập qua file**

Từ 2026-08-08, khoá `variants` **không còn là phần của file nhập**. Đừng viết nó vào file soạn mới.

- **Tạo sản phẩm mới bằng file** → sản phẩm ra đời **không có biến thể nào**, giá lấy từ `retailPrice` cấp sản phẩm (bắt buộc). Nạp xong vào trang quản trị mở sản phẩm → mục **"Lựa chọn sản phẩm"** để thêm màu/size, đặt giá riêng, ảnh màu, còn/hết hàng.
- **Cập nhật sản phẩm đã có biến thể bằng file** → toàn bộ biến thể hiện tại **giữ nguyên**, không mất, không đổi, kể cả khi file có ghi `variants` (phần đó bị bỏ qua kèm cảnh báo). File nhập chỉ đổi phần thông tin sản phẩm (tên, giá chung, mô tả, SEO, FAQ…).
- **File cũ / file Export JSON còn khoá `variants`** vẫn nạp bình thường — hệ thống hiện cảnh báo vàng "Tệp có phần biến thể — hệ thống đã bỏ qua" ở cột Chi tiết của bảng kiểm tra, các phần còn lại vẫn được lưu. Không cần sửa file tay.
- **Export JSON vẫn xuất đầy đủ biến thể** (SKU, giá, options, ảnh màu, gallery màu) để xem/đối chiếu/lưu trữ. Chỉ chiều nhập là bỏ qua.

**Vì sao đổi:** nạp file trước đây **thay thế toàn bộ** danh sách biến thể — biến thể nào không được liệt kê lại trong file sẽ bị xoá kèm lịch sử tồn kho, và màu nhập qua file không gắn được vào danh sách màu chuẩn của shop (nạp lại còn âm thầm gỡ mối gắn màu admin đã chọn tay). Quản lý biến thể trong trang quản trị tránh được cả hai.

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
Mỗi mục: `{ "content": "<p><strong>Pin ~35h</strong>, ít phải sạc</p>", "contentEn": "<p><strong>~35h battery</strong></p>", "sortOrder": 1 }` — `content`/`contentEn` cho phép HTML, mỗi vế ≤20000 ký tự. Chỉ dùng HTML đơn giản như `<p> <strong> <em> <ul> <ol> <li>`; không dùng `<script>`, `<style>` hoặc `id`. Khi **nhập file**, mọi ảnh `<img>` chèn trong `content`/`contentEn` bị xoá vô điều kiện (giữ lại phần chữ xung quanh), giống `descriptionBlocks`/`suitabilitySection`/`sizeGuideSection`.

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

- Vẫn phải có `sku` (khớp đúng sản phẩm đã tồn tại). Nếu không thay đổi danh mục, bỏ hẳn cả `categorySlugs`/`categoryIds` để giữ liên kết cũ; nếu thay đổi, gửi đầy đủ `categorySlugs` theo thứ tự mới.
- Khoá **không đưa vào file** → dữ liệu hiện có của khoá đó **giữ nguyên, không đổi, không mất**. Đây là lý do luôn nhắc "khoá nào không có nội dung thì bỏ hẳn khoá đó".
- Với các khoá song ngữ lồng nhau (`name`, `slug`, `shortDescription`, `specifications`, `specStats`, `trustBadges`, `quickAnswerSummary`, `originBrandCountry`, `seo`): chỉ cần gửi **vế nào muốn đổi** trong object đó — vd `"trustBadges": { "trustBadgesEN": "..." }` chỉ đổi bản tiếng Anh, bản tiếng Việt giữ nguyên. Bỏ hẳn cả khoá cha (vd bỏ hẳn khoá `trustBadges`) mới là "không đổi gì cả ở cột đó".
- **Ảnh, video, sản phẩm liên quan, hoàn thiện bộ bảo hộ và biến thể có thể xuất ra đầy đủ nhưng không quản lý qua file JSON nhập.** Khi nạp lại, hệ thống tự lược bỏ các nhóm này; muốn đổi thật thì sửa trực tiếp trong trang quản trị.
- Khoá **có đưa vào** trong số `commitments`, `highlights.positiveNotes`, `highlights.negativeNotes`, `faqs` → **thay thế toàn bộ danh sách cũ bằng danh sách mới**, không cộng dồn. Muốn giữ mục cũ + thêm mục mới → phải liệt kê lại **đầy đủ cả cũ lẫn mới** trong cùng mảng đó. (`positiveNotes`/`negativeNotes` là 2 mảng con độc lập trong `highlights` — chỉ đưa `highlights.positiveNotes` thì `negativeNotes` cũ vẫn giữ nguyên, và ngược lại.)
- **Biến thể (`variants`) KHÔNG nằm trong nhóm này** — nạp file không đụng tới biến thể, danh sách biến thể hiện có luôn giữ nguyên (từ 2026-08-08).
- `descriptionBlocks` cũng thay thế toàn bộ — sửa 1 đoạn vẫn phải dán lại **nguyên mảng khối mô tả đầy đủ** của sản phẩm đó (lấy từ trang quản trị hoặc từ file tải về), không chỉ đoạn muốn sửa.
- `suitabilitySection`/`sizeGuideSection` cũng thay thế **toàn bộ object** khi có đưa vào file — khác với nhóm "khoá song ngữ lồng nhau" ở trên (không merge riêng từng vế VI/EN), phải gửi đủ cả `title`/`titleEn`/`html`/`htmlEn` muốn giữ, không chỉ vế muốn sửa.

> Mẹo: nút tải JSON toàn bộ sản phẩm hiện có đã gỡ. Khi cần tạo file nhập mới, dùng `mau-day-du.json` làm mẫu. Khi cần sửa dựa trên dữ liệu đang có của một sản phẩm cụ thể, mở trang chi tiết sản phẩm đó và bấm **Export JSON**, rồi giữ lại đúng object cần nạp lại.

---

## Prompt mẫu để đưa cho AI

```
Bạn tạo dữ liệu nhập sản phẩm cho cửa hàng BigBike theo ĐÚNG cấu trúc dữ liệu của
template đính kèm (mau-day-du.json) — file mẫu này chỉ để tham khảo cấu trúc (tên khoá,
kiểu dữ liệu), KHÔNG copy nguyên giá trị categorySlugs/brandId mẫu có trong đó. Với mỗi sản
phẩm tôi cung cấp, hãy trả về MỘT object JSON trong một mảng JSON duy nhất, gồm:

- Hàng hoá: sku, categorySlugs (dùng slug danh mục đang hiển thị mà tôi cung cấp), brandId,
  gender, retailPrice, salePrice. TUYỆT ĐỐI KHÔNG thêm khoá variants — biến thể
  (màu/size) không nhập qua file, tôi tự thêm trong trang quản trị sau khi nạp.
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
- Mỗi object tạo mới cần `gender`. Với `categorySlugs`/`brandId`: dùng đúng slug tôi đã cung cấp
  trong danh sách khi tôi có cho — không tự khớp, không tự đoán, không tự đặt slug danh mục/thương
  hiệu. Nếu tôi chưa cung cấp danh mục/thương hiệu hợp lệ cho một sản phẩm, **cứ bỏ hẳn khoá đó** —
  từ 2026-07-22 hệ thống chấp nhận sản phẩm mới không có danh mục/thương hiệu, tự gắn "Chưa phân
  loại" để tôi vào trang quản trị gán lại sau, không cần dừng lại hỏi tôi hay liệt kê riêng.
- Mỗi sản phẩm tạo mới bắt buộc có sku + retailPrice cấp sản phẩm (số > 0). Không có
  ngoại lệ nào cho phép bỏ trống giá — file nhập không tạo biến thể nên không có chỗ
  nào khác mang giá.
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
  hệ thống sẽ tự bỏ qua khi nạp: publishStatus, image, gallery, videos,
  relatedProductIds, accessoryProductIds, và cả mảng variants (biến thể — bị bỏ qua kèm
  cảnh báo, quản lý trong trang quản trị).
```

Kiểm tra sau khi AI trả về: mở JSON bằng công cụ kiểm tra (jsonlint) xem có hợp lệ không; với sản phẩm nào CÓ ghi `categorySlugs`, rà không rỗng, không trùng và chỉ gồm slug danh mục đang hiển thị shop đã cung cấp (sản phẩm bỏ hẳn khoá này là chủ đích — không phải lỗi, sẽ tự vào "Chưa phân loại"); rà mỗi cột song ngữ đều là object lồng (không còn khoá `translations` rời). (Không cần rà nguồn ảnh trong descriptionBlocks/suitabilitySection/sizeGuideSection nữa — ảnh ở đây luôn bị xoá khi nạp bất kể nguồn.)
