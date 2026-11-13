# Ảnh cần shop xử lý — feed thật 10/11/2026

Đã GET đủ 348 URL ảnh chính, đọc được kích thước toàn bộ. 121 SKU có cạnh dưới 800; 6 SKU thêm cần rà tên thumbnail dù kích thước đã đủ. Trong đó 20 SKU BK088 đã tìm/xác minh ảnh đủ 800 và chờ duyệt chọn lại; **101 SKU dưới 800 còn chưa có gốc phù hợp được xác minh trong nguồn đã kiểm** ([CSV cần shop cung cấp/đối chiếu nguồn](shop-missing-verified-original.csv)). Sáu SKU chỉ cần rà hậu tố tên, không mặc định phải chụp mới. Tổng 127 SKU trong [CSV từng mã](shop-image-requests.csv). Ngưỡng 800 là yêu cầu shop, không tự gắn thành yêu cầu hiện hành của Google. Không phóng to ảnh nhỏ.

Các file gốc/ứng viên là media đang có thật, không đoán URL bằng cách bỏ hậu tố. [Ứng viên toàn catalog](catalog-image-candidates.csv) chưa tự chứng minh đúng màu/model. Cần kiểm bằng hình và dữ liệu gán biến thể. Chưa tìm thấy gốc phù hợp trong nguồn đã kiểm khác với gốc đã mất.

