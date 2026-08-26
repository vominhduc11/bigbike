# Báo cáo giai đoạn 2 — Trợ lý BigBike bán hàng chuyên nghiệp

Ngày hoàn tất: **24/08/2026**.

Căn cứ chuẩn của lần sửa là `docs/business/BUSINESS_RULES.md`, đặc biệt
`CHAT_RULE_037`–`CHAT_RULE_044`, và bảng nghiệm thu trong
`docs/business/ACCEPTANCE_CRITERIA.md`. Báo cáo này mô tả phần đã làm; tài liệu chuẩn vẫn là
nguồn quyết định khi có khác biệt.

## 1. Trợ lý nay cư xử khác trước ra sao

Trước đây trợ lý chủ yếu tìm thông tin rồi dừng. Nay mỗi lượt xác định khách đang dạo xem,
đang chọn, sắp quyết hay hỏi việc sau mua; xử lý đúng nỗi lo đang cản khách; và kết bằng đúng
một bước tiếp theo phù hợp. Các bước phân loại, bán kèm, mời liên hệ, làm sạch dữ liệu và đo
lường đều chạy trong hệ thống, không tạo thêm lượt gọi AI tính phí.

Các đoạn dưới dùng **Mẫu A/Mẫu B làm ký hiệu minh hoạ**, không phải tên hoặc dữ kiện sản phẩm
thật.

### Từ hỏi vu vơ tới chốt mua

**Trước**

> Khách: Shop có mũ gì?
>
> Trợ lý: Shop có nhiều mẫu mũ bảo hiểm. Anh/chị cần gì thêm không ạ?

**Sau**

> Khách: Shop có mũ gì?
>
> Trợ lý: Anh/chị dùng đi phố hằng ngày, đi đường dài hay cần loại nào khác ạ?
>
> Khách: Đi phố hằng ngày, dưới 2 triệu.
>
> Trợ lý: Em đã khoanh các mẫu còn hàng đúng nhóm và tầm giá. Anh/chị ưu tiên nhẹ hay che chắn
> hơn để em loại bớt một mẫu?
>
> Khách: Ưu tiên nhẹ, em chọn giúp.
>
> Trợ lý: Em chọn Mẫu A vì thông số đã lưu phù hợp hơn với ưu tiên nhẹ. Anh/chị chọn size để em
> kiểm tra đúng phiên bản.
>
> Khách: Size M còn thì lấy mẫu này.
>
> Trợ lý: Size M đang hiển thị còn hàng. Anh/chị thêm Mẫu A vào giỏ để tiếp tục đặt hàng.

### Phân vân giữa hai mẫu

**Trước**

> Khách: Mẫu A với Mẫu B nên chọn cái nào?
>
> Trợ lý: Cả hai đều tốt. Shop còn có Mẫu C anh/chị tham khảo thêm.

**Sau**

> Trợ lý: Em chỉ đối chiếu Mẫu A và Mẫu B theo dữ liệu đã lưu; không chen mẫu thứ ba. Anh/chị
> chọn một ưu tiên quan trọng nhất để em chốt giúp mẫu phù hợp hơn.

### Thiếu bảng size

**Trước**

> Khách: Size M có vừa vòng đầu 58 cm không?
>
> Trợ lý: Size M thường vừa 58 cm ạ.

**Sau**

> Trợ lý: Shop chưa có hướng dẫn size theo số đo của mẫu này, nên em không đoán và không lấy
> bảng size của sản phẩm khác. Anh/chị chỉ để lại số nếu muốn nhân viên đo và tư vấn đúng mẫu
> này.

### Khách xin gặp nhân viên

**Trước**

> Trợ lý: Anh/chị vui lòng liên hệ hotline.
>
> Hội thoại kết thúc; nhân viên không được báo.

**Sau**

> Trợ lý: Em đã báo nhân viên; trong lúc chờ, anh/chị vẫn có thể hỏi em tiếp.
>
> Màn quản trị nhận hàng chờ ngay, hiện khách đã chờ bao lâu; email được gửi sau khi hàng chờ
> đã lưu thành công.

## 2. Cách xác định món bán kèm

Phương án chọn là **owner khai phụ kiện trực tiếp trong sản phẩm**, dùng quan hệ
`accessoryProducts` đã có trên màn quản trị sản phẩm. Không suy từ tên, model hoặc cặp danh mục.

Lý do chọn:

- Quan hệ do người bán xác nhận nên có thể kiểm tra, sửa và chịu trách nhiệm được.
- Một cặp nhóm rộng như “mũ ↔ tai nghe” chưa đủ chứng minh từng tai nghe tương thích từng mũ.
- Không cần tạo bảng suy đoán riêng và không làm thay đổi dữ liệu danh mục hiện có.
- Trợ lý giữ đúng thứ tự owner khai, chỉ lấy sản phẩm đã công bố, chưa ngừng bán, còn hàng, có
  giá hợp lệ và tối đa hai món.

Trợ lý chỉ gợi sau khi khách đã nghiêng rõ hoặc chốt món chính. Quan hệ trống, món kèm hết hàng
hoặc khách còn phân vân thì không gợi. Theo số liệu vận hành owner cung cấp, hiện **0/177 sản
phẩm có phụ kiện đi kèm**, nên sau triển khai trợ lý sẽ chủ động im lặng cho tới khi shop khai
dữ liệu đáng tin.

## 3. Báo nhân viên khi khách xin gặp

Hệ thống dùng ba lớp cùng lúc:

1. **Hàng chờ bền vững** trong màn **Quản trị → Hội thoại** (`/admin/chat`). Tải lại trang hoặc
   mất kết nối tạm thời không làm mất yêu cầu.
2. **Thông báo thời gian thực** trên màn quản trị để nhân viên đang mở trang thấy ngay.
3. **Email** mặc định bật, chỉ gửi sau khi hàng chờ đã lưu thành công. Mail lỗi không làm mất
   hàng chờ.

Thông báo có câu hỏi gần nhất, các mẫu đã xem, khách đăng nhập hay khách lạ và cờ cho biết khách
đã chủ động để lại liên hệ hay chưa. Số điện thoại/email nằm trong câu hỏi được che khỏi tóm tắt;
không phát thông tin liên hệ khi chưa có consent.

Owner đổi cấu hình tại **Quản trị → Cài đặt → Trợ lý BigBike**:

- `Gửi email khi khách xin gặp nhân viên`: bật/tắt riêng email; hàng chờ quản trị vẫn luôn chạy.
- `Email nhận yêu cầu gặp nhân viên`: nhập một địa chỉ nhận. Để trống thì dùng
  `BIGBIKE_MAIL_ADMIN` trên máy chủ.

Nhân viên cần quyền `chat.read` để xem và `chat.handle` để bấm **Đã tiếp nhận**. Chỉ thao tác này
mới xoá khách khỏi danh sách chờ, đồng thời lưu người nhận và thời điểm nhận.

## 4. Vì sao trước đây không ghi nhận đơn đến từ chat

Trước đây hệ thống biết khách bấm thẻ sản phẩm trong chat nhưng không mang một bằng chứng nguồn
bền vững qua trang sản phẩm, giỏ hàng và checkout. Khi đơn được tạo, dòng hàng không còn đủ dữ
kiện nối ngược về đúng hội thoại; vì vậy bảng “đơn đến từ chat” không có hàng để ghi.

Cơ chế mới:

1. Khi khách bấm từ thẻ chat sang sản phẩm, máy chủ ghi lượt xem và phát một dấu nguồn đã ký,
   không chứa thông tin cá nhân.
2. Dấu nguồn chỉ đúng cho sản phẩm, tài khoản nếu có và trong **168 giờ**.
3. Khi thêm sản phẩm hoặc sản phẩm đã có trong giỏ, máy chủ gắn **lần chạm hợp lệ gần nhất** vào
   đúng dòng hàng. Khi gộp giỏ khách lạ với giỏ đăng nhập, bộ ba hội thoại–tương tác–thời điểm
   luôn được thay cùng nhau, không trộn nguồn cũ với giờ mới.
4. Checkout kiểm tra lại sản phẩm, quyền sở hữu và cửa sổ 7 ngày, rồi ghi tối đa một dòng nguồn
   cho mỗi dòng đơn cùng doanh thu thực của dòng đó. Gửi lại cùng thao tác không ghi trùng.
5. Phễu quản trị dùng nhóm hội thoại **bắt đầu trong kỳ**: hội thoại → xem sản phẩm → thêm giỏ →
   đơn → doanh thu. Kỳ chưa qua đủ 7 ngày được đánh dấu chưa hoàn tất để owner không đọc nhầm
   đơn còn có thể phát sinh.

## 5. Bảng nghiệm thu

