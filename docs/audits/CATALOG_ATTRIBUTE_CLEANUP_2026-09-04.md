# Đề xuất dọn dữ liệu thuộc tính & bảng cỡ — 04/09/2026

> **TRẠNG THÁI: CHỜ CHỦ SHOP DUYỆT. Chưa xoá, chưa gộp, chưa sửa bất kỳ dòng dữ liệu nào.**
>
> Đây là dữ liệu hàng thật đang bán. Mỗi mục dưới đây ghi rõ số sản phẩm bị ảnh hưởng,
> đo trực tiếp trên hệ thống đang chạy ngày 04/09/2026 (chỉ đọc). Chủ shop duyệt từng
> nhóm, phần nào chưa duyệt thì không đụng tới.
>
> Liên quan: `BUSINESS_RULES.md` `CATALOG_RULE_002`, `CATALOG_RULE_004`, `ATTRIBUTE_RULE_001`.

## 0. Hai điểm bản bàn giao ghi chưa đúng — đã kiểm chứng lại

**1. Mục "Iphone" KHÔNG phải hàng thử — đang có sản phẩm thật dùng.**
Bản bàn giao đề nghị bỏ cả thuộc tính lẫn bảng cỡ cùng tên. Đo lại:

| Hạng mục tên "Iphone" | Thực tế | Kết luận |
|---|---|---|
| Thuộc tính `Iphone` (6 giá trị) | **1 sản phẩm thật đang dùng**: *Ốp lưng iPhone cho giá đỡ Kewig M36-CASE* (6 phiên bản) | **KHÔNG được bỏ** — bỏ là mất lựa chọn của sản phẩm đang bán |
| Bảng cỡ `Iphone` (6 cỡ) | 0 sản phẩm dùng | Bỏ được |

**2. "13 tên thuộc tính" không phải 13 thuộc tính trùng nhau.**
Dữ liệu đã gom về **9 thuộc tính gốc** từ trước. 13 tên chỉ là **nhãn hiển thị chụp lại
lúc lưu** trên từng dòng phiên bản — liên kết dữ liệu bên dưới đã đúng sẵn. Nên việc
"gộp" nhẹ hơn nhiều so với mô tả: chỉ là đồng bộ lại nhãn hiển thị, không đụng liên kết.

---

## Nhóm 1 — Đồng bộ nhãn hiển thị (13 tên → 9 tên gốc)

| Thuộc tính gốc | Nhãn đang lưu khác tên gốc | Số dòng phiên bản |
|---|---|---|
| `Bo` | `bo` | 3 |
| `màu sắc` | `Màu` | 123 |
| `màu sắc` | `color` | 47 |
| `màu sắc` | `Màu sắc` | 8 |
| `Model` | `model` | 13 |
| `Size` | `Kích cỡ` | 58 |
| `Size` | `size` | 49 |

**Tổng: 301 dòng phiên bản** trên **9 thuộc tính gốc**. Không dòng nào sai liên kết.

⚠️ **Phải quyết trước khi đồng bộ:** tên gốc của thuộc tính màu hiện đang viết thường
— **"màu sắc"**. Đồng bộ ngay bây giờ sẽ biến 178 dòng đang hiển thị đẹp (`Màu`,
`Màu sắc`) thành chữ thường trên trang khách. **Đề nghị: sửa tên gốc thành "Màu sắc"
trước, rồi mới đồng bộ.**

⚠️ Nhãn `Kích cỡ` và `size` vẫn được chốt chặn bảng cỡ nhận diện đúng là dòng cỡ, nên
đồng bộ hay không đều **không** ảnh hưởng bộ lọc ngoài web. Đây thuần tuý là dọn cho gọn.

## Nhóm 2 — Thuộc tính rỗng / không ai dùng

| Thuộc tính | Số giá trị | Số phiên bản dùng | Số sản phẩm dùng | Đề xuất |
|---|---|---|---|---|
| `Cặp` (cap) | 0 | 0 | 0 | Bỏ — an toàn |
| `Solo` (solo) | 0 | 0 | 0 | Bỏ — an toàn |
| `Dung tich` (dungtich) | 4 | 0 | 0 | **Bản bàn giao không nhắc tới.** 4 giá trị (`60cc`, `100cc`, `250ML`, `400ML`) chưa sản phẩm nào dùng. Chủ shop xác nhận có định dùng sau không |

## Nhóm 3 — Hạng mục "Iphone"

| Hạng mục | Đề xuất |
|---|---|
| Bảng cỡ `Iphone` (6 cỡ, 0 sản phẩm) | **Bỏ được** |
| Thuộc tính `Iphone` (6 giá trị, 1 sản phẩm thật) | **GIỮ** — xem mục 0 |

## Nhóm 4 — Rác cỡ nhập từ website cũ

**41 / 92 giá trị cỡ chưa sản phẩm nào dùng.** Gồm 3 loại:

