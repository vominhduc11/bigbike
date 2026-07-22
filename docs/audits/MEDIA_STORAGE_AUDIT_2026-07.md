# Báo cáo Audit — Kho ảnh WordPress cũ (`wp-uploads/`) trong MinIO — 2026-07-22

> **Trạng thái:** Audit phân tích, **KHÔNG có hành động xoá/sửa nào được thực hiện**. Không `rm`/`mc rm` bất kỳ object nào, không viết migration, không nén đè ảnh cũ.
> **Phạm vi:** Bucket `bigbike-media`, prefix `wp-uploads/` (2,77 GB / 13.239 file — phần lớn dung lượng MinIO hiện tại). Không bao gồm `uploads/` (ảnh admin, 26 MB) hay `reviews/` (ảnh đánh giá, 3,5 MB) — 2 prefix này nhỏ và đã được xử lý ở Phần 1 (nén ảnh mới).
> **Mốc audit:** commit `771ae16` (nhánh `main`), dữ liệu đọc trực tiếp từ container `bigbike-postgres` (chỉ `SELECT`) và `bigbike-minio` (chỉ liệt kê qua `mc ls`/`du`, không ghi) đang chạy trên máy dev, ngày 2026-07-22. Số liệu là ảnh chụp tại thời điểm audit — dữ liệu production/thực tế thay đổi theo thời gian.
> **Cách dùng:** Đây là input để owner quyết định phương án dọn kho ảnh cũ (Phần 2 của yêu cầu nén ảnh toàn hệ thống). Báo cáo chỉ đề xuất, không tự thực hiện.

## Executive Summary

| Nhóm | Số file | Dung lượng | % tổng |
|---|---|---|---|
| **Tổng `wp-uploads/`** | 13.239 | 2.836 MB (2,77 GB) | 100% |
| Đang được tham chiếu (dùng) | 8.154 | 1.614 MB | 56,9% |
| **Không tìm thấy tham chiếu nào (rác tiềm năng)** | 5.085 | 1.222 MB | **43,1%** |
| Biến thể WordPress (`-WxH.ext`) đã import | 66 | 8,5 MB | 0,3% |
| Tham chiếu "gãy" (DB trỏ tới file không tồn tại) | 151 đường dẫn | — | — |

**3 điểm đáng chú ý nhất:**
1. **43,1% dung lượng (~1,22 GB) không tìm thấy tham chiếu nào trong DB** — ứng viên chính cho việc dọn dẹp, nhưng cần xem lại thủ công phần "Không chắc" trước khi xoá (xem mục 3).
2. **Chỉ 0,3% là biến thể kích thước WordPress** (`-300x300.jpg` kiểu cũ) — trái với giả định ban đầu rằng phần lớn dung lượng đến từ các bản thumbnail trùng lặp của WP. Import từ WordPress dường như **chỉ lấy ảnh gốc**, không kéo theo các size WP tự sinh — nghĩa là phương án "xoá biến thể WP dư thừa" gần như không tiết kiệm được gì đáng kể.
3. **Phát hiện phụ, không liên quan việc nén ảnh:** 5 dòng trong bảng `media` (legacy_id 976–979, 981) có `file_path`/`public_url` bị **nối chuỗi lỗi** (một field chứa tên nhiều file dính liền nhau, vd `...jpg6573475bd...jpgb36e53...jpg`) — dữ liệu hỏng từ lúc import WordPress, khiến các ảnh này không bao giờ hiển thị được. Đây là bug dữ liệu có sẵn, không phải do audit hay việc nén ảnh gây ra — nêu ra để owner quyết định có cần dọn riêng không (xem mục 6).

---

## 1. Phân bố dung lượng theo năm

| Năm | Số file | Dung lượng |
|---|---|---|
| 2014 | 37 | 7,4 MB |
| 2015 | 230 | 71,2 MB |
| 2016 | 793 | 164,5 MB |
| 2017 | 1.117 | 276,5 MB |
| 2018 | 1.101 | 264,9 MB |
| 2019 | 694 | 281,1 MB |
| 2020 | 1.830 | 425,9 MB |
| 2021 | 732 | 80,0 MB |
| 2022 | 891 | 184,2 MB |
| 2023 | 2.014 | 314,2 MB |
| 2024 | 1.593 | 252,7 MB |
| 2025 | 1.713 | 219,3 MB |
| 2026 (đến tháng 7) | 493 | 293,9 MB |

