# Dựng hệ thống sao lưu ra NAS + diễn tập khôi phục — 06/09/2026

`OWNER_CONFIRMED_2026-09-06`

Báo cáo chạy thật trên máy chủ production (`103.1.236.148`). Mọi số liệu dưới đây là kết quả
lệnh thật, không phải ước lượng. Quy trình vận hành: [`../engineering/BACKUP_RESTORE_RUNBOOK.md`](../engineering/BACKUP_RESTORE_RUNBOOK.md).

## Tình trạng trước khi làm

Không có bản sao lưu nào. Việc dựng đã bắt đầu 02/09/2026 và dừng sau khi nối xong đường truyền.

## Bốn điểm khác với mô tả ban đầu — đo lại 06/09/2026

| Mục | Mô tả ban đầu | Đo thật |
|---|---|---|
| Đĩa máy chủ | Đầy 99%, còn 1,2 GB | Còn **51 GB** trống (dùng 59%) — không còn gấp |
| Bộ nhớ đệm build Docker | 6,7 GB dọn được | **6,98 GB** dọn được |
| Kết nối NAS | Đang gắn tại `/mnt/bigbike-nas` | **Đã mất.** Máy chủ khởi động lại lúc 20:09 cùng ngày; kết nối không tự nối lại — đúng lỗ hổng cần vá |
| Mã nguồn | Đã trên Git, không cần sao lưu | **37 tệp đang sửa dở chưa lưu Git** → đã đưa vào phần sao lưu cấu hình |

## Bốn phát hiện kỹ thuật ảnh hưởng tới thiết kế

1. **Nhà cung cấp máy chủ chặn toàn bộ UDP đi ra.** Kiểm chứng: gửi gói tin đồng bộ giờ tới 3 máy chủ
   (`0.vn.pool.ntp.org`, Google, Cloudflare) — **0/3 trả lời**. Đây là nguyên nhân gốc của cả việc
   đường riêng phải đi vòng qua Hong Kong lẫn việc đồng hồ máy chủ chưa bao giờ đồng bộ được.
2. **NAS chỉ nói NFS v4.0.** `nfsvers=4.1` bị từ chối (`Protocol not supported`); đường dẫn chia sẻ là
   `/volume1/Bigbike` chứ không phải `/Bigbike`. `showmount` và `rpcinfo` có tham số đều **treo không dừng được**
   (một tiến trình `rpcinfo` treo phải `kill -9`).
3. **Kiểu gắn ổ cũ treo vô hạn khi NAS nghẽn.** Lúc 19:43 cùng ngày, kernel ghi **57 dòng** "NAS không trả lời"
   trong 28 giây. Đã đổi sang `soft,timeo=600,retrans=2` — báo lỗi sau ~3 phút thay vì treo.
4. **Chép từng tệp là bất khả thi.** Đo được **280 ms mỗi thao tác tệp** (185 ms khi chạy 24 luồng song song;
   `nconnect=8` không cải thiện). Kho ảnh 6.223 tệp trong hàng nghìn thư mục lồng nhau → thực đo **11 tệp/phút**,
   tức **~9,6 tiếng mỗi lượt**. Đã đổi sang gói nén một tệp: đo thật **1,46 GB trong ~12 phút (~2 MB/s)**.

## Đã dựng

| Hạng mục | Kết quả |
|---|---|
| Chỗ chứa trên NAS | `/Bigbike/vps-backups/` — một thư mục con duy nhất. 14 mục sẵn có ở gốc `/Bigbike` không bị đụng |
| Gắn NAS tự động | `mnt-bigbike\x2dnas.{mount,automount}`, đã `enable`, tự nối lại sau khởi động |
| Lịch chạy + số bản giữ | `/etc/cron.d/bigbike-backup` — **một tệp duy nhất** cho cả nhịp chạy lẫn số bản |
| Script | `scripts/ops/backup-to-nas.sh`, `restore-from-nas.sh`, `lib/nas-common.sh` |
| Báo động | Telegram + email tới hộp thư nội bộ (owner chọn cả hai) |
| Đồng hồ máy chủ | Chuyển `timesyncd` sang máy chủ giờ IPv4; vẫn không đồng bộ được vì UDP bị chặn, nhưng `kvm-clock` giữ sai số **1 giây** nên cảnh báo theo thời gian vẫn tin được |

## Bằng chứng chạy thật

### 1. Ba lớp chặn không cho ghi nhầm vào đĩa máy chủ

Thử `chattr +i` trên thư mục nháp trước khi áp dụng thật:

```
chattr +i: OK
-> ghi vao thu muc khoa: BI TU CHOI (dung nhu mong doi)
-> gan de len thu muc khoa: THANH CONG
-> sau khi gan, ghi duoc: OK
```

