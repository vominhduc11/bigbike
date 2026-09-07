# Sửa chức năng gửi ảnh cho Trợ lý BigBike — 07/09/2026

Nguồn: đợt kiểm định 17 lượt gửi ảnh thật trên hệ thống đang chạy ngày 07/09/2026. Kèm hai quyết
định owner cùng ngày (xử lý chữ "bảo hành" trong lời nhắn, và cách chọn ba mẫu gợi ý cùng nhóm).

Báo cáo giai đoạn 4 (`FEATURE_TRO_LY_BIGBIKE_PHASE_4_2026-08-26.md`) là ảnh chụp hiện trạng lúc đó
và **không bị sửa đè**. Bảng ở mục 4 của báo cáo ấy — dòng "WebP khi runtime không có bộ giải mã
ảnh cục bộ" — nay đã lỗi thời theo mục 2 dưới đây.

## 1. Kết luận cho owner

Tính năng **không nói bừa**, phần đó vẫn nguyên. Nhưng khách gửi ảnh kèm câu hỏi thì câu hỏi bị bỏ
qua hoàn toàn, và bốn trên năm sản phẩm đang bán không bao giờ được gọi đúng tên vì phần mềm không
đọc nổi định dạng ảnh mà chính nó nhận vào.

Cả bốn lỗi đều đã sửa. Còn một việc **dọn dữ liệu** thuộc về shop, không phải việc sửa phần mềm:
81 sản phẩm vẫn để ảnh chính ở kho web cũ, và những sản phẩm đó sẽ vẫn không đối chiếu được.

## 2. Gốc rễ đã xác minh

| Mã | Hiện tượng khách thấy | Gốc rễ | Bằng chứng |
|---|---|---|---|
| B1 | Gửi ảnh kèm "cái mũ này giá bao nhiêu?" → chỉ nhận câu nhận diện, không có chữ nào về giá. Hỏi lại ở lượt sau thì trả lời đúng đủ | Nhánh ảnh trong `ChatService.sendUnlocked` `return` trước khi tới phần tư vấn bằng chữ | 3 lượt đo thật (giá, size, giao hàng); cùng câu hỏi ở lượt kế tiếp trả về giá 6.100.000đ và size L còn hàng |
| B2 | "Em muốn đặt đơn hàng mẫu này ạ" kèm ảnh mũ → bị đẩy sang hướng dẫn tra đơn cũ, mất thẻ sản phẩm và nút mua | `overrideHighRiskIntent` đổi hướng chỉ bằng từ khoá trong lời nhắn, đè lên kết quả nhìn ảnh của model | đo thật; chuỗi `"don hang"` khớp trong lời nhắn |
| B3 | "Mũ này có size nào ạ?" kèm ảnh mũ → trả lời như đang hỏi size đầu, mất thẻ sản phẩm | Cùng gốc B2, chuỗi `"size nao"` | đo thật |
| B4 | 51 sản phẩm không bao giờ được gọi đúng tên; ảnh WebP khách gửi không đối chiếu được; WebP >1.600px bị từ chối trong khi JPG cùng cỡ thì tự thu nhỏ | `pom.xml` không có bộ giải mã WebP nào; `ImageIO.read` trả `null` và mã bỏ qua sản phẩm đó **không log, không đếm** | 172 SP đang bán → 88 có ảnh trong kho shop → chỉ 37 có vân ảnh |
| B5 | Mọi ảnh mũ fullface ra đúng ba mẫu giống hệt nhau, có mẫu 11,5 triệu mời cho ảnh mũ 6,1 triệu | Ba mẫu "cùng nhóm" lấy theo thứ tự chữ cái của slug | 3 ảnh khác nhau, kết quả trùng khít |
| B6 | Hỏi về đơn hàng nhưng nút gợi ý là "Đổi nhu cầu"/"Đổi ngân sách" | Thang điều kiện của bộ chọn nút không có nhánh đơn hàng, rơi xuống nhánh mặc định của việc mua sắm | đo thật |
| B7 | (Không phải lỗi) Trang Chính sách bảo mật bị báo là "không có chữ nào" về trợ lý/ảnh/Google | **Sai tiền đề.** Nội dung đầy đủ nằm trong component render trang, không nằm ở phần thân cũ trong `static-pages.json` mà route không bao giờ dùng | đọc mã route + component |

**Vì sao bộ kiểm thử không bắt được B4:** không có bài kiểm nào dùng ảnh WebP thật, vì Java không
encode được WebP nên không thể tự sinh ảnh trong test như cách các bài kiểm PNG đang làm. Các ca
WebP hiện có chỉ dựng phần đầu tệp bằng tay, tức là chỉ kiểm phần đọc kích thước chứ không kiểm
việc giải mã.

## 3. Đã sửa

