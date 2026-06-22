# Tiêu chuẩn viết nội dung trang sản phẩm (PDP) — BigBike

> **Dành cho:** team SEO & Brand điền nội dung sản phẩm trong trang quản trị (admin).
> **Mục đích:** mỗi trang sản phẩm vừa thuyết phục khách mua, vừa được Google hiểu đúng và xếp hạng tốt.
> **Nguồn:** bản khảo sát `ODsxBigbike_Template Service Page.xlsx` + [SEO_PDP_IMPLEMENTATION_PLAN.md](SEO_PDP_IMPLEMENTATION_PLAN.md).
> **Lưu ý:** BigBike bán **đồ bảo hộ mô tô** (mũ, áo giáp, găng tay, balo…) — ví dụ trong tài liệu dùng đúng nhóm hàng này.

---

## 0. Nguyên tắc vàng (đọc trước khi viết)

1. **Trung thực tuyệt đối.** Chỉ ghi số liệu, chứng nhận, vật liệu **có thật**. Chưa có thông tin thì để trống hoặc ghi `[ĐIỀN]`, **không bịa**, không suy đoán. Sai sự thật về an toàn (đồ bảo hộ) là rủi ro pháp lý + mất uy tín.
2. **Không copy mô tả của hãng / đối thủ.** Google phạt nội dung trùng lặp. Viết lại bằng giọng BigBike.
3. **Một cách gọi tên duy nhất.** Tên sản phẩm phải viết **giống hệt nhau** ở mọi chỗ (tiêu đề, mô tả, ảnh, FAQ). Không lúc "Mũ AGV K6", lúc "nón AGV K-6".
4. **Viết tiếng Việt có dấu đầy đủ.** Không viết không dấu, không để lỗi font.
5. **Mỗi câu phải có thông tin thật** — tránh câu sáo rỗng kiểu "sản phẩm chất lượng cao, uy tín hàng đầu".

---

## 0b. Thứ tự khối hiển thị trên trang sản phẩm (canonical layout)

Trang chi tiết sản phẩm (`bigbike-web` — `components/catalog/ProductView.tsx`) render các khối theo đúng thứ tự sau (khối tự ẩn khi không có dữ liệu). **Thứ tự GIỐNG NHAU trên desktop và mobile** — khác biệt duy nhất là cách trình bày 5 khối #3–#7 (Mô tả · Thông số · FAQ · Video · Đánh giá): **mobile gom 5 khối vào MỘT widget tab**; **desktop render giãn, xếp chồng** (không tab). Cụm Ưu/Nhược + Sản phẩm liên quan → Phù hợp với ai → Bảng size (#8–#11) nằm NGOÀI tab, xếp chồng ngay sau cụm trên ở cả hai màn.

