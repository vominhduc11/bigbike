# Bộ template nhập sản phẩm BigBike — Hướng dẫn cho AI & người dùng

Bộ này gồm 2 file, dùng **cùng nhau**, nạp theo đúng thứ tự:

| File | Chứa gì | Nạp lúc nào |
|---|---|---|
| `mau-co-ban.csv` | Hàng hoá: SKU, tên, giá, kho, ảnh, **bảng thông số kỹ thuật (HTML)**, SEO, biến thể | **Nạp TRƯỚC** |
| `mau-day-du.json` | Nội dung kể chuyện: mô tả, **và tất cả khối marketing** (dải tin cậy, cam kết, ô số liệu, quick answer, ưu/nhược, FAQ, video, bảng size) | **Nạp SAU** |

> **Vì sao 2 file:** CSV nạp phần dạng bảng (giá/kho/ảnh) nhanh gọn; JSON nạp phần nội dung nhiều tầng mà CSV không có cột. JSON nạp sau sẽ **bổ sung** vào đúng sản phẩm CSV vừa tạo (khớp bằng SKU), **không xoá** dữ liệu CSV.

---

## ⛔ 5 quy tắc BẮT BUỘC (sai là hỏng)

1. **SKU phải KHỚP tuyệt đối** giữa 2 file. CSV dùng cột `SKU / mã model sản phẩm`; JSON dùng khoá `sku`. Lệch 1 ký tự → JSON tạo ra sản phẩm nháp trùng lặp thay vì cập nhật.
2. **Mọi ảnh phải là đường dẫn nội bộ `/media/...`** (ảnh đã có trong kho của shop). **KHÔNG** dán link ảnh ngoài (`https://media.bigbike.vn/...`, `bigbike.vn/wp-content/...`, Google Drive, Imgur…) — sẽ bị loại và sản phẩm mất ảnh. Nếu chưa có ảnh trong kho → để trống, bổ sung sau trong trang quản trị.
3. **JSON KHÔNG được có khoá lạ.** Chỉ dùng đúng các khoá liệt kê bên dưới. Thừa 1 khoá (kể cả khoá ghi chú `_comment`) → cả file JSON bị từ chối. Muốn ghi chú thì ghi ở đây, không ghi trong file JSON.
4. **KHÔNG để chữ nháp lọt ra khách:** bỏ hết `[Cần ảnh: ...]`, `[gắn link]`, `[Bigbike kiểm tra bổ sung]`. Link sản phẩm khác phải là URL thật hoặc bỏ.
5. **Canonical/URL** dùng tên miền thật, **không** dùng địa chỉ máy chủ thử nghiệm (`http://103.1.236.148:...`).

> Import **luôn tạo sản phẩm ở trạng thái Nháp** và **bỏ qua "Đã xuất bản"**. Sau khi nạp xong, vào trang quản trị **bấm đăng tay** để lên web.

---

## Phần 1 — File CSV (`mau-co-ban.csv`)

Giữ nguyên 43 cột. Điền các cột hàng hoá; **để TRỐNG** các cột nội dung dài (JSON lo):

- ✅ Điền: `Loại dòng`, `Mã sản phẩm nội bộ`, SKU, tên VI/EN, slug, danh mục, thương hiệu, giới tính, trạng thái, giá, giá sale, tình trạng kho, ảnh đại diện + thư viện ảnh, mô tả ngắn VI/EN, **Bảng thông số kỹ thuật VI/EN (HTML)**, SEO, sản phẩm liên quan, phụ kiện.
- ⬜ **Để trống:** `Mô tả chi tiết - Tiếng Việt/Anh` và `Bảng size - Tiếng Việt/Anh` → **JSON đảm nhiệm** (mô tả = `descriptionBlocks`, bảng size = block `sizeGuide`).