| # | Ca nghiệm thu | Kết quả |
|---:|---|---|
| 1 | Hỏi chung: hỏi nhu cầu, không chào hàng | Đạt |
| 2 | So sánh hai mẫu: không đưa mẫu thứ ba | Đạt |
| 3 | Hỏi size M còn không: không mở mẫu mới | Đạt |
| 4 | Hỏi đơn đã mua: xử lý đơn, không bán thêm | Đạt |
| 5 | Chê đắt: đưa mẫu cùng nhu cầu rẻ hơn và nêu đánh đổi | Đạt |
| 6 | Thiếu hướng dẫn size: nói thiếu, không đoán, mời hỗ trợ đúng lý do | Đạt |
| 7 | Lo chính hãng: chỉ dẫn chính sách bảo hành đã công bố | Đạt |
| 8 | Chốt mũ: tối đa hai phụ kiện còn hàng được owner khai | Đạt |
| 9 | Còn phân vân: không bán kèm | Đạt |
| 10 | Không có quan hệ phụ kiện đáng tin: không gợi | Đạt |
| 11 | Mỗi lượt có một bước tiếp theo, thay đổi theo tình huống | Đạt |
| 12 | Khách muốn xem thêm: không lặp đề nghị vừa từ chối | Đạt |
| 13 | Hỏi size mẫu cụ thể: được mời liên hệ với lý do thật | Đạt |
| 14 | Vừa chào hỏi: không mời liên hệ | Đạt |
| 15 | Khách đăng nhập: không hỏi nhập lại số điện thoại | Đạt |
| 16 | Đã từ chối: không hỏi lại; tối đa hai lời mời | Đạt |
| 17 | Xin gặp nhân viên: lưu hàng chờ và phát thông báo đủ ngữ cảnh | Đạt offline; SMTP thật cần smoke test |
| 18 | Sau khi báo nhân viên, khách vẫn hỏi trợ lý tiếp được | Đạt |
| 19 | Quản trị thấy khách chờ và thời gian chờ | Đạt |
| 20 | Bấm sản phẩm từ chat rồi đặt trong 7 ngày: đơn được ghi nguồn | Đạt |
| 21 | Quản trị có đủ phễu và doanh thu | Đạt |
| 22 | Quản trị có danh sách câu hỏi trợ lý bó tay | Đạt |
| 23 | Không tự hứa giảm giá, ngày giao hay khan hiếm | Đạt |
| 24 | Không bịa đánh giá hoặc số lượng bán | Đạt |
| 25 | Mã màu/model thô không lọt ra chat | Đạt |
| 26 | Các luồng làm rõ nhiều vòng của giai đoạn 1 vẫn hoạt động | Đạt |

Bằng chứng kiểm thử chính:

- Backend chat, handoff, giỏ, checkout và regression giai đoạn 1: **179/179 đạt** sau lần sửa
  cuối; không gọi nhà cung cấp AI thật.
- Migration V1051–V1052 trên PostgreSQL 16 tạm: **đạt**.
- Website khách: lint đạt, **502/502 unit test đạt**, production build đạt.
- Trang quản trị: lint và production build đạt; nhóm test chat/API mới đạt.
- Playwright luồng handoff dùng API giả lập: đạt trên khung chat, không tiêu lượt AI thật.
- OpenAPI, kiểm tra khoảng trắng, encoding tiếng Việt và guard dữ liệu cứng: đạt.

## 6. Dữ liệu sản phẩm owner cần bổ sung

Đây là số liệu owner đo ngày 24/08/2026; không phải số đếm lại từ máy phát triển.

| Ưu tiên | Thiếu dữ liệu | Quy mô đã đo | Ảnh hưởng |
|---:|---|---:|---|
| 1 | Hướng dẫn size đúng sản phẩm | 131/177 sản phẩm (74%) | Chặn quyết định mua; trợ lý buộc phải nói thiếu và chuyển nhân viên |
| 2 | Thông số kỹ thuật | 119/177 sản phẩm (67%) | Khó so sánh, giải thích đánh đổi và chốt mẫu phù hợp |
| 3 | Tên màu/model dễ đọc | 166/2.256 giá trị còn là mã | Mã bị ẩn khỏi khách, nên một số lựa chọn có thể không hiện trong chat |
| 4 | Phụ kiện đi kèm do owner xác nhận | 0/177 sản phẩm; chỉ một dòng “liên quan” không dùng thay phụ kiện | Trợ lý chưa có nguyên liệu bán kèm an toàn |
| 5 | Đánh giá khách đã xác minh | 0/177 sản phẩm | Trợ lý không được dùng đánh giá hoặc social proof để thuyết phục |

