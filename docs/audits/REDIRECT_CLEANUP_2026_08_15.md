# Redirect cleanup — 15/08/2026

## Phạm vi và cách kiểm chứng

- Đối chiếu toàn bộ 95 địa chỉ trong `DANH_SACH_TRANG_CHET_2026_08_15.csv` với dữ liệu thật của PostgreSQL và website `https://bigbike.vn`.
- Quét website thật hai lượt, tuần tự 500 ms/địa chỉ, hoàn tất lúc 12:06 ICT. Hai lượt khớp nhau, trừ một lần hết thời gian chờ 10 giây ở trang Commo; lượt hai xác nhận cùng kết quả 404.
- 34 địa chỉ chuyển 301 tới đích đúng rồi trả 200; 39 địa chỉ trả 410 ngay; 22 địa chỉ cần trang lịch sử đang trả 404 vì bản web/backend mới chưa được triển khai.
- Không gán nhầm sang sản phẩm khác. Không tạo lọc màu. Không xoá thương hiệu đang tồn tại trong dữ liệu.

Mỗi dòng dưới đây là một hoặc nhiều địa chỉ có **cùng cách xử lý và cùng đích**. Tất cả địa chỉ trong từng dòng đã được quét đủ hai lượt, trừ ghi chú riêng.

## Đã có hiệu lực trên website thật

### 301 — mặt hàng còn bán (7)

| Địa chỉ cũ | Đích |
|---|---|
| `/sp/mũ-bảo-hiẻm-3-4-ls2-bob-of601.html` | `/product/mu-bao-hiem-3-4-ls2-bob-of601/` |
| `/product/mu-bao-hiem-dual-sport-caberg-tanami-carbon-2in1` | `/product/mu-bao-hiem-dual-sport-caberg-tanami-carbon/` |
| `/sp/mu-bao-hiem-dual-sport-ilm-ws-902.html` | `/product/mu-bao-hiem-dual-sport-ilm-ws902/` |
| `/sp/non-bao-hiem-ilm-ws902.html` | `/product/mu-bao-hiem-dual-sport-ilm-ws902/` |
| `/en/sp/dual-sport-ws-902-helmet-dual-visor-rally-off-road-specialist.html` | `/en/product/ilm-ws902-dual-sport-helmet/` |
| `/product/mu-bao-hiem-nua-dau-cho-nguoi-di-xe-may-hjc-is2v` | `/product/mu-bao-hiem-nua-dau-xpeed-is-2v/` |
| `/sp/ao-bao-ho-xe-may-motor-danh-cho-nu-ls2-zoom-lady.html` | `/product/ao-bao-ho-moto-nu-ls2-zoom-lady/` |

### 301 — thương hiệu và danh mục (5)

| Địa chỉ cũ | Đích |
|---|---|
| `/brand/ls2.html/page/3` | `/brands/ls2/` |
| `/brands/alpinestars` | `/brands/alpinestar/` |
| `/brand/quadlock.html` | `/brands/quadlock/` |
| `/danh-muc-san-pham/mu-bao-hiem-lat-ham-thao-ham` | `/danh-muc/mu-bao-hiem-lat-ham-thao-ham/` |
| `/danh-muc-san-pham/mu-bao-hiem-fullface` | `/danh-muc/mu-bao-hiem-fullface/` |

### 301 — lọc cỡ (12 hoàn chỉnh)

| Địa chỉ cũ | Đích |
|---|---|
| `/size/wm` | `/sp/?kich-co=WM` |
| `/size/xxl/page/4` | `/sp/?kich-co=XXL&page=4` |
| `/size/l/page/2` | `/sp/?kich-co=L&page=2` |
| `/size/m/page/2` | `/sp/?kich-co=M&page=2` |
| `/size/s/page/3` | `/sp/?kich-co=S&page=3` |
| `/size/m` | `/sp/?kich-co=M` |
| `/size/34` | `/sp/?kich-co=34` |
| `/size/s` | `/sp/?kich-co=S` |
| `/size/42` | `/sp/?kich-co=42` |
| `/size/36` | `/sp/?kich-co=36` |
| `/size/xxl/page/2` | `/sp/?kich-co=XXL&page=2` |
| `/size/xxl` | `/sp/?kich-co=XXL` |