| # | Khối | Nguồn dữ liệu | Ghi chú |
|---|---|---|---|
| 1 | Gallery + thông tin mua hàng | `WpPurchaseSection` | Hàng sao có link "Viết đánh giá đầu tiên" → cuộn tới khối Đánh giá (`#reviews`) |
| 2 | Specs Dashboard (4 ô số liệu) | `specStats` | — |
| 3 | Tính năng chi tiết | `descriptionBlocks` | Khối full-trang (đã kéo RA khỏi tab). Khối `feature` (ảnh+tiêu đề+đoạn+danh sách) render 2 cột ảnh–chữ so le trên desktop (mobile xếp dọc); `side`=`auto` tự xen kẽ trái/phải. Cơ chế "ghép ngầm" cũ (tự gom `image`+`text` liền nhau) đã GỠ — muốn 2 cột phải dùng khối `feature`. "Phù hợp với ai"/"Bảng size" nhập ở **2 card riêng** (không còn là khối thêm trong trình dựng mô tả); dữ liệu vẫn lưu dạng khối `suitability`/`sizeGuide` trong `descriptionBlocks`, web **TÁCH RA** render thành khối #10/#11 riêng. |
| 4 | Thông số kỹ thuật | `specifications` | Khối xếp chồng riêng (desktop) / tab trong widget (mobile) |
| 5 | FAQ | `faqs` | Khối xếp chồng riêng (Lắp đặt `installationGuide` — **lưới các bước** số thứ tự + icon + tiêu đề + nội dung + hộp mẹo/cảnh báo + ghi chú bảo dưỡng, V242 — chèn giữa #4–#5 nếu có; Thông tin bổ sung bảo hành/xuất xứ/trọng lượng đặt sau FAQ) |
| 6 | Video sản phẩm | `videos` | Khối xếp chồng riêng (desktop) / tab trong widget (mobile); dùng chung `HomeVideoCarousel` |
| 7 | Đánh giá | `ReviewsSection` | Đặt SAU Video, `id="reviews"` (desktop render giãn; mobile là tab cuối trong widget) |
| 8 | Ưu điểm & Nhược điểm | `positiveNotes` / `negativeNotes` | 2 cột. Gộp chung MỘT khối `prosConsRelated` với "Sản phẩm tương tự" (#9). Khối NGOÀI tab → hiện ngay sau cụm #3–#7 trên CẢ desktop lẫn mobile |
| 9 | **Sản phẩm tương tự — "Xem thêm lựa chọn"** | `relatedProducts` | Cùng loại (auto theo tag). Đặt NGAY sau Ưu/Nhược điểm (gộp chung khối `prosConsRelated`): khách vừa đọc nhược điểm/giá → thấy ngay lựa chọn thay thế, giữ khách lại site. Hiện ở vị trí này trên CẢ desktop lẫn mobile. |
| 10 | **Phù hợp với ai** | `descriptionBlocks` (khối `suitability`) | Danh sách thẻ (đối tượng + lời khuyên + link nội bộ tùy chọn). **Tách RA khỏi luồng mô tả**, render khối riêng cố định ngay sau "Sản phẩm tương tự". Theo visibility của `description`. *(Trước V246 dùng field `suitabilityAdvisory`; nay là khối `suitability` trong `descriptionBlocks`.)* |
| 11 | Bảng size | `descriptionBlocks` (khối `sizeGuide`) | Khối xếp chồng riêng (không còn widget tab); có điều kiện. **Tách RA khỏi luồng mô tả**, render ngay sau "Phù hợp với ai". Theo visibility của `description`. *(Trước V246 dùng field `sizeGuide`; nay là khối `sizeGuide` trong `descriptionBlocks`.)* |
| 12 | Trust block "Mua tại BigBike.vn" | product + site settings | Lưới 7 ô (Giá · Kho · **Bảo hành · Giao hàng · Đổi size** · Liên hệ · Địa chỉ). Giá/Kho realtime; **Liên hệ = Hotline + Zalo** và **Địa chỉ** auto từ `site_settings`; 3 ô Bảo hành/Giao hàng/Đổi size là **dòng admin tự sửa theo từng SP** (`product_purchase_lines`), đã backfill mặc định chung cho mọi SP ở V258 (Bảo hành "12 tháng tại BigBike", Giao hàng "Toàn quốc · COD · Đồng kiểm khi nhận", Đổi size "Miễn phí đổi trong 30 ngày nếu không vừa"). Trống Zalo/Hotline/Địa chỉ thì auto bỏ ô đó. |
| 13 | Hoàn thiện bộ bảo hộ — cross-sell | `accessories` (admin curate) | Khác loại (găng/áo giáp/giày) để tăng AOV; render một lần ở cuối luồng marketing |

Sticky mua-hàng (mobile), "Đã xem gần đây", dải liên hệ giữ nguyên ở cuối.

---

## 1. Tên sản phẩm

| | |
|---|---|
| **Ô nhập** | Tên sản phẩm (VI / EN) |
| **Công thức** | `[Loại] [Thương hiệu] [Mã/Dòng] [đặc điểm nổi bật]` |
| **Quy tắc** | Đủ để khách phân biệt; đây là "cách gọi chuẩn" dùng lại toàn trang (#25) |

- ✅ `Mũ bảo hiểm fullface AGV K6 màu đen nhám`
- ❌ `AGV K6` (thiếu loại sản phẩm) · `MŨ XỊN GIÁ RẺ` (không phải tên)

---

## 2. Tiêu đề SEO — **tối đa 60 ký tự** (#2)

| | |
|---|---|
| **Ô nhập** | Tiêu đề SEO (admin cảnh báo đỏ khi vượt 60 ký tự) |
| **Công thức** | `[Tên sản phẩm] – [điểm bán hàng] \| BigBike` |
| **Vai trò** | Dòng chữ xanh khách thấy đầu tiên trên Google → quyết định họ có bấm vào không |

- ✅ `Mũ Fullface AGV K6 – Sợi carbon siêu nhẹ | BigBike` (49 ký tự)
- ❌ `Mũ bảo hiểm fullface AGV K6 chính hãng giá tốt nhất thị trường Hà Nội TP.HCM` (quá 60 → bị Google cắt cụt)

**Điểm bán hàng (USP)** = thứ chỉ sản phẩm này có: vật liệu (sợi carbon), đạt chuẩn (ECE 22.06), trọng lượng, công nghệ…

---

## 3. Mô tả SEO (meta description) — **tối đa 155 ký tự** (#3)

| | |
|---|---|
| **Ô nhập** | Mô tả SEO (admin cảnh báo đỏ khi vượt 155 ký tự) |
| **Công thức** | `[Tên SP] + 2 thông số quan trọng + giá/ưu đãi + lời kêu gọi` |
| **Vai trò** | Đoạn mô tả xám dưới tiêu đề trên Google |

- ✅ `Mũ fullface AGV K6 vỏ sợi carbon, nặng 1.250g, đạt chuẩn ECE 22.06. Bảo hành 12 tháng, giao toàn quốc. Xem giá tại BigBike.` (≈120 ký tự)
- ❌ Để trống, hoặc nhồi từ khóa: `mũ bảo hiểm, mũ agv, mũ fullface, mũ moto, mũ phượt…`

**Soát chính tả kỹ** — đây là phần khách đọc trước khi vào web.

---

## 4. Mô tả chi tiết — **800–1.500 từ**, có tiêu đề phụ (#1, #6, #27)

| | |
|---|---|
| **Ô nhập** | Mô tả sản phẩm (trình soạn thảo khối — chỉ **4 loại khối**) |
| **Cấu trúc** | Chia thành các **mục có tiêu đề** (dùng định dạng H2/H3 ngay trong ô văn bản, hoặc tiêu đề của khối ảnh+chữ) — đừng viết một khối chữ dài |

**4 khối có thể thêm (V238):**

1. **Chỉ văn bản** — ô soạn chữ tự do: in đậm/nghiêng, **tiêu đề (H2/H3)**, gạch đầu dòng, danh sách số, trích dẫn, link. Một mục mô tả (tiêu đề + vài đoạn + danh sách) gói gọn trong một khối này.
2. **Chỉ hình ảnh** — một ảnh rộng hết khổ + chú thích (alt/caption).
3. **Ảnh phải + chữ trái** — khối 2 cột: ảnh bên phải, phần chữ bên trái gồm *tiêu đề phụ + tiêu đề chính + đoạn mô tả + danh sách điểm nổi bật*.
4. **Ảnh trái + chữ phải** — như khối 3 nhưng ảnh đổi sang bên trái.

Gợi ý bố cục:

1. **Tổng quan** (khối "chỉ văn bản", 2–3 đoạn) — sản phẩm là gì, giải quyết nhu cầu gì.
2. **Tính năng nổi bật** — mỗi tính năng một khối **ảnh+chữ** (xen kẽ phải/trái): tiêu đề phụ (nhóm tính năng) + tiêu đề chính + 2–3 câu **lợi ích thật** + danh sách:
   - `Vỏ sợi carbon siêu nhẹ` → giảm trọng lượng, đỡ mỏi cổ khi đi xa.
   - `Hệ thống thông gió 4 cửa` → thoáng mát khi chạy tốc độ cao.
3. **Hướng dẫn sử dụng / bảo quản** (khối "chỉ văn bản", nếu có).

> Mô tả sản phẩm nhập từ web cũ đã được hệ thống **tự gộp** về 4 khối này (giữ nguyên nội dung) — bạn chỉ cần chỉnh sửa, không phải dựng lại.

> **Khối "Phù hợp với ai" tách ra ô nhập riêng** — xem mục 6b dưới đây.

> Khi đã viết đủ Ưu/Nhược + Bảng size + FAQ + "Phù hợp với ai", bài thường **tự đạt** 800–1.500 từ — không cần "viết cho dài".

---

## 5b. Khối "Phù hợp với ai — Nếu… thì…" (#7) — **ô nhập riêng**

| | |
|---|---|
| **Ô nhập** | **Phù hợp với ai** (ô riêng — `suitabilityAdvisory`, **danh sách thẻ** thêm/bớt/kéo sắp thứ tự — V240) |
| **Vị trí hiển thị** | Khối riêng trên trang sản phẩm (ngay sau khối "Sản phẩm tương tự") — mỗi thẻ một dòng tư vấn |
| **Cách viết** | Mỗi thẻ gồm **Đối tượng** (in đậm — nhóm rider/ngân sách/nhu cầu) + **Lời khuyên** (1 câu *nếu… thì…*) + **Link gợi ý** tùy chọn (nhãn + đường dẫn nội bộ tới SP/danh mục thay thế). Nên có 3–4 thẻ. |

- ✅ Thẻ 1 — Đối tượng: *"Touring xa / tốc độ cao"*; Lời khuyên: *"Mẫu này phù hợp, spoiler và trọng lượng nhẹ phát huy tốt trên hành trình dài."*
- ✅ Thẻ 2 — Đối tượng: *"Ngân sách 5–8 triệu"*; Lời khuyên: *"Cân nhắc mẫu nhẹ ví hơn"*; Link: *"Caberg Avalon X → /san-pham/caberg-avalon-x"*

> Lưu trữ: mỗi thẻ là một phần tử trong **JSON array** ở field `suitabilityAdvisory` (`{ audience, advice, linkLabel?, linkUrl? }`). Song ngữ: bản EN mirror theo index, `linkUrl` dùng chung. Web parse JSON rồi render thẻ — không còn HTML tự do.

> Khối **"Sản phẩm tương tự — Xem thêm lựa chọn"** (#6) dùng danh sách **"Sản phẩm liên quan"** (cùng loại) đã chọn — đặt ngay sau Ưu/Nhược điểm. Khối **"Hoàn thiện bộ bảo hộ"** ở cuối trang là danh sách **phụ kiện khác loại** (găng/áo giáp/giày) admin curate riêng — tăng AOV; hai khối là hai danh sách độc lập.

---

## 5. Ưu điểm & Nhược điểm (#7, #18) — **lợi thế độc quyền của BigBike**

| | |
|---|---|
| **Ô nhập** | Ưu điểm / Nhược điểm (mỗi dòng một ý) |
| **Vì sao quan trọng** | 4 đối thủ khảo sát **không có** mục này → điểm khác biệt + tăng độ tin cậy |

- **Ưu điểm:** 3–6 ý ngắn, cụ thể: `Trọng lượng nhẹ 1.250g`, `Đạt chuẩn ECE 22.06`, `Kính chắn gió chống UV`.
- **Nhược điểm:** **bắt buộc trung thực**, 1–3 ý: `Giá cao hơn mũ phổ thông`, `Ít lựa chọn màu`. → Khách tin hơn khi thấy mình thẳng thắn.
- ❌ Để trống mục Nhược điểm hoặc ghi giả ("không có nhược điểm nào").

---

## 6. Thông số kỹ thuật (#15)

| | |
|---|---|
| **Ô nhập** | Thông số kỹ thuật (cặp tên – giá trị) |
| **Quy tắc** | Mỗi thông số một dòng; chỉ ghi số liệu thật từ nhà sản xuất |

Ví dụ: `Chất liệu vỏ: Sợi carbon` · `Trọng lượng: 1.250g` · `Tiêu chuẩn: ECE 22.06` · `Số cửa thông gió: 4` · `Kính: Chống UV, chống xước`.

> **Chế độ HTML (V255):** Ngoài nhập từng dòng tên–giá trị, admin có thể bật tab **"Dán mã HTML"** để dán/thiết kế một bảng thông số tùy biến (gộp ô, v.v.). Khi ô HTML có nội dung, web hiển thị HTML đó **thay cho** bảng dòng chuẩn ("HTML thắng"); để trống thì giữ bảng dòng như cũ. Song ngữ tách riêng (vi/en). HTML được lọc an toàn khi hiển thị (cho phép `<table>`; mã nguy hiểm + style bị loại).

---

## 7. Bảo hành · Xuất xứ · Trọng lượng (#11, #16, #13)

| Ô nhập | Cách điền | Ví dụ |
|---|---|---|
| **Số tháng bảo hành** | Số nguyên (tháng) | `12` |
| **Phạm vi bảo hành** | 1–2 câu nêu rõ bảo hành gì | `Bảo hành 12 tháng lỗi keo, khóa cài và lớp lót.` |
| **Thương hiệu (nước)** | Nước của thương hiệu | `Ý` |
| **Sản xuất tại** | Nước sản xuất thực tế | `Việt Nam` |
| **Trọng lượng (gram)** | Số gram | `1250` |

> Phân biệt rõ "thương hiệu nước nào" và "sản xuất ở nước nào" — khách rất quan tâm, và đối thủ hay nhập nhằng (#16).

---

## 8. Bảng size & hướng dẫn chọn (#9)

| | |
|---|---|
| **Ô nhập** | Bảng size (soạn thảo) |
| **Quy tắc** | Làm bằng **bảng** (rows/cột), **không chụp ảnh bảng** — cả 5 web đối thủ đều dùng ảnh, làm bảng chữ là độc quyền + Google đọc được |

Tối thiểu các cột: `Size` · `Vòng đầu (cm)` · `Gợi ý` + một câu hướng dẫn đo.

---

## 9. Câu hỏi thường gặp — FAQ (#10, #19)

| | |
|---|---|
| **Ô nhập** | FAQ (cặp Câu hỏi – Trả lời). Ô **Trả lời** có trình soạn thảo định dạng: in đậm/nghiêng, gạch đầu dòng, gắn link. |
| **Số lượng** | 3–6 câu hỏi khách hay hỏi thật |
| **Lợi ích** | Hiển thị đẹp trên Google (rich result) + tăng độ sâu nội dung. Trên trang web câu hỏi hiển thị dạng accordion (bấm mở/đóng mượt). |

Ví dụ: *"Mũ AGV K6 có đạt chuẩn đi phượt không?"* / *"Size M vòng đầu bao nhiêu?"* / *"Có bảo hành đổi mới không?"* — câu trả lời ngắn gọn, đúng sự thật.

---

## 10. Video & mô tả video (#14)

| | |
|---|---|
| **Ô nhập** | Video (link) + **Mô tả video** (2–3 câu) |
| **Quy tắc** | Mỗi video kèm 2–3 câu nói rõ nội dung → Google hiểu video nói gì |

- ✅ Mô tả: *"Cận cảnh lớp vỏ sợi carbon và hệ thống thông gió của mũ AGV K6, kèm thao tác tháo lắp kính chắn gió."*
- ❌ Để trống mô tả, hoặc ghi `video1`.

---

## 11. Ảnh sản phẩm & chú thích ảnh (alt) (#12, #13)

| | |
|---|---|
| **Ô nhập** | Mỗi ảnh có ô "alt" (chú thích) riêng |
| **Quy tắc alt** | Mô tả **nội dung ảnh**, có tên sản phẩm + góc chụp/đặc điểm. **KHÔNG** dùng tên file hay đánh số kiểu "Tem 01" |

- ✅ `Mũ fullface AGV K6 màu đen nhám nhìn từ phía trước` · `Lớp lót bên trong mũ AGV K6 tháo rời được`
- ❌ `Tem 01` · `IMG_2931` · `agv-k6-01` · để trống

**Về ảnh (phối hợp với team media):** mỗi sản phẩm nên có ảnh ở **3 tỉ lệ**: `1:1` (vuông – lưới sản phẩm), `4:3` (ảnh chi tiết), `16:9` (ảnh ngang/đại diện chia sẻ). Hệ thống tự khai báo bộ ảnh cho Google.

> Lưu ý: với các sản phẩm cũ nhập từ web WordPress, chú thích ảnh tự sinh (tên file/mã) đã được hệ thống **tự bỏ qua và thay bằng tên sản phẩm**. Nhưng chú thích **viết tay vẫn tốt hơn** cho SEO — ưu tiên điền alt cho sản phẩm bán chạy.

---

## 12. Checklist trước khi xuất bản

- [ ] Tên sản phẩm thống nhất ở mọi chỗ (#25)
- [ ] Tiêu đề SEO ≤ 60 ký tự, có USP + `| BigBike` (#2)
- [ ] Mô tả SEO ≤ 155 ký tự, có thông số + đã soát chính tả (#3)
- [ ] Mô tả ngắn 40–60 từ, "trả lời trước" (#5)
- [ ] Mô tả chi tiết có tiêu đề phụ + khối "Phù hợp với ai" + liên kết nội bộ (#6, #8)
- [ ] Ưu điểm + **Nhược điểm thật** đã điền (#7, #18)
- [ ] Thông số, bảo hành, xuất xứ, trọng lượng đã điền (#11, #13, #16)
- [ ] Bảng size dạng bảng (không phải ảnh) (#9)
- [ ] 3–6 FAQ thật (#10)
- [ ] Mỗi video có mô tả 2–3 câu (#14)
- [ ] Mọi ảnh có alt mô tả nội dung, không "Tem 01" (#12)
- [ ] **Tất cả số liệu đều thật** — không có chỗ nào bịa (#24)

---

## 13. Ví dụ điền hoàn chỉnh (tham khảo)

> **Sản phẩm:** Mũ bảo hiểm fullface AGV K6

- **Tên:** Mũ bảo hiểm fullface AGV K6 màu đen nhám
- **Tiêu đề SEO:** `Mũ Fullface AGV K6 – Sợi carbon siêu nhẹ | BigBike`
- **Mô tả SEO:** `Mũ fullface AGV K6 vỏ sợi carbon, nặng 1.250g, đạt chuẩn ECE 22.06. Bảo hành 12 tháng, giao toàn quốc. Xem giá tại BigBike.`
- **Mô tả ngắn:** *"Mũ fullface AGV K6 là mũ cao cấp cho người đi mô tô phân khối lớn và phượt đường dài. Vỏ sợi carbon chỉ 1.250g giảm mỏi cổ, kính chống UV, đạt chuẩn ECE 22.06."*
- **Ưu điểm:** Nhẹ 1.250g · Đạt chuẩn ECE 22.06 · Kính chống UV · Lót tháo giặt được
- **Nhược điểm:** Giá cao hơn mũ phổ thông · Ít màu
- **Bảo hành:** 12 tháng — *lỗi keo, khóa cài, lớp lót* · **Thương hiệu:** Ý · **Sản xuất tại:** Việt Nam · **Trọng lượng:** 1250g

---

*Có thắc mắc về một ô cụ thể, hỏi lại team kỹ thuật. Đừng bịa thông tin để "cho đủ" — thà để trống còn hơn sai.*