| Mã | Cách sửa |
|---|---|
| B1 | Sau câu nhận diện, lượt ảnh chạy tiếp đúng phần tư vấn bằng chữ đang có và trả về **một** tin nhắn ghép. Mẫu vừa nhận ra được nạp làm ngữ cảnh nên "cái mũ này" trỏ đúng. Nối tiếp cả khi không nhận ra mẫu và cả khi đã hết trần ảnh trong ngày |
| B2, B3 | Mục đích ảnh do chính tấm ảnh quyết định. Lời nhắn không còn chọn được hướng "tra đơn" hay "từ chối đoán size"; hai hướng đó chỉ mở khi model nhìn ảnh nói ảnh đúng là hoá đơn hoặc đúng là ảnh đầu/người. Lời báo hư hỏng rõ ràng vẫn nâng lên luồng hàng hỏng (owner decision 2026-09-07); chữ "bảo hành" đứng một mình thì không |
| B4 | Backend mang theo bộ giải mã WebP thuần Java. Cùng một đường giải mã dùng cho ảnh khách, ảnh catalog và ảnh quản trị, nên không còn cảnh một định dạng nằm trong danh sách cho phép mà lại không đọc được |
| B5 | Ba mẫu xếp theo mức độ giống tấm ảnh trước (điểm số vốn đã tính sẵn khi đi tìm mẫu khớp, không tốn thêm gì), thiếu thì bù bằng ưu tiên của shop — dùng lại đúng thứ tự đã có sẵn cho phần hỏi lại: mẫu ghim trang chủ trước, rồi mẫu gần tầm giá trung vị của nhóm |
| B6 | Thêm nhánh đơn hàng vào bộ chọn nút; nhánh mặc định khi không có thẻ sản phẩm nào nay là "Tìm sản phẩm" thay vì đổi nhu cầu/ngân sách |
| B7 | Chỉ sửa **một câu đã lỗi thời**: trang vẫn nói "trước khi chọn ảnh, khung chat sẽ nhắc rõ cách ảnh được xử lý", trong khi dòng công bố đó đã gỡ khỏi khung chat ngày 06/09. Bổ sung ý khách tự xoá được bằng nút xoá cuộc trò chuyện |

## 4. Ba bẫy đã đo được khi làm, ghi lại để khỏi vấp lại

1. **Bộ đọc WebP từ chối ảnh giãn quá 2048:1.** Ảnh WebP một màu trơn cỡ lớn (vài chục byte → vài
   MB thô) bị coi là ảnh bom và không giải mã. Ảnh thật không dính, nhưng **fixture test bắt buộc
   phải là ảnh nhiễu**; fixture một màu sẽ làm bài kiểm đo nhầm thứ khác.
2. **Thời gian chờ.** Câu trả lời đi qua đường phát trực tiếp chỉ chờ 75 giây, trong khi một lượt
   nay gồm hai chặng gọi nhà cung cấp, mỗi chặng tự cho mình 65 giây. Hai chặng nay chia chung một
   ngân sách thời gian; hết giờ thì trả riêng câu nhận diện ảnh chứ không để cả lượt hỏng.
3. **Cú sốc lượt đầu sau khi triển khai.** Chỉ mục vân ảnh dựng ngay trong lượt của khách. Ngay sau
   khi lên bản mới, 51 ảnh WebP lần đầu đọc được sẽ dồn vào lượt của **một** khách. Đã đặt trần 15
   vân ảnh dựng mới mỗi lượt; chỉ mục tự đầy sau vài lượt.

## 5. Lệch tài liệu đã sửa nhân tiện

`API_CONTRACT.md` mô tả hai endpoint quản trị `product-image-index` và `product-image-index/rebuild`
**chưa từng tồn tại trong mã** — không controller, không service, không màn hình. Đã đánh dấu
`NOT_FOUND_IN_REPO` thay vì gỡ hẳn, để lần sau ai đọc còn biết là đã kiểm.

Cũng vá luôn hai lỗi cũ lộ ra khi làm:

- Nhánh "trợ lý tạm không dùng được" là nhánh **duy nhất** không lưu lại hội thoại, nên số lượt và
  lý do kết thúc mà nó vừa đặt đều bị mất trắng.
- Phần tạo ảnh thu nhỏ cho kho ảnh quản trị: khi ảnh gốc là WebP, bản thu nhỏ **không nhỏ hơn** bản
  gốc (không ghi được WebP, đổi sang PNG thì phình ra), nên hệ thống giữ lại đúng bản gốc — nhưng
  vẫn định lưu nó dưới tên `.png`. Trước đây không ai gặp vì WebP còn chưa đọc được nên nhánh này
  không bao giờ chạy tới. Nay bỏ qua hẳn bản thu nhỏ đó, vì nó chỉ là bản gốc chép lại.

## 6. Việc owner cần tự làm sau

**Dọn dữ liệu, không phải sửa phần mềm:** 81 sản phẩm còn để ảnh chính trỏ về kho web cũ
(`media.bigbike.vn/wp-uploads`). Những sản phẩm này **vẫn sẽ không** đối chiếu ảnh được sau bản
sửa, vì phần đối chiếu chỉ đọc ảnh nằm trong kho ảnh của shop. Việc này cũng đang vi phạm quy định
"ảnh do quản trị quản lý phải nằm trong kho ảnh của shop". Cần một đợt kéo 81 ảnh đó về kho shop.

**Kiểm chứng trên máy chủ thật — mỗi lần thử ăn 1 trong 20 lượt đọc ảnh mỗi ngày** (ngày 07/09 đã
dùng 17/20, nên nếu thử trong ngày thì chỉ còn 3 lượt):

1. Gửi **một** ảnh mũ đang bán kèm câu "Cái mũ này giá bao nhiêu vậy shop?" → phải thấy **cả** câu
   "trông giống mẫu…" **và** giá trong cùng một câu trả lời.
2. Gửi **một** ảnh WebP của mẫu đang bán → phải gọi đúng tên mẫu.
3. Đếm số sản phẩm đã có vân ảnh (chỉ đọc, không ghi):
   `SELECT count(*) FROM chat_product_image_fingerprints;` — trước bản sửa khoảng 37, kỳ vọng tiến
   dần tới khoảng 88 sau vài lượt gửi ảnh (chỉ mục dựng dần, tối đa 15 mẫu mới mỗi lượt).

## 7. Tài liệu đã cập nhật

`BUSINESS_RULES.md` (`CHAT_RULE_058`), `WORKFLOW_OVERVIEW.md` (bước 5a), `STATE_MACHINES.md` (§15C),
`API_CONTRACT.md`, `API_FLOW_MAP.md`, `INTEGRATION_GUIDE.md`, `TESTING_GUIDE.md`.
