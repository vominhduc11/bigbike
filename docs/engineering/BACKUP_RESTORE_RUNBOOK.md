# Backup & Restore Runbook — sao lưu và khôi phục dữ liệu BigBike

`OWNER_CONFIRMED_2026-09-06`

---

# PHẦN 1 — DÀNH CHO CHỦ SHOP

*Đọc phần này là đủ. Không cần biết kỹ thuật.*

## Bản sao lưu nằm ở đâu?

Ở **máy NAS đặt tại nhà anh**, trong thư mục `Bigbike/vps-backups`. Mọi tài liệu công việc khác đang có sẵn trong thư mục `Bigbike` (file Excel hàng hoá, thư mục ảnh, hồ sơ) **không bị đụng tới**.

Máy chủ nối tới NAS qua một đường riêng đã mã hoá. **Không có cổng nào mở ra Internet**, người ngoài không vào được.

Có ba loại bản sao:

| Loại | Bao lâu một lần | Giữ lại |
|---|---|---|
| **Dữ liệu bán hàng** — đơn hàng, khách hàng, sản phẩm, tồn kho, cấu hình cửa hàng | Mỗi giờ | 48 bản theo giờ, 30 bản theo ngày, 12 bản theo tháng |
| **Kho ảnh/video sản phẩm** | Mỗi ngày lúc 01:00 sáng | Bản mới nhất |
| **Cấu hình vận hành** — thông số hệ thống, cấu hình web, cả phần mã đang sửa dở chưa lưu | Mỗi ngày lúc 00:40 sáng | 30 bản ngày, 12 bản tháng |

Bản quá hạn **tự xoá**, không cần ai dọn.

## Làm sao biết nó còn chạy?

**Mỗi sáng 06:00 anh nhận một tin tổng kết** qua Telegram và email: đêm qua sao lưu mấy lượt, bản mới nhất lúc nào, NAS còn trống bao nhiêu.

> **Tin này ngừng đến = hệ thống sao lưu đã chết.** Đó là dấu hiệu quan trọng nhất — nếu hai ngày liền không thấy tin, phải kiểm tra ngay.

Ngoài ra hệ thống **tự báo động** trong hai trường hợp:
- Một lượt sao lưu thất bại (NAS mất điện, mất mạng, đầy ổ…).
- Quá 24 giờ không có bản sao mới, dù vì lý do gì.

Muốn tự kiểm tra bất cứ lúc nào, gõ đúng một dòng này trên máy chủ:

```bash
bash /root/myproject/bigbike/scripts/ops/backup-to-nas.sh list
```

Nó in ra danh sách bản sao đang có, dung lượng, giờ tạo, và chỗ trống còn lại.

## Mất dữ liệu thì làm gì để lấy lại?

**Bước 1 — đừng vội.** Không xoá gì thêm, không cài lại gì. Bản sao vẫn nằm nguyên trên NAS ở nhà.

**Bước 2 — kiểm tra bản sao còn tốt không:**
```bash
bash /root/myproject/bigbike/scripts/ops/backup-to-nas.sh verify
```
Hiện chữ **KHỚP** là bản sao còn nguyên vẹn, dùng được.

**Bước 3 — thử khôi phục vào chỗ riêng trước khi động vào hệ thống thật:**
```bash
bash /root/myproject/bigbike/scripts/ops/restore-from-nas.sh --drill
```
Lệnh này khôi phục vào một bản thử tách riêng rồi tự dọn. **Nó không bao giờ ghi đè dữ liệu đang chạy.** Nó in ra bảng đối chiếu số đơn hàng / khách hàng / sản phẩm / ảnh giữa bản sao và hệ thống thật.

**Bước 4 — khôi phục thật.** Bước này **ghi đè dữ liệu đang chạy**, nên phải có người kỹ thuật làm theo Phần 3 bên dưới. Script cố tình **không** tự làm bước này.

### Ba tình huống thường gặp

| Tình huống | Làm gì |
|---|---|
| Xoá nhầm vài đơn / vài sản phẩm | Chạy `--drill` để lấy dữ liệu ra bản thử, rồi chép lại đúng phần cần. Không cần khôi phục toàn bộ. |
| Cả hệ thống hỏng, máy chủ vẫn còn | Theo Phần 3 — khôi phục dữ liệu bán hàng rồi tới kho ảnh. Mất tối đa **1 giờ** dữ liệu gần nhất. |
| Máy chủ mất trắng, phải thuê máy mới | Lấy mã nguồn từ GitHub, lấy cấu hình + dữ liệu + ảnh từ NAS. Toàn bộ hướng dẫn ở Phần 3. |