### 301 — màu cũ: về danh sách sản phẩm, không xây lọc màu (5)

| Địa chỉ cũ | Đích |
|---|---|
| `/color/nerve` | `/sp/` |
| `/color/do` | `/sp/` |
| `/color/trang` | `/sp/` |
| `/color/den-camo` | `/sp/` |
| `/color/den-do` | `/sp/` |

### 301 — địa chỉ hệ thống cũ (4)

| Địa chỉ cũ | Đích |
|---|---|
| `/home` | `/` |
| `/chinh-sach-bao-ve-thong-tin-ca-nhan.html` | `/chinh-sach/chinh-sach-bao-mat-thong-tin/` |
| `/cac-dieu-kien-va-dieu-khoan.html` | `/chinh-sach/chinh-sach-bao-mat-thong-tin/` |
| `/en/en/clothing-motorcycle/leather-jackets-suit.html` | `/en/categories/motorcycle-jackets-riding-pants/` |

### 410 — đã gỡ hẳn (39)

| Nhóm | Địa chỉ cũ | Đích |
|---|---|---|
| Thương hiệu | `/brand/kriega.html?pwb-brand=kriega`, `/brands/enduristan` | 410, không có trang thay thế |
| Danh mục | `/danh-muc-san-pham/chua-phan-loai` | 410, không có trang thay thế |
| Hệ thống | `/wp-admin/admin.php?page=wpseo_dashboard` | 410 + không cho máy tìm kiếm lập chỉ mục |
| Sản phẩm cũ | `/sp/phu-kien-day-rang-tui-kriega-us.html`, `/sp/phu-kien-kinh-ram-vang-mt-snake-carbon.html`, `/sp/tui-deo-dui-cucyma-c01.html`, `/sp/tui-deo-dui-chong-nuoc-komine-sa-245.html`, `/sp/quadlock-vibration-damperner-giam-rung-chong-hu-camera-dien-thoai.html`, `/sp/gang-tay-bao-ho-komine-gk-257.html`, `/sp/gang-tay-taichi-rst461-wrx-air.html`, `/sp/kinh-thay-ls2-ff327-challenger-phu-kien-fullface.html`, `/sp/bao-ve-goi-taichi-trv080.html`, `/sp/tui-chong-nuoc-sw-motech-drybag-700-tail-bag.html`, `/sp/ao-bao-ho-ls2-norway.html`, `/sp/quan-mua-furygan-over-pant.html`, `/sp/khan-trum-dau-ego-balaclava.html`, `/sp/ao-da-tui-khi-helite-roadster.html`, `/sp/giay-adv-touring-chong-nuoc-gaerne-g-stelvio-aquatech.html`, `/sp/mu-bao-hiem-ls2-ff900-valiants-ii-codex-flip-up.html`, `/sp/ao-bao-ho-ls2-cho-nu-bullet.html`, `/sp/quan-bao-ho-ls2-apollo-man.html`, `/sp/falcon-f24-non-nua-dau-carbon-co-dien.html`, `/sp/gang-tay-chong-nang-komine-ak-313.html`, `/sp/mu-bao-hiem-agv-streetmodular-dot-ece-22-06.html`, `/sp/hang-oder-mu-bao-hiem-lat-ham-agv-streetmodular-dot-ece22-06.html`, `/sp/giay-bao-ho-augi-ar2-racing-motorcycle-boots.html`, `/sp/quan-bao-ho-jean-ls2-dakota-cho-nu.html`, `/sp/ao-bao-ho-touring-seventy-degrees-sd-jt43-winter.html`, `/sp/tui-deo-hong-givi-ea108b.html`, `/sp/tui-treo-hong-xe-givi-ae101b.html`, `/sp/mu-bao-hiem-ls2-mx471.html`, `/sp/ao-bao-ho-rs-taichi-rsj347-overlap-mesh-parka.html`, `/sp/tui-deo-dui-givi-ea109b.html`, `/sp/giap-goi-komine-sk-825-ce-level-2.html`, `/sp/tui-chong-nuoc-kriega-us-combo-40-drypack-nhap-anh.html`, `/sp/giay-forma-touring-arbo-dry.html`, `/sp/tui-deo-hong-sw-motech-20-mavi.html`, `/sp/suit-da-1-manh-alpinestars-gp-force.html?gStoreCode=16156049546093849480&amp;gQT=1` | 410, không ghép sang sản phẩm khác |