**Biến thể** (nếu sản phẩm có màu/size): thêm dòng `BIẾN THỂ` ngay dưới dòng `SẢN PHẨM CHÍNH`, **cùng `Mã sản phẩm nội bộ`**, điền `SKU bán hàng thực tế`, `Thuộc tính biến thể #1..3`, giá, kho, ảnh riêng. Xem ví dụ trong file CSV.

---

## Phần 2 — File JSON (`mau-day-du.json`)

Mảng `[ { sản phẩm 1 }, { sản phẩm 2 } ]`. Mỗi sản phẩm dùng các khoá sau (tất cả **tuỳ chọn trừ `sku`**; khoá nào không có nội dung thì **bỏ hẳn khoá đó**, đừng để rỗng vô nghĩa):

### Khoá nhận diện
| Khoá | Kiểu | Ghi chú |
|---|---|---|
| `sku` | chuỗi | **BẮT BUỘC.** Khớp CSV. |
| `categoryId` | chuỗi | **BẮT BUỘC — kể cả khi chỉ nạp JSON để cập nhật nội dung cho sản phẩm đã có sẵn, không tạo mới.** Là **slug danh mục**, giá trị giống hệt cột "Danh mục (slug)" trong CSV (ví dụ `dual-sport`) — KHÔNG phải mã nội bộ dạng `wp-cat-...`. Thiếu khoá này → cả dòng lỗi "Thiếu danh mục", dù mọi khoá khác trong file đều tuỳ chọn. |
| `translations.en.name` | chuỗi | Tên tiếng Anh (nên có để khớp bản CSV). |
| `relatedProductIds` | mảng chuỗi | SKU sản phẩm liên quan (giống cột CSV "Sản phẩm liên quan"). Tuỳ chọn — chỉ nên trỏ tới SKU **đang Đã xuất bản** (SKU ở trạng thái Nháp/Thùng rác chưa có trang để khách bấm vào). |
| `accessoryProductIds` | mảng chuỗi | SKU phụ kiện bán kèm (giống cột CSV "Phụ kiện bán kèm"). Tuỳ chọn, cùng lưu ý như trên. |

### Quick Answer — "Trả lời nhanh"
| Khoá | Kiểu | Giới hạn |
|---|---|---|
| `quickAnswerSummary` | chuỗi thường (không HTML) | **40–60 từ**, tối đa 600 ký tự. Tóm tắt sản phẩm là gì / cho ai / giá. |

### Ô số liệu nổi bật — `specStats` (**tối đa 4**)
Mỗi ô: `{ "value": "~35h", "label": "Pin nghe nhạc", "valueEn": "~35h", "labelEn": "Music battery", "sortOrder": 1 }`
`value` ≤60 ký tự, `label` ≤80 ký tự. Đây là **con số bán hàng** (pin, tầm xa, chống nước…), không phải bảng thông số.

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
- **Tính năng (Lợi ích/Bằng chứng/Hạn chế):** `{ "type": "feature", "subheading": "Nhãn ngắn", "heading": "Tiêu đề tính năng", "html": "<p><strong>Lợi ích:</strong></p><p>...</p><p><strong>Bằng chứng:</strong></p><p>...</p><p><strong>Hạn chế:</strong></p><p><em>...</em></p>" }`
- **Phù hợp với ai:** `{ "type": "suitability", "title": "PHÙ HỢP VỚI AI", "cards": [ { "audience": "Nhóm khách", "advice": "Lời khuyên" } ] }`
- **Bảng size:** `{ "type": "sizeGuide", "title": "Bảng size", "html": "<table>...</table><p>Cách đo...</p>" }` — **đây là nguồn hiển thị bảng size trên web** (KHÔNG dùng cột "Bảng size" trong CSV).

> Ảnh trong `html` cũng phải theo quy tắc `/media/...`. Không nhúng `<img src="link ngoài">`.

---

## Phần 2b — Cập nhật nội dung cho sản phẩm ĐÃ CÓ sẵn (không tạo mới)