### Mất bao lâu để lấy lại

| Việc | Thời gian đo thật |
|---|---|
| Kiểm tra một bản sao còn tốt không | ~30 giây |
| Lấy lại toàn bộ dữ liệu bán hàng | **~1 phút** |
| Lấy lại toàn bộ kho ảnh (1,46 GB) | **~50 phút** — mạng nhà tải lên chậm, không rút ngắn được bằng cấu hình |

### Điều cần biết trước

- **Mất tối đa 1 giờ dữ liệu bán hàng.** Sao lưu chạy mỗi giờ, nên đơn đặt trong vòng một giờ trước sự cố có thể mất.
- **Kho ảnh: chỉ giữ bản mới nhất** (anh chốt ngày 06/09/2026). Ảnh xoá nhầm mà hôm sau mới phát hiện thì **không lấy lại được**.
- **NAS phải bật.** NAS ở nhà mất điện thì lượt sao lưu đó thất bại và anh nhận báo động ngay — nhưng trong lúc đó không có bản sao mới.

---

# PHẦN 2 — VẬN HÀNH

## Chỉnh nhịp chạy và số bản giữ lại

Tất cả nằm trong **đúng một tệp**: `/etc/cron.d/bigbike-backup`. Sửa số trong đó là xong, hệ thống tự đọc lại, không cần khởi động lại gì.

| Thông số | Mặc định | Ý nghĩa |
|---|---|---|
| `BB_KEEP_HOURLY` | 48 | Số bản dữ liệu bán hàng theo giờ |
| `BB_KEEP_DAILY` | 30 | Số bản theo ngày |
| `BB_KEEP_MONTHLY` | 12 | Số bản theo tháng |
| `BB_ALERT_STALE_HOURS` | 24 | Quá bao nhiêu giờ không có bản mới thì báo động |
| `BB_MEDIA_REBASE_DAYS` | 30 | Bao nhiêu ngày thì gói lại kho ảnh một lần |

Nhịp chạy nằm ở phần cuối cùng tệp, dạng `phút giờ ngày tháng thứ`.

## Các thành phần

| Thành phần | Ở đâu | Việc |
|---|---|---|
| Script sao lưu | `scripts/ops/backup-to-nas.sh` | `db` / `media` / `config` / `watchdog` / `digest` / `list` / `verify` |
| Script khôi phục | `scripts/ops/restore-from-nas.sh` | `--drill` / `db --into` / `media --into` |
| Thư viện dùng chung | `scripts/ops/lib/nas-common.sh` | Kiểm tra NAS, báo động, sổ chạy, xoá bản quá hạn |
| Lịch chạy | `/etc/cron.d/bigbike-backup` | **Chỗ duy nhất** để chỉnh |
| Khai báo gắn NAS | `/etc/systemd/system/mnt-bigbike\x2dnas.{mount,automount}` | Tự nối lại sau khi khởi động máy chủ |
| Sổ chạy | `vps-backups/logs/runs.jsonl` **trên NAS** | Còn sống kể cả khi máy chủ mất trắng |
| Nhật ký máy chủ | `/var/log/bigbike-backup/run.log` | Chi tiết từng lượt |

## Ba lớp chặn không cho ghi nhầm vào đĩa máy chủ

Tình huống nguy hiểm nhất là NAS mất mạng mà máy chủ vẫn tưởng đang ghi ra NAS, thực chất ghi vào đĩa của chính nó rồi làm đầy đĩa và sập cơ sở dữ liệu (đã xảy ra ngày 27/08/2026 vì lý do khác).

1. Script kiểm tra ổ NAS có thật sự đang gắn không.
2. Script kiểm tra tệp mốc `.nas-marker` — tệp này chỉ tồn tại trên NAS.
3. Thư mục `/mnt/bigbike-nas` được **khoá ghi ở mức hệ thống tệp** (`chattr +i`). Kể cả hai lớp trên hỏng, hoặc một chương trình khác ghi nhầm vào đó, hệ điều hành vẫn từ chối. Gắn ổ đè lên vẫn bình thường.

Kiểm tra lớp 3 còn nguyên:
```bash
lsattr -d /mnt/bigbike-nas     # phải thấy chữ 'i'
```