Sau triển khai, màn **Quản trị → Hội thoại → Dữ liệu sản phẩm còn thiếu** tự liệt kê đúng tên
từng sản phẩm đang bán, các loại thiếu và mã thô cần sửa, xếp size trước thông số, mã thô rồi
phụ kiện. Máy phát triển không có dữ liệu vận hành thật nên báo cáo này không bịa danh sách tên
sản phẩm. Owner nên xử lý từ đầu bảng xuống và khai phụ kiện trong màn sửa từng sản phẩm.

## 7. Phần chưa làm được và lý do

- **Not run: triển khai máy chủ thật.** Đây là giới hạn phạm vi do owner đặt.
- **Not run: gửi email qua SMTP thật.** Máy local không có hộp thư/credential vận hành; đường
  gửi đã được kiểm bằng mock và lỗi mail không làm mất hàng chờ.
- **Not run: gọi hàng loạt trợ lý thật.** Tránh tiêu lượt AI của shop; mọi ca nghiệp vụ dùng
  fast-path, mock hoặc fixture offline.
- **Not run: đơn thật và dữ liệu khách thật.** Không truy cập hội thoại, đơn hoặc liên hệ thật.
- **Not run: chạy lại toàn bộ backend lần thứ hai sau các sửa cuối.** Lần chạy toàn bộ trước đó
  có 1.248 test, 3 failure và 14 error; năm lỗi trong phạm vi chat/schema đã được sửa và nhóm
  liên quan chạy lại 179/179. Các lỗi còn lại nằm ở cấu hình test chung, Testcontainers/image
  hoặc test sản phẩm/review ngoài phạm vi giai đoạn 2.
- Bộ test quản trị toàn repo còn 5 test cũ không đạt: hai lệch schema sản phẩm và ba timeout giao
  diện cũ; 989/994 test đạt. Các file chat mới không nằm trong nhóm lỗi này.

## 8. Việc owner cần tự chạy sau

### Trước khi triển khai

Kiểm tra `.env` có SMTP và email nhận đúng; tối thiểu:

```bash
grep -E '^(BIGBIKE_MAIL_HOST|BIGBIKE_MAIL_FROM|BIGBIKE_MAIL_ADMIN)=' .env
```

Sao lưu cơ sở dữ liệu:

```bash
sudo install -d -m 700 /var/backups/bigbike
docker compose exec -T postgres sh -lc 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | sudo tee /var/backups/bigbike/before-assistant-phase2-2026-08-24.sql >/dev/null
sudo chmod 600 /var/backups/bigbike/before-assistant-phase2-2026-08-24.sql
```

Không đặt hoặc commit file dump vào repository vì có thể chứa dữ liệu khách hàng.

### Triển khai ba dịch vụ

```bash
git pull
docker compose build bigbike-backend bigbike-web bigbike-admin
docker compose up -d bigbike-backend bigbike-web bigbike-admin
docker compose ps
docker compose logs --since=10m bigbike-backend
```

Kiểm tra dịch vụ:

```bash
curl -fsS http://127.0.0.1:8080/actuator/health
curl -fsSI http://127.0.0.1:3000/vi
curl -fsSI http://127.0.0.1:4000/
```

### Smoke test trên hệ thống thật

1. Dùng một phiên khách lạ thử **Gặp nhân viên**; xác nhận email đến, hàng chờ xuất hiện ngay,
   đồng hồ chờ tăng và chỉ mất sau khi bấm **Đã tiếp nhận**.
2. Trong lúc chờ, gửi thêm một câu và xác nhận trợ lý vẫn trả lời.
3. Từ một thẻ sản phẩm trong chat, mở sản phẩm, thêm giỏ và đặt một đơn thử theo quy trình vận
   hành được phép; kiểm tra phễu và bảng đơn từ chat có đúng một dòng/doanh thu đúng dòng hàng.
4. Đăng nhập tài khoản thử do owner quản lý; hỏi đơn của mình và hỏi size, xác nhận trợ lý chỉ
   đọc đơn tài khoản đó và không bắt nhập lại số.
5. Mở **Quản trị → Hội thoại → Dữ liệu sản phẩm còn thiếu**, xuất danh sách công việc rồi bổ
   sung size, thông số, nhãn màu/model và phụ kiện theo thứ tự ưu tiên ở mục 6.