Áp dụng thật lên `/mnt/bigbike-nas`:

```
lsattr -d /mnt/bigbike-nas  ->  ----i---------e-------
touch /mnt/bigbike-nas/should-fail
  touch: setting times of '/mnt/bigbike-nas/should-fail': No such file or directory
-> Chan thanh cong: khong the ghi vao dia may chu khi NAS chua gan
```

### 2. Lịch tự động đang sống

Cron tự chạy người gác lúc 22:40:01, không ai gọi tay:

```
Sep 06 22:40:01 CRON[132267]: (root) CMD ( flock -n /var/lock/bb-backup-watch.lock timeout 600 \
    bash $BB_REPO/scripts/ops/backup-to-nas.sh watchdog )
06/09/2026 22:40:02 +07 [watchdog] Nguoi gac: ban moi nhat cach day 0 gio - binh thuong.
```

Cron cũng tự nạp lại tệp lịch mỗi khi sửa (`RELOAD (/etc/cron.d/bigbike-backup)`).

### 3. Diễn tập cắt kết nối NAS — báo động phải kêu

Dừng phần gắn NAS (mô phỏng NAS ở nhà mất điện/mất mạng), rồi cho chạy một lượt sao lưu thật:

```
--- sau khi cat ---
/mnt/bigbike-nas is not a mountpoint
--- lop chan cuoi: thu ghi vao diem gan khi NAS khong co ---
touch: setting times of '/mnt/bigbike-nas/test-ghi-nham': No such file or directory
  => He dieu hanh TU CHOI ghi. Dia may chu an toan.

07/09/2026 00:53:17 [config] THAT BAI: NAS chua duoc gan tai /mnt/bigbike-nas.
                             Kiem tra NAS o nha con dien/mang khong.
07/09/2026 00:53:18 [config] Telegram: da gui (200)
07/09/2026 00:53:23 [config] Email: da gui toi bigbikevnshop@gmail.com
```

Kiểm chứng **email thật đã nằm trong hộp thư** `bigbikevnshop@gmail.com`, chưa đọc:
tiêu đề `⚠️ BigBike sao luu THAT BAI — config`, lúc 00:53:23.

### 4. Diễn tập tự nối lại (mô phỏng khởi động lại máy chủ)

Bật lại phần gắn kết nối — **không khởi động lại máy chủ**:

```
--- cham vao thu muc, phai tu gan ---
/mnt/bigbike-nas is a mountpoint
100.116.56.123:/volume1/Bigbike nfs4
--- co bat san sau khi may chu khoi dong lai khong ---
enabled

07/09/2026 00:53:40 [config] Chuyen config-20260907T005340.tar.gz (32K) sang NAS...
07/09/2026 00:53:43 [config] Da xac nhan toan ven: 3c8f541c27ec8519...
07/09/2026 00:53:45 [config] Xong. Cau hinh van hanh da sao luu (29K).
```

Lượt vừa thất bại chạy lại **thành công ngay**, không cần can thiệp gì thêm.

### 5. Tin tổng kết hằng ngày

Chạy thật lúc 00:54, email đã tới hộp thư — tiêu đề `BigBike sao luu — tong ket ngay 07/09/2026`:

```
24 gio qua: 7 luot thanh cong, 2 luot hong
Du lieu ban hang: 3 ban theo gio, 2 theo ngay, 1 theo thang
Ban moi nhat: db-20260907T001003.dump — cach day 0 gio
Kho anh: 6231 tep, sao luu ngay 2026-09-06 (goi inc)
Cho trong NAS: 1.2T   |   Cho trong may chu: 58G
```

### 6. Báo động hoạt động — chứng minh ngoài ý muốn

Lượt sao lưu đầu tiên thất bại thật (lỗi cú pháp bước kiểm tra bản chụp). Hệ thống tự báo cả hai kênh:

```
06/09/2026 22:24:33 [db] THAT BAI: Ban chup vua tao khong doc duoc (hong ngay tu dau).
06/09/2026 22:24:35 [db] Telegram: da gui (200)
06/09/2026 22:24:40 [db] Email: da gui toi bigbikevnshop@gmail.com
```

Lần thứ hai (22:33) khi lượt kho ảnh bị ngắt giữa chừng cũng báo động đúng.

### 7. Diễn tập khôi phục — dữ liệu bán hàng

Khôi phục vào cơ sở dữ liệu thử `bigbike_restore_drill_20260906225903`, đối chiếu, rồi tự xoá.
**Không chạm một dòng dữ liệu thật.** Nạp xong trong **55 giây**.