## Đặc thù đường truyền tới NAS — đã đo, cần biết

| Thông số | Giá trị đo 06/09/2026 |
|---|---|
| Đường đi | Qua trạm trung chuyển Hong Kong, **không nối thẳng được** |
| Độ trễ | ~105 ms |
| Tốc độ ghi lên NAS | ~2,0 MB/s |
| Tốc độ đọc từ NAS | ~0,5 MB/s — **chậm hơn ghi ba lần** |
| Chi phí mỗi thao tác tệp | ~280 ms |
| Phiên bản chia sẻ file | **NFS v4.0** — v4.1 bị NAS từ chối |
| Đường dẫn chia sẻ | `100.116.56.123:/volume1/Bigbike` (không phải `/Bigbike`) |

**Vì sao đọc chậm hơn ghi:** NAS đặt ở nhà, dùng mạng dân dụng. Tốc độ **tải lên** của mạng nhà (chính là lúc máy chủ đọc từ NAS) thấp hơn tốc độ tải xuống. Đã thử đổi cấu hình (tăng kích thước gói, tăng số kênh song song) — không cải thiện, vì nút thắt nằm ở đường truyền tại nhà chứ không ở cấu hình. **Hệ quả cần nhớ: khôi phục kho ảnh 1,46 GB mất khoảng 50 phút.** Muốn nhanh hơn thì phải nâng gói mạng ở nhà, hoặc mang ổ cứng NAS tới chỗ máy chủ.

**Nguyên nhân gốc của việc phải đi vòng:** nhà cung cấp máy chủ **chặn toàn bộ UDP đi ra**. Đã kiểm chứng: không gói tin đồng bộ giờ nào tới được (3/3 máy chủ giờ đều không trả lời), và đường riêng buộc phải đi vòng qua trạm trung chuyển. Đây là giới hạn của nhà cung cấp, không sửa được từ phía máy chủ.

**Hệ quả quan trọng:** vì mỗi thao tác tệp tốn 280 ms, chép kho ảnh theo từng tệp (6.223 tệp trong hàng nghìn thư mục lồng nhau) mất khoảng **9,6 tiếng mỗi lần**. Vì vậy kho ảnh được **gói thành một gói nén rồi gửi đi**: gói nén chạy full tốc độ đường truyền. Hằng ngày chỉ gửi phần thay đổi (vài giây); mỗi 30 ngày gói lại bản đầy một lần — mất khoảng **50 phút** (~12 phút gửi lên, ~37 phút đọc ngược lại để kiểm tra). Chạy lúc 01:00 nên vẫn xong trước khung việc tự động 02:30–04:30 của hệ thống.

Ba lệnh **không được dùng** trên máy này: `showmount`, `rpcinfo <chương-trình> <phiên-bản>`, và gắn ổ bằng NFS v3 — cả ba đều treo vô hạn và không dừng được bằng `Ctrl+C`.

Kiểu gắn ổ dùng `soft`: NAS mất điện thì trả lỗi sau ~3 phút rồi bỏ cuộc, **không treo cả máy chủ**. Đây là lựa chọn có chủ đích — bản sao đều được đối chiếu dấu kiểm tra nên lỗi im lặng bị bắt ngay.

## Đồng hồ máy chủ

Máy chủ **không đồng bộ giờ qua mạng được** (UDP bị chặn). Giờ hiện lấy từ máy chủ vật lý và chỉ lệch ~1 giây, nên cảnh báo theo thời gian vẫn tin được. Kiểm tra định kỳ:

```bash
curl -sI https://www.google.com | grep -i ^date   # so với: date -u
```

Lệch quá vài phút thì chỉnh tay bằng `date -s`, và cảnh báo "quá 24 giờ" sẽ không còn chính xác cho tới khi chỉnh.

---

# PHẦN 3 — KHÔI PHỤC

> **Quy tắc bất di bất dịch:** luôn chạy `--drill` trước. Chỉ khôi phục đè khi bản thử đã cho kết quả KHỚP.

## 3.1 Diễn tập (an toàn tuyệt đối, chạy lúc nào cũng được)

```bash
bash scripts/ops/restore-from-nas.sh --drill
```

Khôi phục dữ liệu bán hàng vào một cơ sở dữ liệu thử tên riêng, giải nén kho ảnh ra một thư mục thử, đối chiếu số liệu với hệ thống đang chạy, rồi **tự xoá cả hai**. Không chạm dữ liệu thật.