Dung lượng không tăng dần đều theo năm — 2020 (425,9 MB) và 2023 (314,2 MB) là 2 năm nặng nhất, không phải năm gần nhất. Điều này gợi ý dung lượng phụ thuộc vào loại nội dung đăng (vd chiến dịch ảnh sản phẩm chụp studio) hơn là xu hướng thời gian tuyến tính.

### Top 20 file nặng nhất (đầy đủ top 50 trong file thô, xem mục "Nguồn dữ liệu")

| Dung lượng | Đường dẫn |
|---|---|
| 16.054 KB | `2026/03/SCS_2.png` |
| 15.973 KB | `2026/03/SCS_3.png` |
| 15.945 KB | `2026/03/SCS_16.png` |
| 15.177 KB | `2022/12/ao-giap-bao-ho-moto-scoyco-jk117.jpg` |
| 14.255 KB | `2026/02/DSC06530.jpg` |
| 13.464 KB | `2026/03/SCS_26.png` |
| 12.878 KB | `2026/03/SCS_47.png` |
| 12.628 KB | `2026/03/SCS_56.png` |
| 12.622 KB | `2026/03/SCS_19.png` |
| 12.341 KB | `2026/03/SCS_52.png` |
| 12.254 KB | `2026/03/SCS_24.png` |
| 11.751 KB | `2026/02/DSC06992.jpg` |
| 11.389 KB | `2022/10/tui-drybag-dji-phuot-chong-nuoc.jpg` |
| 8.885 KB | `2025/08/s7x-mot-minh-van-chat.png` |
| 8.689 KB | `2024/10/TTG_2818.jpg` |
| 8.357 KB | `2024/10/TTG_2757.jpg` |
| 6.576 KB | `2017/11/Bluetooth_Sena_20S-Evo.jpg` |
| 6.358 KB | `2020/06/ket-noi-intercom-4-may-scs-s9-10.jpg` |
| 6.043 KB | `2021/04/ao-giap-bao-ho-moto-Furygan-Aron-MODEL-01.jpg` |
| 5.862 KB | `2020/10/PinLock-12.jpg` |

Đáng chú ý: **11 trong top 12 file nặng nhất là ảnh PNG "SCS" upload tháng 3/2026** — rất có thể là ảnh chụp màn hình hoặc ảnh gốc chưa nén của một đợt nhập sản phẩm SCS gần đây (PNG không nén tốt bằng JPEG cho ảnh chụp thật). Đây là ứng viên tốt cho phương án (b) — hạ kích thước — vì hầu hết các file PNG nặng cỡ 12-16MB gần như chắc chắn vượt xa 2000px chiều rộng.

## 2. Biến thể kích thước WordPress (`-WxH.ext`)

Quét toàn bộ 13.239 file theo mẫu tên `-\d+x\d+\.(jpg|jpeg|png|webp)$` (kiểu WordPress tự sinh, vd `photo-300x300.jpg`, `photo-1024x768.jpg`):

- **66 file khớp mẫu**, tổng **8,5 MB** (0,3% dung lượng).

**Kết luận quan trọng:** phần lớn các size WordPress tự sinh (thường WP tạo 4-6 bản mỗi ảnh gốc: thumbnail/medium/large/1536x1536/2048x2048...) **đã không được import vào MinIO** — quá trình di chuyển từ WordPress dường như chỉ lấy file gốc (`_wp_attached_file`), khớp với cách `MediaPathResolver.java` hoạt động (`CONFIRMED_FROM_CODE`, xem `wp-content/uploads/` → `wp-uploads/` prefix). Vì vậy, **không có "kho biến thể trùng lặp" đáng kể để dọn** — khác với giả định ban đầu.

Hệ quả phụ: nội dung cũ (bài viết, mô tả sản phẩm) đôi khi vẫn tham chiếu tới các URL biến thể kiểu `-1024x1024.jpg` **không tồn tại** trong MinIO — xem mục 4 (tham chiếu gãy).

## 3. Đối chiếu tham chiếu trong DB