## Đã chuẩn bị nhưng chưa có hiệu lực trên website thật

### Trang “Đã ngừng bán” (22)

Mỗi địa chỉ dưới đây sẽ giữ nguyên chính địa chỉ đó và trả trang lịch sử 200 sau khi triển khai bản web/backend mới. Hiện cả 22 đang trả 404 vì container đang chạy là bản cũ, chưa có bảng dữ liệu và giao diện quản trị mới.

- `/sp/giay-bao-ho-forma-legacy-dry.html`
- `/sp/quan-giap-bao-ho-furygan-duke-bukser.html`
- `/sp/ao-bao-ho-moto-oneal-underdog-protector-jacket-v-24-black.html`
- `/sp/giap-chan-komine-sk690.html`
- `/sp/quan-bao-ho-ls2-norway.html`
- `/sp/ao-bao-ho-skype-paris.html`
- `/sp/quan-giap-jean-scoyco-p066.html`
- `/sp/giay-bao-ho-chong-nuoc-komine-bk-067.html`
- `/sp/giap-goi-ls2-rookie.html`
- `/sp/ong-tay-chong-nang-ls2.html`
- `/sp/ao-bao-ho-nu-scoyco-jk158w.html`
- `/sp/ao-bao-ho-touring-rjays.html`
- `/sp/gang-tay-mo-to-ilm-thoang-khi-cho-nam-va-nu-jc36.html`
- `/sp/ao-mua-bo-danh-cho-suit-da-1-2-manh-furygan.html`
- `/sp/quan-lot-mac-trong-giap-sixs-super-light-italy.html`
- `/sp/gang-tay-ls2-swift-racing.html`
- `/sp/ba-lo-xo-taichi-rsb290-wp-bucket-backpack-chong-nuoc.html`
- `/sp/mu-bao-hiem-3-4-hjc-i40n-chuan-ece-06-2.html`
- `/sp/ao-quan-giap-bao-ho-ls2-apollo-man.html`
- `/sp/gang-tay-bao-ho-komine-gk-1683.html`
- `/sp/quan-bao-ho-cho-nu-ls2-router.html`
- `/sp/quan-bao-ho-ls2-commo-air-cho-nam-va-nu.html` (lượt quét đầu hết thời gian chờ, lượt hai xác nhận 404)

Trang quản trị và dữ liệu đã được làm trong mã nguồn: tên, nhóm hàng, ảnh đã kiểm chứng, trạng thái hiển thị và lịch sử chỉnh sửa. Chỉ ảnh chính xác của `giap-chan-komine-sk690` đã tìm được trong dữ liệu thật; 21 trang còn lại được để trống ảnh thay vì dùng ảnh sai sản phẩm.

### Một địa chỉ cỡ cần bản mới để giữ số trang

`/size/xxl/?paged=2` hiện về `/sp/?kich-co=XXL` (không còn chết). Bản mới đã sẵn sàng để chuyển đúng tới `/sp/?kich-co=XXL&page=2`; logic đó cũng cần được triển khai cùng lúc với trang “Đã ngừng bán”.

## Cấu hình máy chủ

- Máy truy cập bằng IP trực tiếp hoặc tên miền không nhận diện: HTTP 404 và HTTPS 404.
- `bigbike.vn` vẫn đáp ứng bình thường: HTTP 301 sang HTTPS, HTTPS 200.

## Căn cứ

- `docs/business/BUSINESS_RULES.md` — `REDIRECT_RULE_013` đến `REDIRECT_RULE_015`.
- `docs/engineering/API_CONTRACT.md`, `docs/engineering/DATA_CONTRACT.md`, `docs/engineering/PERMISSION_MATRIX.md`, `docs/engineering/API_FLOW_MAP.md` — nguồn dữ liệu và quyền quản lý trang lịch sử.
- `docs/engineering/DEPLOYMENT_GUIDE.md` — máy chủ mặc định phải trả 404 cho IP/tên miền lạ.