| Ảnh đang dùng | Kích thước thật | SKU liên quan | Việc cần làm |
|---|---|---|---|
| giay-bao-ve-komine-bk0889-300x300-1.jpg | 300×300 | `BK088-XAM2-38`, `BK088-XAM2-37`, `BK088-XAM2-36`, `BK088-XAM2-39`, `BK088-XAM2-40`, `BK088-XAM2-41`, `BK088-XAM2-42`, `BK088-XAM2-43`, `BK088-XAM2-44`, `BK088-XAM2-45` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| GIAY-KOMINE-BK088-MAU-DEN-1.jpg | 1500×631 | `BK088-DEN-39`, `BK088-DEN-38`, `BK088-DEN-37`, `BK088-DEN-36`, `BK088-DEN-40`, `BK088-DEN-41`, `BK088-DEN-42`, `BK088-DEN-43`, `BK088-DEN-44`, `BK088-DEN-45` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| CABERG-AVALON-X-BLACK-09-1024x1024-1.jpg | 1024×1024 | `CABERG-A-DEN-M` | Rà ảnh/tên file; không tự thay do có hậu tố |
| CABERG-AVALON-X-WHITE-01-1024x1024-1.jpg | 1024×1024 | `CABERG-A-TRANG2-M` | Rà ảnh/tên file; không tự thay do có hậu tố |
| CABERG-AVALON-X-BLACK-RED-20-2-1.jpg | 50×50 | `CABERG-A-DO-L` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| OF616-BRUSH-Gloss-Black-H-V-Yellow-400x400-1.jpg | 400×400 | `LS2-OF616-XANHLA-XL` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| OF610-Gloss-Black-400x400-1.jpg | 400×400 | `LS2-OF610-2-DEN-XSS`, `LS2-OF610-2-DEN-ML`, `LS2-OF610-2-DEN-XL2XL` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| OF610-Gloss-White-400x400-1.jpg | 400×400 | `LS2-OF610-2-TRANG2-XSS1590000`, `LS2-OF610-2-TRANG2-ML`, `LS2-OF610-2-TRANG2-XL2XL` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| OF610-Nardo-400x400-1.jpg | 400×400 | `LS2-OF610-2-XAM2-XSS`, `LS2-OF610-2-XAM2-ML`, `LS2-OF610-2-XAM2-XL2XL` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| z7100657511766_3f1d6c0632d5637931df4e8e3e1b0233.jpg | 600×600 | `LS2-OF610-DEN` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| z7100657613933_304d11f32355d028087846a56cc8daa5.jpg | 600×600 | `LS2-OF610-GUONG` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| z7100657469630_32ecabac84d028a2baef841418412c31.jpg | 600×600 | `LS2-OF610-TRANG2` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| RSB278-WP-Red-01.jpg | 564×564 | `RSB278-DO` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| z3945940614589_2e8f79712829f4d4c7290ef44a72a3f6.jpg | 565×565 | `RSB278-DEN` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| RSB278-WP-Red-02.jpg | 564×564 | `RSB278-CAMO` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| Balo-deo-lung-di-mo-to-phuot-GIVI-RBP02-chong-nuoc.jpg | 500×500 | `RBP02` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| Tui-deo-hong-deo-bao-tu-CHONG-NUOC-Givi-RWB04-4.png | 500×500 | `TUIH-GIVI-RWB04` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| QU%E1%BA%A6N-L%C3%93T-TESLA-THERMAL-WINTERGEAR-1.jpg | 600×600 | `ALTL-MAO`, `ALTL-5FDUAL`, `ALTL-QUAN` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| t_i_eo_i_givi_ea113b_easy-03.png | 500×500 | `EA113B` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| Trum-dau-fullface-sixs-six2-DBX-02-1.jpg | 564×564 | `DBXR` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| Trum-dau-fullface-sixs-six2-DBX-05-1.jpg | 564×564 | `DBXDB` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| Trum-dau-fullface-sixs-six2-DBX-04-1.jpg | 564×564 | `DBXAB` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| 10-06.png | 627×627 | `RIVA-DOS`, `RIVA-DOXXL`, `RIVA-DOXL`, `RIVA-DOL`, `RIVA-DOM` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| giay-giap-xe-may-rs-taichi-rss010-15.webp | 554×554 | `RSS010`, `TARSS010B-DENBONG39`, `TARSS010B-DENBONG40`, `TARSS010B-DENBONG42`, `TARSS010B-DENBONG43`, `TARSS010B-DENBONG44` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| 3_000000009157-800x800.jpg | 800×800 | `KOMINE-JK1633-DEN-S` | Rà ảnh/tên file; không tự thay do có hậu tố |
| 5_000000009157-800x800.jpg | 800×800 | `KOMINE-JK1633-DO-M`, `KOMINE-JK1633-DO-XL`, `KOMINE-JK1633-DO-XXL` | Rà ảnh/tên file; không tự thay do có hậu tố |
| Tai-nghe-khong-day-cho-mu-bao-hiem-di-mo-to-phuot-tich-hop-2-camera-hanh-trinh-truoc-sau-2K-1K-SCS-S12-Bluetooth-Helmet-Intercom-Camera-Front-Back-1.jpg | 1000×674 | `TNB-SCS-S12` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| z5058271353192_b373dc56fb69b12756d74d08d7a41338.jpg | 600×600 | `AIRYLADY-DENNUL`, `AIRYLADY-DENNUM`, `AIRYLADY-DENNUS`, `AIRYLADY-DENNUXS` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| riva_lady_black_dark_grey_pink.jpg | 600×600 | `LS2-RIVA LADY-XS`, `LS2-RIVA LADY-S` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| z5058372092988_526fa23b7fc27afb3999412f0b6d79a7.jpg | 600×600 | `ALBALADY-XANHNUS` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| z5058372079624_fcc709f17218743f742b43c1006ed328.jpg | 600×600 | `ALBALADY-DENNUXS`, `ALBALADY-DENNUS` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| sg-11134201-22110-4nbusqpnywjv19.webp | 652×652 | `HELTRUM-CAMO` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| sg-11134201-22110-5jc1iqpnywjv2c.webp | 658×658 | `HELTRUM-DEN` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| sg-11134201-22110-69ormrpnywjv2c.webp | 631×631 | `HELTRUM-XANHLA` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| sg-11134201-22110-rw5u9ppnywjv8a.webp | 656×656 | `HELTRUM-CAMONHAT` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| sg-11134201-22110-6scv5opnywjvdd.webp | 657×657 | `HELTRUM-DENXANHDUONG` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| sg-11134201-22110-fdrw5opnywjve6.webp | 634×634 | `HELTRUM-TRANG2` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| z7318742605105_d0d46b33b5796b84a64a862b0ff6da09.jpg | 500×500 | `DOLOT-HEVIK-HVB210` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| z7308775288216_f658297c46fb47e27e3f4c41c7898106.jpg | 756×1008 | `HVKHVT409-XANHLA3044`, `HVKHVT409-XANHLA3146`, `HVKHVT409-XANHLA3248`, `HVKHVT409-XANHLA3450`, `HVKHVT409-XANHLA3652`, `HVKHVT409-XANHLA3854`, `HVKHVT409-XANHLA4056` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| z7283788235019_739f7ac9c0d4a581b9ca8590c96dcebb.jpg | 600×600 | `TUIX-GIVI-GRT712C` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| z7280627594399_e5d7514d6dcac124de637e6bf8d1769b.jpg | 600×600 | `BALO-GIVI-EA129B` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| z7312069225946_5b8649d01b04fc6ecf2a48633eeaf3b2.jpg | 600×600 | `GIVI-EA148B` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| z7325451417773_0452882ab338f398fef3710c069de20d.jpg | 600×600 | `GIVI-EA132B` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| z7257042879664_b5ea1b5e9163e882e48cd8ebb58fa6b8.jpg | 652×778 | `BALO-GIVI-PBP02` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| z7335163474318_ba7c11dc90d206d3430e1fef9c33b69f.jpg | 500×500 | `TUI-GIVI-EA115BK` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| garager30_rstaichi-nxt056_1_d_20230315155102.jpg | 600×600 | `NXT056-DEN-L` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| rst451bk03-l.jpg | 600×600 | `GTB-RST-451-DT-M`, `GTB-RST-451-DT-L`, `GTB-RST-451-DT-XL`, `GTB-RST-451-DT-XXL` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| rst451bk02-l.jpg | 600×600 | `GTB-RST-451-DD-M`, `GTB-RST-451-DD-L`, `GTB-RST-451-DD-XL`, `GTB-RST-451-DD-XXL` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| images.jpg | 447×447 | `GT-KOM-GK257-BK-M`, `GT-KOM-GK257-BK-L`, `GT-KOM-GK257-BK-XL`, `GT-KOM-GK257-BK-2XL`, `GT-KOM-GK257-BK-3XL` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| giay-ls2-adventure-1.webp | 600×600 | `GBH-LS2-ADVENTURE-MAN-WP-BR-42`, `GBH-LS2-ADVENTURE-MAN-WP-BR-43`, `GBH-LS2-ADVENTURE-MAN-WP-BR-44` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| z7640368100006_9c3d54b2030569a7bb876205214a4c19.jpg | 679×637 | `ILM-HS711-MATTBLACK-M`, `ILM-HS711-MATTBLACK-L`, `ILM-HS711-MATTBLACK-XL`, `ILM-HS711-MATTBLACK-XXL` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| i.jpg | 679×641 | `ILM-HS711-SILVERGRAY-M`, `ILM-HS711-SILVERGRAY-L`, `ILM-HS711-SILVERGRAY-XL`, `ILM-HS711-SILVERGRAY-XXL` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| 1773885615510_2795678014991319851_2795678014991319851_078bbab1ef153949d8c4d0a827f5acf8.jpg | 679×632 | `ILM-HS711-BLACKGRAY-M`, `ILM-HS711-BLACKGRAY-L`, `ILM-HS711-BLACKGRAY-XL`, `ILM-HS711-BLACKGRAY-XXL` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| givi-ea108bv.jpg | 600×600 | `TUIH-GIVI-EA145` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| pwb05-5857.jpg | 600×600 | `TUIH-GIVI-PWB05` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| rwb05__5_.jpg | 600×600 | `TUIH-GIVI-RWB05` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |
| l.jpg | 447×447 | `LS2 OF626-GLOSSBLACK-L`, `LS2 OF626-GLOSSBLACK-XXL` | Ảnh đúng sản phẩm/màu, hai cạnh ≥800; kiểm ứng viên hiện có trước khi yêu cầu chụp mới |