Quét (chỉ `SELECT`, không ghi) toàn bộ cột lưu URL ảnh có thể tham chiếu `wp-uploads/`:

`media.file_path`/`public_url`, `products.image_url`/`seo_og_image_url`/`gallery`/`videos`/`description_blocks`/`suitability_section`/`size_guide_section`, `product_variants.image_url`, `product_variant_gallery_images.image_url`/`video_url`, `categories.image_url`/`icon_url`/`seo_og_image_url`/`banner_url`/`mobile_banner_url`/`menu_icon_url`, `brands.logo_url`/`seo_og_image_url`, `articles.cover_image_url`/`seo_og_image_url`/`body`/`body_en`/`body_blocks`, `sliders.desktop_image`/`mobile_image`, `reviews.photos`, `customers.avatar_url`, `home_videos.thumbnail`.

Quét cả 2 dạng URL: đường dẫn nội bộ mới (`wp-uploads/...`) **và** URL ngoài kiểu cũ (`bigbike.vn/wp-content/uploads/...`, 875 tham chiếu tìm thấy dưới dạng này — chủ yếu trong `products.description_blocks`/`suitability_section`/`size_guide_section` chưa được chuẩn hoá, đúng như `MEDIA_RULE_003` mô tả về "ảnh cũ được tha").

**Ghi chú:** không có bảng `pages` hay bảng `product_gallery_images`/`product_videos` riêng trong schema hiện tại — gallery và video sản phẩm là cột `jsonb` (`gallery`, `videos`) ngay trong bảng `products`; đã quét đúng các cột này.

Kết quả 3 nhóm:

| Nhóm | Số file | Dung lượng |
|---|---|---|
| **Đang dùng** (có tham chiếu khớp) | 8.154 | 1.614,1 MB (56,9%) |
| **Không tìm thấy tham chiếu** | 5.085 | 1.221,9 MB (43,1%) |
| **Không chắc** | Xem ghi chú dưới | — |

**Về nhóm "Không chắc":** phương pháp quét bằng regex trên text/HTML tự do (đặc biệt `articles.body`, `articles.body_blocks`) có thể bỏ sót ảnh nhúng dưới dạng khác thường (URL rút gọn, encode khác, hoặc ảnh trong `<a href>` không phải `<img src>`). Con số 43,1% "không tham chiếu" nên được xem là **giới hạn trên của ước tính an toàn** (safe upper bound), không phải số tuyệt đối — khuyến nghị double-check bằng mắt một mẫu ngẫu nhiên trước khi xoá hàng loạt theo nhóm này.

Nguồn tham chiếu nhiều nhất: `media.public_url` (6.654 đường dẫn — thư viện media admin, đáng tin cậy nhất vì có cấu trúc bảng rõ ràng), `products.gallery` (932), `articles.body_blocks` (972), `product_variant_gallery_images.image_url` (685).

### Top 20 file nặng nhất KHÔNG có tham chiếu (ứng viên xoá)

| Dung lượng | Đường dẫn |
|---|---|
| 16.054 KB | `2026/03/SCS_2.png` |
| 15.973 KB | `2026/03/SCS_3.png` |
| 15.945 KB | `2026/03/SCS_16.png` |
| 15.177 KB | `2022/12/ao-giap-bao-ho-moto-scoyco-jk117.jpg` |
| 14.255 KB | `2026/02/DSC06530.jpg` |
| 13.464 KB | `2026/03/SCS_26.png` |
| 12.878 KB | `2026/03/SCS_47.png` |
| 12.628 KB | `2026/03/SCS_56.png` |
| 12.622 KB | `2026/03/SCS_19.png` |
| 12.341 KB | `2026/03/SCS_52.png` |
| 12.254 KB | `2026/03/SCS_24.png` |
| 11.751 KB | `2026/02/DSC06992.jpg` |
| 11.389 KB | `2022/10/tui-drybag-dji-phuot-chong-nuoc.jpg` |
| 8.885 KB | `2025/08/s7x-mot-minh-van-chat.png` |
| 8.689 KB | `2024/10/TTG_2818.jpg` |
| 8.357 KB | `2024/10/TTG_2757.jpg` |
| 6.576 KB | `2017/11/Bluetooth_Sena_20S-Evo.jpg` |
| 6.358 KB | `2020/06/ket-noi-intercom-4-may-scs-s9-10.jpg` |
| 6.043 KB | `2021/04/ao-giap-bao-ho-moto-Furygan-Aron-MODEL-01.jpg` |
| 5.862 KB | `2020/10/PinLock-12.jpg` |