| Mục | Đang chạy | Khôi phục | Kết quả |
|---|---|---|---|
| Đơn hàng | 1.672 | 1.672 | KHỚP |
| Dòng hàng trong đơn | 1.924 | 1.924 | KHỚP |
| Khách hàng | 1.960 | 1.960 | KHỚP |
| Sản phẩm | 249 | 249 | KHỚP |
| Ảnh trong kho (bản ghi) | 3.756 | 3.756 | KHỚP |
| Danh mục | 37 | 37 | KHỚP |
| Thương hiệu | 26 | 26 | KHỚP |
| Cấu hình cửa hàng | 59 | 59 | KHỚP |
| Phiên bản CSDL | 1080 | 1080 | KHỚP |

Dấu kiểm tra đọc ngược từ NAS khớp bản ghi khi sao lưu:
`9e324b675b0f28c3dc160a449a1d78d0785a035d584a8620cb12361d447ad25c`

### 8. Gói cấu hình không lẫn dữ liệu khách hàng khác

Kiểm tra nội dung gói: chỉ có cấu hình BigBike. Lọc `4thitek` cho **0 kết quả**.


### 9. Sao lưu kho ảnh — gói nén thay vì chép từng tệp

| Lượt | Kết quả đo thật |
|---|---|
| Gói đầy (mỗi 30 ngày) | 1,46 GB, gửi lên trong ~12 phút; đọc ngược kiểm tra ~45 phút. Dấu kiểm tra khớp: `688a3228beede1190e343ae51d508cc0e7570e2d955c05c9bfe131d3fca1d55d` |
| Gói thay đổi (hằng ngày) | **13 giây, 381 KB.** Dấu kiểm tra khớp |

So với cách chép từng tệp đã thử và bỏ (**11 tệp/phút → ~9,6 tiếng mỗi lượt**).

### 10. Tốc độ đường truyền — bất đối xứng, ảnh hưởng tới thời gian khôi phục

| Chiều | Tốc độ đo |
|---|---|
| Ghi lên NAS | ~2,0 MB/s |
| Đọc từ NAS | ~0,4–0,77 MB/s (đo 5 lần) |

Đã thử tăng kích thước gói lên 1 MB (NAS chỉ chấp nhận tối đa 128 KB) và bật 8 kênh song song:
**không cải thiện**. Nút thắt là đường mạng dân dụng tại nhà — đọc từ NAS chính là lúc mạng nhà tải lên.

**Điều cần nhớ: khôi phục kho ảnh 1,46 GB mất khoảng 50 phút.**

### 11. Ba lỗi tự bắt được nhờ chạy thật

Không lỗi nào bị lệnh kiểm tra cú pháp phát hiện — chỉ lộ ra khi chạy trên hệ thống thật:

1. Bước kiểm tra bản chụp dùng sai cú pháp → lượt đầu tiên thất bại (và chính nó chứng minh báo động chạy).
2. Diễn tập kho ảnh báo "dấu kiểm tra không khớp" oan: giải nén kiểu tăng dần tự xoá mọi tệp lạ trong
   thư mục đích, xoá luôn tệp tạm chứa dấu kiểm tra. Đã kiểm chứng độc lập bản sao vẫn nguyên vẹn.
3. Tin tổng kết không chạy được do dấu ngoặc đóng sai chỗ.

Rút kinh nghiệm ghi vào quy trình: **kiểm tra cú pháp không đủ, phải chạy thử từng lệnh con.**

## Giới hạn đã biết

- **Mất tối đa 1 giờ dữ liệu bán hàng** — sao lưu chạy mỗi giờ.
- **Kho ảnh chỉ giữ bản mới nhất** (owner chốt 06/09/2026). Ảnh xoá nhầm phát hiện muộn thì không lấy lại được.
- **Nếu toàn bộ bộ hẹn giờ của máy chủ chết, máy chủ không tự báo cho chính nó được.** Tin tổng kết mỗi
  sáng 06:00 là cách bù: tin ngừng đến chính là dấu hiệu hỏng.
- **Khôi phục kho ảnh mất ~50 phút** vì mạng nhà tải lên chậm. Khôi phục dữ liệu bán hàng chỉ mất ~1 phút.
- **Đồng hồ máy chủ không đồng bộ qua mạng được** do UDP bị chặn. Hiện lệch 1 giây nhờ máy chủ vật lý.
  Nếu lệch nhiều, cảnh báo "quá 24 giờ" sẽ sai cho tới khi chỉnh tay.
- **Gói kho ảnh chụp trong lúc kho đang phục vụ khách.** Ảnh vừa được tải lên đúng lúc đang gói có thể
  lọt phần mô tả mà thiếu nội dung; lượt sao lưu hôm sau tự bắt lại.