## Những nhóm đã thay đổi so với bàn giao

- BK088 đen: 10 SKU dùng 1.500×631, còn thiếu cạnh 800. BK088-XAM2: 10 SKU hiện chọn gallery xám 300×300, không còn dùng ảnh đại diện ghi màu đen 50×21 trong feed; ảnh đại diện ở dữ liệu quản trị vẫn cũ. Đã xác minh media 1.200×1.200 cho xám/đen bằng hình và gallery hiện hữu; chờ duyệt chọn lại, chưa thay dữ liệu.
- CABERG-A-DO-L: 50×50. OF610: 12 SKU, ảnh 400×400 hoặc 600×600; OF616: 1 SKU, 400×400.
- OF626: 4 SKU, có nhóm 1.000×1.000 và nhóm 447×447; chỉ nhóm thiếu nằm CSV. GK257: 5 SKU, 447×447.
- GRT729: 1 SKU đã dùng 1.000×1.000; không giữ nhận định ảnh nhỏ từ số liệu cũ.
- FF808: ba màu đều 1.254×1.254, PNG 1,71–1,94 MB. Ảnh trắng đã chuẩn bị JPEG 160.714 bytes đúng ảnh cũ cho 5 SKU; chưa upload/cập nhật. [Kế hoạch thay](ff808-replacement-plan.json).

Nguồn kiểm: catalog công khai 214 sản phẩm + gallery riêng mọi biến thể + ảnh trong nội dung; registry media hiện tại 4.960 dòng ACTIVE ảnh (có dòng không có URL). Không có export WordPress local, không truy cập tài khoản nhà sản xuất hoặc kho riêng của shop. Phần chưa đủ nguồn/nội dung cần shop cung cấp.