Toàn bộ top 20 file nặng nhất của cả kho trùng khớp với top 20 "không tham chiếu" — nghĩa là **những file nặng nhất trong toàn bộ `wp-uploads/` đều không được dùng ở đâu cả** theo dữ liệu quét được. Đây là mục tiêu ưu tiên cao nhất nếu chọn phương án xoá.

## 4. Tham chiếu "gãy" (DB trỏ tới file không tồn tại trong MinIO)

**151 đường dẫn** được tham chiếu trong DB nhưng không khớp bất kỳ object nào hiện có trong `wp-uploads/`. Phần lớn là 2 dạng:

- **Biến thể kích thước WP không được import** (khớp mục 2) — vd `Quan-bao-ho-...-1024x1024.jpg`, `giay-bao-ve-komine-bk0882-768x1024.jpg`, `ao-bao-ho-komine-jk157-05-300x300.jpg`. Nội dung cũ (mô tả sản phẩm/bài viết) trỏ tới các size này nhưng WP import chỉ mang bản gốc sang → ảnh này **hiện đang hiển thị lỗi/vỡ** trên các trang chứa nội dung cũ.
- **5 dòng dữ liệu hỏng trong bảng `media`** (xem mục 6) — không phải lỗi migrate URL, mà là dữ liệu `file_path` tự nó đã sai từ đầu.

Đây là vấn đề tồn tại **độc lập với việc nén ảnh** — ảnh vỡ này đã vỡ từ trước, audit chỉ phát hiện ra chứ không gây ra. Nêu ra để owner cân nhắc có cần một task riêng rà soát/fix không.

## 5. Ước tính tiết kiệm theo phương án

| Phương án | Cơ sở tính | Ước tính tiết kiệm |
|---|---|---|
| **(a) Chỉ xoá nhóm "không tham chiếu"** | 5.085 file, đo trực tiếp từ đối chiếu DB↔MinIO (mục 3) | **~1.222 MB (~1,19 GB, 43,1% kho `wp-uploads/`)** — độ tin cậy: trung bình (phụ thuộc việc double-check nhóm "không chắc" ở mục 3) |
| **(b) Hạ ảnh gốc >2000px xuống 2000px** | **Ước tính gián tiếp**, KHÔNG đo pixel thật (xem giới hạn dưới) | Sơ bộ: nếu áp dụng cho toàn bộ 302 file hiện >1MB (749,8 MB, dùng "file nặng >1MB → khả năng cao vượt 2000px" làm proxy, hiệu chỉnh từ kết quả nén thật ở Phần 1: ảnh test 2000x1500 nén JPEG quality 0.85 ra ~1,98 MB) → có thể tiết kiệm sơ bộ **vài trăm MB**, nhưng cần đo pixel thật trước khi quyết định (xem giới hạn) |
| **(c) Cả hai** | Cộng gộp (a)+(b), có thể trùng lặp (file nặng có thể vừa >2000px vừa không tham chiếu — ví dụ chính là top 20 ở mục 3) | Cận trên rất thô: có thể tới **~1,5–1,8 GB** nếu cả 2 phương án áp dụng cho cùng tập file nặng+không dùng, nhưng con số này chồng lấp nên **không cộng đơn giản (a)+(b)** |

**Giới hạn quan trọng của phương án (b):** audit này **không tải và giải mã pixel thật** của 13.239 file (chi phí băng thông/thời gian quá lớn cho một lượt audit tĩnh) — số liệu "> ngưỡng MB" chỉ là **proxy gián tiếp** dựa trên dung lượng file, hiệu chỉnh theo 1 điểm dữ liệu thật duy nhất (ảnh test tự tạo ở Phần 1). Đây là ước tính **NEEDS_VERIFICATION** — nếu owner chọn theo hướng (b)/(c), khuyến nghị đo pixel thật cho tối thiểu top 50-100 file nặng nhất trước khi triển khai, để có số liệu chính xác thay vì proxy.