## 3.2 Lấy lại một phần dữ liệu (xoá nhầm vài bản ghi)

```bash
bash scripts/ops/restore-from-nas.sh db --into bigbike_cuu_ho
```
Tạo một cơ sở dữ liệu riêng chứa toàn bộ dữ liệu tại thời điểm sao lưu. Lấy phần cần rồi xoá nó đi. Script **từ chối** nếu đích trùng cơ sở dữ liệu đang chạy.

## 3.3 Khôi phục đè lên hệ thống đang chạy — thao tác phá huỷ

**Chỉ làm khi dữ liệu hiện tại đã hỏng và có quyết định của chủ shop.**

1. Ngừng nhận đơn (trang xin lỗi tự động sẽ hiện khi backend dừng).
2. Sao lưu **ngay** trạng thái hiện tại — kể cả khi nó đã hỏng:
   ```bash
   bash scripts/ops/backup-to-nas.sh db
   ```
3. Chọn bản sao muốn dùng: `backup-to-nas.sh list`
4. Nạp vào một cơ sở dữ liệu mới và kiểm tra kỹ:
   ```bash
   bash scripts/ops/restore-from-nas.sh db --into bigbike_new --file <đường-dẫn-bản-sao>
   ```
5. Đối chiếu số liệu. Đạt thì đổi tên: đổi `bigbike` → `bigbike_hong_<ngày>`, `bigbike_new` → `bigbike`.
   **Đổi tên, không xoá** — giữ bản hỏng lại để còn đối chiếu.
6. Khởi động lại backend, kiểm tra web và trang quản trị.

## 3.4 Khôi phục kho ảnh

```bash
# 1. Giải nén ra thư mục riêng (KHÔNG đè kho đang chạy)
bash scripts/ops/restore-from-nas.sh media --into /var/tmp/media-restore

# 2. Kiểm tra số tệp
find /var/tmp/media-restore -type f | wc -l

# 3. Chỉ khi đã chắc: dừng dịch vụ ảnh, thay dữ liệu, bật lại
#    (thao tác thủ công, cần người kỹ thuật)
```
Script cố tình **không** tự ghi đè kho ảnh đang chạy.

## 3.5 Máy chủ mất trắng — dựng lại từ đầu

1. Thuê máy mới, cài Docker và Tailscale, nối vào cùng mạng riêng.
2. Gắn NAS (xem thông số ở Phần 2), lấy gói cấu hình mới nhất trong `vps-backups/config/daily/`.
3. Lấy mã nguồn từ GitHub, đặt lại các tệp cấu hình từ gói vừa lấy.
4. Khởi động hệ thống, rồi khôi phục dữ liệu bán hàng (3.3) và kho ảnh (3.4).

> Gói cấu hình chứa **mật khẩu thật**. Nó nằm trên NAS riêng của anh, quyền đọc bị giới hạn, và **không bao giờ được đưa lên GitHub**.

---

# PHẦN 4 — BẰNG CHỨNG DIỄN TẬP

Toàn bộ kết quả chạy thật ngày 06–07/09/2026 — danh sách bản sao, đối chiếu số liệu khôi phục,
ảnh chụp báo động, tốc độ đo được và các lỗi tự bắt được — ghi tại
[`../audits/BACKUP_NAS_SETUP_2026-09-06.md`](../audits/BACKUP_NAS_SETUP_2026-09-06.md).

Tóm tắt: diễn tập khôi phục dữ liệu bán hàng cho **9/9 con số khớp chính xác**; diễn tập cắt
kết nối NAS làm báo động kêu đúng ở cả Telegram lẫn email; kết nối tự nối lại được mà không cần
khởi động lại máy chủ.

## Bài học ghi lại cho lần sau

- **Kiểm tra cú pháp script không đủ.** Cả ba lỗi trong lần dựng này đều lọt qua `bash -n` và chỉ
  lộ ra khi chạy thật. Sửa xong phải chạy thử từng lệnh con.
- **Giải nén kiểu tăng dần tự xoá mọi tệp lạ trong thư mục đích.** Không bao giờ để tệp làm việc
  chung thư mục với chỗ giải nén.
- **Trên máy này tuyệt đối không chạy `showmount` hay `rpcinfo` có tham số** — treo không dừng được.
- **`pkill -f <mẫu>` có thể tự giết phiên đang chạy** nếu mẫu khớp chính dòng lệnh của nó. Dùng
  `pgrep -x` theo tên tiến trình.
