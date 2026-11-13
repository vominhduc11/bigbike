# Giám sát BigBike và cảnh báo Telegram

Chuẩn bị theo yêu cầu 09/11/2026. **Chưa cài lịch, chưa kết nối bot, chưa gửi tin thử.**

1. **Dùng lại bot Telegram hiện có**: dự án đã báo đơn mới và sao lưu qua cùng bot/nơi nhận; runtime backend có cả token/chat ID (chỉ kiểm có/không, không in giá trị). Xác nhận nơi nhận hiện tại có dev và anh Trí; nếu chưa đủ, thêm bot vào nhóm riêng cho vận hành. Không đổi `BIGBIKE_TELEGRAM_CHAT_ID` của đơn hàng/sao lưu chỉ để thêm uptime. Dev cấu hình bot hiện có trực tiếp tại nơi giám sát, không đưa token vào chat, Git hoặc log.
2. Dùng dịch vụ giám sát hoặc một máy độc lập **ngoài VPS BigBike**, có khả năng kiểm mỗi 60 giây. Xác nhận gói dịch vụ thực sự hỗ trợ 60 giây trước khi chọn; không mặc định gói miễn phí có tính năng đó. Chọn Telegram làm kênh thông báo và cấu hình token/chat ID trong nơi lưu bí mật của dịch vụ. Cấu hình cả lỗi và khôi phục; dùng nút Test của dịch vụ để kiểm nhóm nhận đủ.
3. Tạo ba HTTPS checks: `https://bigbike.vn/`, một URL sản phẩm thật đang bán (bao gồm variant nếu có), `https://bigbike.vn/google-merchant.xml`. Yêu cầu 200, không redirect/challenge; kiểm nội dung thay vì chỉ trạng thái. Timeout 15s. Đổi URL theo dõi nếu sản phẩm được shop ngừng bán; không dùng SKU hoặc số lượng feed lịch sử làm giá trị cố định.
4. Có thể dùng probe bên dưới qua runner ngoài VPS; probe chỉ xuất JSON và exit code, **không gửi tin**. Runner chịu trách nhiệm gửi Telegram khi exit 1, chống gửi lặp và báo phục hồi. Giữ stderr/token ngoài thông báo. Không coi probe chạy trên chính VPS là theo dõi độc lập.

```bash
python3 scripts/check-storefront-uptime.py \
  --home-url https://bigbike.vn/ --home-marker Bigbike \
  --product-url 'https://bigbike.vn/product/<slug-thật>/?variant=<id-thật>' \
  --product-marker '<SKU-thật>' \
  --feed-url https://bigbike.vn/google-merchant.xml
```

Cấu hình mẫu cho người vận hành (chưa áp dụng; các placeholder phải thay bằng dữ liệu thật):

```yaml
interval_seconds: 60
timeout_seconds: 15
monitor_location: outside_bigbike_vps
checks:
  - name: home
    url: https://bigbike.vn/
    expected_status: 200
    expected_content: Bigbike
  - name: product
    url: 'https://bigbike.vn/product/<slug-thật>/?variant=<id-thật>'
    expected_status: 200
    expected_content: '<SKU-thật>'
  - name: merchant
    url: https://bigbike.vn/google-merchant.xml
    expected_status: 200
    expected_content: '<rss'
notifications:
  channel: telegram
  bot_token: '<lưu trong kho bí mật của dịch vụ>'
  chat_id: '<nhóm dev và anh Trí>'
  notify_failure: true
  notify_recovery: true
```

Ví dụ tin: “BigBike không phản hồi — product — 02:15 GMT+7 — timeout”. Khi phục hồi: “BigBike đã truy cập lại được — product — 02:17 GMT+7”. Không gửi nội dung giỏ/đơn, IP người mua hoặc token.

Nghiệm thu: lưu bằng chứng cấu hình 60s/ba URL/vị trí bên ngoài; cả hai người nhận được tin thử và tin khôi phục. Thử lỗi bằng URL thử riêng của dịch vụ hoặc mock endpoint ngoài production, **không tắt web/backend để thử**. Theo dõi ít nhất một chu kỳ sau khi cấu hình. Không có bằng chứng này thì trạng thái vẫn là chưa hoàn thành.

Căn cứ: `docs/engineering/DEPLOYMENT_GUIDE.md` §GMC đợt 2; `GMC_RULE_007`. Khóa Telegram chỉ nhập trực tiếp tại dịch vụ, không thêm vào `.env` BigBike cho cấu hình ngoài VPS.

## Gói cài đặt đã chuẩn bị 10/11/2026

Owner chọn **chỉ chuẩn bị**, sẽ cung cấp nơi chạy và nhóm nhận sau. Các file dưới đây chưa được cài/bật trên VPS hay máy ngoài:

- `scripts/run-storefront-monitor.py`: gọi probe có sẵn, báo lỗi và khôi phục theo từng URL; chống gửi lặp, thử gửi lại lượt sau nếu Telegram lỗi. Không đổi bot/nơi nhận của đơn hàng và sao lưu.
- `gmc/config.example.json`: ba URL thật, sản phẩm SCS-S13 đã có trong feed. Operator kiểm lại sản phẩm còn công khai khi cài; đổi URL và marker cùng nhau nếu shop ngừng bán.
- `gmc/bigbike-gmc-monitor.service` + `.timer`: Linux/systemd, theo phút đồng hồ, timeout 50s, không có độ trễ ngẫu nhiên. Không dùng lịch GitHub Actions 5 phút để nghiệm thu yêu cầu 60s.

Chuẩn bị gói để chuyển sang máy ngoài (lệnh chỉ tạo archive, không cài):

```bash
tar -czf /tmp/bigbike-gmc-monitor.tar.gz \
  scripts/check-google-merchant.py scripts/check-storefront-uptime.py \
  scripts/run-storefront-monitor.py deploy/monitoring/README-GMC.md \
  deploy/monitoring/gmc
```

**Operator chỉ thực thi phần dưới trên máy độc lập đã xác nhận**, có Python 3.10+ và systemd; cần quyền quản trị máy đó. Không chạy trên VPS BigBike để giả nghiệm thu bên ngoài.

```bash
sudo useradd --system --home-dir /nonexistent --shell /usr/sbin/nologin bigbike-monitor
sudo install -d -m 0755 /opt/bigbike-gmc-monitor
sudo tar -xzf bigbike-gmc-monitor.tar.gz -C /opt/bigbike-gmc-monitor
sudo install -d -m 0750 -o root -g bigbike-monitor /etc/bigbike-gmc-monitor
sudo install -m 0640 -o root -g bigbike-monitor \
  /opt/bigbike-gmc-monitor/deploy/monitoring/gmc/config.example.json \
  /etc/bigbike-gmc-monitor/config.json
sudo install -m 0600 -o bigbike-monitor -g bigbike-monitor /dev/null \
  /etc/bigbike-gmc-monitor/telegram.json
```

Nhập trực tiếp vào `telegram.json` bằng trình soạn thảo/kho bí mật của máy ngoài: object JSON có hai khóa `bot_token`, `chat_id` của **nhóm đã xác nhận có dev và anh Trí**. Không dán token vào dòng lệnh/chat, không copy `.env` của stack, không in file. Dùng lại bot hiện có; nếu cần nhóm riêng thì chỉ đặt chat ID trong file này.

Kiểm đọc ba URL, không gửi tin, không cần secret:

```bash
cd /opt/bigbike-gmc-monitor
python3 scripts/run-storefront-monitor.py \
  --config /etc/bigbike-gmc-monitor/config.json --dry-run
```

Sau khi người phụ trách xác nhận đúng nhóm, operator gửi **hai tin có nhãn THỬ NGHIỆM**; không ngắt production, không đổi trạng thái theo dõi:

```bash
sudo -u bigbike-monitor python3 scripts/run-storefront-monitor.py \
  --config /etc/bigbike-gmc-monitor/config.json --test-event outage
sudo -u bigbike-monitor python3 scripts/run-storefront-monitor.py \
  --config /etc/bigbike-gmc-monitor/config.json --test-event recovery
```

Cả dev và anh Trí xác nhận nhận được hai tin rồi mới cài/bật lịch:

```bash
sudo install -m 0644 deploy/monitoring/gmc/bigbike-gmc-monitor.service /etc/systemd/system/
sudo install -m 0644 deploy/monitoring/gmc/bigbike-gmc-monitor.timer /etc/systemd/system/
sudo systemd-analyze verify /etc/systemd/system/bigbike-gmc-monitor.service /etc/systemd/system/bigbike-gmc-monitor.timer
sudo systemctl daemon-reload
sudo systemctl enable --now bigbike-gmc-monitor.timer
systemctl list-timers bigbike-gmc-monitor.timer
journalctl -u bigbike-gmc-monitor.service --since '5 minutes ago' --no-pager
```

Lưu bằng chứng đã che chat ID/token: nhà cung cấp/máy nằm ngoài VPS, lịch và ít nhất ba dòng `checkedAt` liên tiếp cách khoảng 60s, đủ ba `targets`, cả hai người xác nhận nhận tin thử lỗi/khôi phục. `delivered=true` chỉ chứng minh Telegram API nhận lệnh gửi, chưa chứng minh đúng người đã đọc. Trạng thái lỗi không đổi chỉ gửi một lần; thay nhóm nhận hoặc mất state thì chạy lại hai tin thử. Mã thoát: 0 khỏe/thử thành công, 1 URL lỗi (đã xử lý cảnh báo), 2 lỗi cấu hình/state/gửi Telegram. Cần giám sát trạng thái máy chạy và service failed qua dịch vụ của operator để phát hiện bản thân runner ngừng hoạt động; bot không thể báo khi chính runner mất mạng.

Gói này hoàn tất phần chuẩn bị dev; **chưa nghiệm thu giám sát thật/Telegram**, chưa gửi tin trong phiên 10/11.