## 6. Phát hiện phụ — dữ liệu hỏng trong bảng `media` (không liên quan việc nén ảnh)

6 dòng trong bảng `media` cùng nằm trong thư mục `2016/04/`, `legacy_id` liên tiếp 975→981, cho thấy pattern nối chuỗi tích luỹ lỗi:

| `legacy_id` | `file_path` |
|---|---|
| 975 | `2016/04/82a46dabb5ff34e7517cd65c0cd79463.jpg` (đúng, khớp file thật) |
| 976 | `2016/04/82a46dab...9463.jpg` + `6573475bd...d8d.jpg` dính liền |
| 977 | + `b36e53324...556.jpg` dính tiếp |
| 978 | + `4f7e14e08...c1.jpg` + `0ab201bce...31_1_.jpg` dính tiếp |
| 979 | + `4f7e14e08...c1.jpg` dính tiếp (khác 978) |
| 981 | + `0ab201bce...31.jpg` dính tiếp (khác 978) |

Mỗi dòng sau dường như **nối thêm tên file mới vào chuỗi của dòng trước** — dấu hiệu rõ của bug trong importer WordPress (khả năng một biến string builder không được reset giữa các bản ghi liên tiếp khi xử lý gallery/attachment). Hệ quả: **5/6 dòng này (976, 977, 978, 979, 981) không bao giờ khớp file thật nào trong MinIO** — nằm trong danh sách 151 tham chiếu gãy ở mục 4.

Đây là **bug dữ liệu có sẵn từ lúc import, không phải do việc nén ảnh hay audit này gây ra**. Không sửa trong audit này theo đúng chỉ định "chỉ phân tích". Nêu ra vì đây là **task riêng, tách biệt** khỏi việc dọn kho ảnh cũ nếu owner muốn xử lý.

## 7. Đề xuất (owner quyết định)

Xếp theo rủi ro thấp → cao:

1. **Rà soát thủ công top 20-50 file "không tham chiếu" nặng nhất** (mục 3) — xác nhận bằng mắt (hầu hết là ảnh SCS/sản phẩm gần đây, dễ kiểm) trước khi xoá bất kỳ file nào. Rủi ro thấp nếu làm tuần tự, từng batch nhỏ.
2. **Xoá nhóm "không tham chiếu" đã xác nhận thủ công** — tiết kiệm tới ~1,2 GB. Rủi ro trung bình: phụ thuộc độ chính xác của việc quét regex trên HTML tự do (mục 3, phần "Không chắc").
3. **Đo pixel thật cho các file >1MB** trước khi quyết định phương án (b)/(c) — hiện tại là ước tính gián tiếp (mục 5), không đủ tin cậy để hành động ngay.
4. **Task riêng: dọn 5 dòng dữ liệu hỏng trong bảng `media`** (mục 6) — không liên quan kho ảnh cũ, nhưng nên xử lý để tránh 5 media record vĩnh viễn không hiển thị được.
5. **Không cần đầu tư vào việc "dedupe biến thể WP"** — chỉ 8,5 MB, không đáng công sức (mục 2).

---

## Nguồn dữ liệu

- Liệt kê object thật qua `mc ls --recursive --json` bên trong container `bigbike-minio` (S3 API, không dựa vào `find`/`du` trên filesystem erasure-coded vì mỗi object thực chất là 1 thư mục con ở tầng đĩa, `du` cho số sai nếu tính theo entry).
- Đối chiếu DB qua các câu lệnh `SELECT` (không có `UPDATE`/`DELETE`/`INSERT` nào được chạy) trên `bigbike-postgres`, script phân tích Python chạy cục bộ (không dùng thư viện ngoài, chỉ `re`/`json`/`collections` chuẩn).
- Toàn bộ file trung gian (danh sách 13.239 object, kết quả trích tham chiếu, top file nặng nhất đầy đủ) lưu tại thư mục scratch của phiên làm việc, không commit vào repo.
- Tham chiếu code: `MediaPathResolver.java` (prefix `wp-uploads/`), `MediaReferenceService.java` (logic tham chiếu media hiện có trong ứng dụng — audit này dùng phương pháp quét độc lập bằng SQL, không gọi lại service này).