| Loại | Ví dụ | Số lượng |
|---|---|---|
| Mã rác nhập từ web cũ | `01-m1m65-1m7`, `0e-hangorder`, `f6-l1m7trolen`, `8b-xl44`, `5b-xxxl38` | ~25 |
| Sai loại (màu nằm trong danh sách cỡ) | `MÀU` | 1 |
| Cỡ hợp lệ nhưng chưa dùng | `35`, `47`, `42.5`, `43.5`, `S/M`, `L/XL`, `XXXL`, `3XL/4XL`, `25L`, `40L`, `45L`, `68L`, `90L` | ~15 |

**Đề xuất:** bỏ 2 loại đầu; loại thứ ba giữ lại (có thể cần khi nhập hàng mới).
Máy chủ đã tự chặn xoá giá trị đang được dùng, nên rủi ro thấp — nhưng vẫn cần duyệt.

Các thuộc tính khác cũng có giá trị chưa dùng: `màu sắc` 13/95, `Model` 27/49, `Bo` 7/14.

## Nhóm 5 — 14 sản phẩm chưa gán bảng cỡ

**Không được gán theo loại hàng.** Đã đo từng sản phẩm xem bảng cỡ nào phủ đủ cỡ đang lưu:

| Sản phẩm | Cỡ đang lưu | Bảng cỡ phủ đủ | Đề xuất |
|---|---|---|---|
| GIÀY BẢO HỘ CHỐNG NƯỚC KOMINE BK-101 | 39–45 | Cỡ giày châu Âu | Cỡ giày châu Âu |
| Giày moto LS2 Adventure man wp | 42–45 | Cỡ giày châu Âu | Cỡ giày châu Âu |
| Giày moto touring ILM UB305 | 41–43 | Cỡ giày châu Âu | Cỡ giày châu Âu |
| KOMINE BK-088 | 37, 38 | Cỡ giày châu Âu | Cỡ giày châu Âu |
| GIÁP LƯNG ALPINESTARS NUCLEON KR-CELLI | S, M, L | mũ / găng / đồ mặc | Cỡ chữ đồ mặc |
| GĂNG TAY BẢO HỘ KOMINE GK-270 | M–3XL | găng / đồ mặc | Cỡ chữ găng tay |
| GĂNG TAY ĐUA KOMINE GK-265 R-SPEC | M–XXL | mũ / găng / đồ mặc | Cỡ chữ găng tay |
| MŨ BẢO HIỂM DUAL SPORT ILM WS-902 | S–XXL | mũ / găng / đồ mặc | Cỡ chữ mũ bảo hiểm |
| MŨ BẢO HIỂM NỬA ĐẦU XPEED | M, L, XL | mũ / găng / đồ mặc | Cỡ chữ mũ bảo hiểm |
| Mũ bảo hiểm fullface Caberg Drift Evo II Carbon | XS–XXL | mũ / găng / đồ mặc | Cỡ chữ mũ bảo hiểm |
| ÁO BẢO HỘ HEVIK NEPTUNE | S–3XL | găng / đồ mặc | Cỡ chữ đồ mặc |
| ÁO BẢO HỘ KOMINE JK-173 NỮ | M, L, XL, WM, WL | găng / đồ mặc | Cỡ chữ đồ mặc |
| **MŨ BẢO HIỂM LẬT HÀM LS2 FF901 ADVANT X CARBON** | M–3XL | **KHÔNG phải bảng mũ** (bảng mũ không có `3XL`) | Cỡ chữ đồ mặc, hoặc bổ sung `3XL` vào bảng mũ — **chủ shop quyết** |
| **ÁO QUẦN BẢO HỘ ADV COMPASS DRY TECNO LADY** | 42–52 | **KHÔNG bảng nào phủ đủ** (bảng EU chỉ có 46–62) | Bổ sung `42`, `44` vào bảng EU, hoặc tạo bảng riêng — **chủ shop quyết** |

⚠️ **Cạm bẫy:** gán bảng "Cỡ chữ mũ bảo hiểm" cho **MŨ BẢO HIỂM LẬT HÀM LS2 FF901** sẽ
làm sản phẩm này **không lưu được** vì bảng mũ không có cỡ `3XL`. Đây đúng là lý do
không được gán theo loại hàng.

---

## Việc đã làm rồi, không nằm trong đề xuất này

- Ô chọn cỡ đã tự thu gọn theo bảng cỡ đã chọn — không còn phải tự tìm trong 92 mục.
- Thông báo lỗi đã sang tiếng Việt và nói rõ cỡ nào sai, bảng nào.
- Nhóm lọc cỡ đã thêm/sửa/tắt/xoá được từ trang quản trị.

Nhờ đó, việc dọn dữ liệu ở trên **không còn gấp** — nhân viên đã không bị 92 mục làm rối.