Muốn sửa/bổ sung nội dung cho sản phẩm **đã đăng bán** (vd thêm FAQ, sửa mô tả, thêm dải tin cậy) mà **không đụng tới giá/tồn kho/ảnh đang đúng** → chỉ cần nạp **riêng file JSON**, không cần nạp lại CSV.

Nguyên tắc an toàn (đã kiểm tra trong code, không phải suy đoán):
- Vẫn phải có `sku` (khớp đúng sản phẩm đã tồn tại) và `categoryId` (xem bảng trên — bắt buộc mọi lúc, kể cả khi không đổi danh mục, cứ điền đúng slug danh mục hiện tại của sản phẩm).
- Khoá nào **không đưa vào file** → dữ liệu hiện có của khoá đó được **giữ nguyên, không đổi, không mất**. Đây là lý do hướng dẫn luôn nhắc "khoá nào không có nội dung thì bỏ hẳn khoá đó."
- Khoá nào **có đưa vào** trong số `specStats`, `trustBadges`, `commitments`, `positiveNotes`, `negativeNotes`, `faqs`, `videos` → **thay thế toàn bộ danh sách đang có bằng danh sách mới**, không phải cộng thêm. Ví dụ sản phẩm đang có 4 FAQ, bạn chỉ nạp lên 1 FAQ mới trong khoá `faqs` → 3 FAQ cũ **biến mất**, không phải cộng dồn thành 5. Muốn giữ FAQ cũ + thêm FAQ mới → phải liệt kê lại **đầy đủ cả FAQ cũ lẫn FAQ mới** trong cùng một mảng `faqs`.
- `descriptionBlocks` / `descriptionBlocksEn` theo cùng nguyên tắc thay thế toàn bộ — sửa 1 đoạn nhỏ vẫn phải dán lại **nguyên mảng khối mô tả đầy đủ** của sản phẩm đó (lấy từ trang quản trị hoặc hỏi lại dữ liệu hiện có), không chỉ đoạn muốn sửa — nếu không, các đoạn không được liệt kê sẽ mất theo.

---

## Phần 3 — Prompt mẫu để đưa cho AI

```
Bạn tạo dữ liệu nhập sản phẩm cho cửa hàng BigBike theo ĐÚNG bộ template đính kèm
(mau-co-ban.csv + mau-day-du.json). Với mỗi sản phẩm tôi cung cấp, hãy trả về:

1) Một dòng CSV (và các dòng BIẾN THỂ nếu có) — chỉ điền cột hàng hoá; để TRỐNG
   cột "Mô tả chi tiết" và "Bảng size".
2) Một object JSON trong mảng — LUÔN có `sku` và `categoryId` (categoryId = đúng
   slug danh mục đã dùng ở cột "Danh mục (slug)" trong dòng CSV tương ứng — thiếu
   khoá này JSON sẽ bị từ chối). Điền mô tả (descriptionBlocks) và ĐẦY ĐỦ các khối:
   quickAnswerSummary, specStats (tối đa 4), trustBadges, commitments (icon đúng
   trong 12 key cho phép), positiveNotes, negativeNotes, faqs, và sizeGuide nếu là
   đồ mặc/mũ. Bỏ khoá nào không có nội dung.

BẮT BUỘC:
- SKU trong CSV và JSON phải GIỐNG HỆT; categoryId trong JSON phải GIỐNG HỆT slug
  danh mục trong CSV.
- Mọi ảnh dùng đường dẫn /media/... ; nếu chưa có ảnh thì để trống.
- JSON chỉ chứa các khoá trong hướng dẫn, KHÔNG thêm khoá lạ, KHÔNG thêm ghi chú.
- Không để chữ nháp [Cần ảnh]/[gắn link]; link sản phẩm khác dùng URL thật hoặc bỏ.
- Nội dung tiếng Việt có dấu đầy đủ, đúng chính tả.
```

Kiểm tra sau khi AI trả về: mở JSON bằng công cụ kiểm tra JSON (jsonlint) xem có hợp lệ không; rà lại SKU 2 file khớp nhau; rà ảnh đều `/media/...`.
