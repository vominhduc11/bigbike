# Báo cáo giai đoạn 4 — nâng model và đọc ảnh cho Trợ lý BigBike

Ngày hoàn tất mã nguồn và kiểm thử offline: **26/08/2026**.

Căn cứ chuẩn là `docs/business/BUSINESS_RULES.md` (`CHAT_RULE_053`–`CHAT_RULE_059`),
`docs/business/ACCEPTANCE_CRITERIA.md` và các hợp đồng kỹ thuật tương ứng trong `docs/engineering/`.
Lần làm này **không triển khai lên VPS, không chạy benchmark trả phí, không đọc hội thoại/ảnh khách
thật và không thay đổi dữ liệu sản phẩm**. `.env` chỉ dành cho local; mọi hướng dẫn VPS ở cuối báo
cáo dùng riêng `.env.vps`.

## 1. Bảng so sánh các model Gemini

Một lần đọc danh sách model của tài khoản shop đã được thực hiện ngày 26/08/2026 bằng API
`models.list`; khóa bí mật không được in ra. Giao giữa danh sách live và các model ổn định có bảng
giá đã kiểm chứng gồm tám lựa chọn dưới đây. Sau triển khai, màn Cài đặt sẽ tự kiểm tra lại nên model
Google vừa rút quyền sẽ không còn bật được.

Giá là USD trên một triệu token ở standard tier, theo
[bảng giá Gemini chính thức](https://ai.google.dev/gemini-api/docs/pricing). Nhãn nhanh/chậm là mô
tả dự kiến theo dòng model, **không phải số đo của BigBike**.

| Model dùng được ngày 26/08 | Tốc độ dự kiến | Mức giá | Input / output (USD/1M token) | Ghi chú |
|---|---|---|---:|---|
| Gemini 2.5 Flash-Lite | Nhanh nhất | Rẻ nhất | 0,10 / 0,40 | Nên làm model lùi nhanh |
| Gemini 3.1 Flash-Lite | Rất nhanh | Thấp | 0,25 / 1,50 | Ứng viên tiết kiệm |
| Gemini 3.5 Flash-Lite | Rất nhanh | Vừa | 0,30 / 2,50 | Phù hợp lưu lượng lớn |
| Gemini 2.5 Flash | Nhanh, cân bằng | Vừa | 0,30 / 2,50 | Cấu hình VPS hiện tại; mốc so sánh |
| Gemini 3.6 Flash | Cân bằng | Cao | 0,75 / 3,75 đến 31/12/2026; sau đó 1,50 / 7,50 | Cần benchmark trước khi bật |
| Gemini 3.7 Flash | Cân bằng, dự kiến mạnh hơn | Cao | 0,75 / 3,75 đến 31/12/2026; sau đó 1,50 / 7,50 | Ứng viên nâng chất lượng chính |
| Gemini 3.5 Flash | Cân bằng, có thể chậm hơn Lite | Đắt | 1,50 / 9,00 | Cần chứng minh lợi ích rõ |
| Gemini 2.5 Pro | Chậm hơn | Đắt nhất nhóm | 1,25 / 10,00 | Không khuyến nghị cho chat thời gian thực trước khi đo |

Bảng kết quả bắt buộc hiện chưa có số thật, vì owner chưa cho chạy lượt AI trả phí và bộ 141 hội
thoại chưa được owner làm sạch/kiểm chứng đáp án. Không dùng giá niêm yết để giả làm chi phí mỗi
lượt và không dùng AI tự chấm AI.

| Model | Đúng số liệu | Hiểu đúng ý | Không bịa | Tỷ lệ chịu thua | p50 / p95 | Chi phí thật/lượt |
|---|---|---|---|---|---|---|
| Gemini 2.5 Flash-Lite | Not run | Not run | Not run | Not run | Not run | Not run |
| Gemini 3.1 Flash-Lite | Not run | Not run | Not run | Not run | Not run | Not run |
| Gemini 3.5 Flash-Lite | Not run | Not run | Not run | Not run | Not run | Not run |
| Gemini 2.5 Flash | Not run | Not run | Not run | Not run | Not run | Not run |
| Gemini 3.6 Flash | Not run | Not run | Not run | Not run | Not run | Not run |
| Gemini 3.7 Flash | Not run | Not run | Not run | Not run | Not run | Not run |
| Gemini 3.5 Flash | Not run | Not run | Not run | Not run | Not run | Not run |
| Gemini 2.5 Pro | Not run | Not run | Not run | Not run | Not run | Not run |

**Khuyến nghị hiện tại: giữ Gemini 2.5 Flash cho khách và dùng Gemini 2.5 Flash-Lite làm bản lùi.**
Đây là lựa chọn an toàn vì 2.5 Flash là mốc đang vận hành, còn chưa có bằng chứng định lượng để
đánh đổi tốc độ/tiền lấy model khác. Khi bộ câu thật đã được owner xác minh, nên so 2.5 Flash với
3.7 Flash trước; chỉ đổi toàn bộ khách sang 3.7 Flash nếu nó thắng rõ về đúng ý/không bịa/chịu thua
mà p95 và tiền vẫn chấp nhận được. Không chia đôi khách thật.

## 2. Ước tính chi phí tháng cho model khuyến nghị

Chưa có token thực tế nên đây là **khoảng dự trù, không phải số đã đo**. Tính bảo thủ theo mức cao
nhất owner cung cấp là 36 lượt/ngày, 30 ngày/tháng:

- Mức nhẹ: 4.000 token input + 500 token output/thinking mỗi lượt → khoảng **0,00245 USD/lượt**.
- Mức nặng: 12.000 token input + 1.000 token output/thinking mỗi lượt → khoảng **0,00610
  USD/lượt**.

| Lưu lượng | Số lượt/tháng dùng để tính | Dự trù Gemini 2.5 Flash |
|---|---:|---:|
| Mức hiện tại bảo thủ | 1.080 | **2,65–6,59 USD/tháng** |
| Gấp 5 lần | 5.400 | **13,23–32,94 USD/tháng** |

Khoảng trên chưa cộng ảnh. Ở mức gấp 5 lần, đầu trên vượt ngưỡng cảnh báo 25 USD; owner nên dùng
số thực trên dashboard trước khi đổi ngưỡng. Sau triển khai, ledger sẽ tính theo đúng model và từng
lần primary/fallback, hiện hôm nay, tháng này và trung bình trên hội thoại có phát sinh AI.

## 3. Cách chạy lại bộ đề khi có model mới

Hệ thống đã có bộ `phase4-acceptance-v1` gồm **14 câu mẫu đã kiểm chứng**, đủ các nhóm giá, loại,
thương hiệu, chi tiết sản phẩm, size, chính sách, đơn hàng, câu mơ hồ, ngoài phạm vi và tiếng Anh;
registry riêng chứa **85 ca tự động của giai đoạn 1–4**. Hiện có **0 câu hội thoại thật đã được
owner xác minh**, nên không được trình bày 14 câu mẫu như thể lấy từ 141 hội thoại.

Quy trình về sau:

1. Vào **Quản trị → Cài đặt → Trợ lý BigBike**, bấm kiểm tra lại danh sách model.
2. Nếu model mới hiện nhưng bị khóa vì chưa có giá, cần cập nhật bảng giá có ngày hiệu lực trong mã
   nguồn trước; hệ thống không tự đoán giá từ tên model.
3. Người có cả `chat.read` và `settings.write` tải bản nháp câu hỏi thật đã che PII. Owner vẫn phải
   kiểm tra bằng mắt, loại tên/số/email/địa chỉ/mã đơn còn sót và điền đáp án đúng từ snapshot dữ
   liệu shop. Câu nháp không chạy và không được cộng vào số ca.
4. Developer kiểm tra bản đã xác minh vào phiên bản dataset mới với trạng thái
   `VERIFIED_BY_OWNER`. Hiện chưa có chức năng upload dataset từ giao diện.
5. Chọn 2.5 Flash và model ứng viên, đặt trần tối đa 2 USD, xác nhận rõ rồi chạy. Runner đi từng câu
   qua đủ model trước khi sang câu tiếp theo để chạm trần tiền vẫn so cùng số ca.
6. Xem bảng cạnh nhau; chỉ lưu model mới khi các ca quan trọng đạt và regression giai đoạn 1–4 đạt.
7. Theo dõi toàn bộ khách trong 14 ngày: tỷ lệ chịu thua so với mốc **5/58 ≈ 9%**, p50/p95,
   fallback và tiền. Tệ hơn thì chọn lại model cũ bằng một lần lưu.

Run đánh giá không tạo hội thoại/lead/handoff và không dùng trần 400 lượt khách, nhưng vẫn là lời
gọi Gemini có tính phí nên lần chạy thật phải do owner chủ động xác nhận.

## 4. Phần đọc ảnh làm được tới đâu

Ảnh mặc định tắt. Khi bật, AI chỉ phân loại mục đích/nhóm hàng; việc gắn một mẫu cụ thể dùng dấu
vân tay ảnh chính của hàng đang bán trong MinIO và được kiểm tra lại trạng thái bán. Tên model hoặc
chữ AI nhìn thấy trên ảnh không đủ làm bằng chứng.

| Loại ảnh | Mức hiện tại | Hành vi an toàn |
|---|---|---|
| Đúng ảnh chính trong catalog, hoặc bản thu nhỏ giữ nguyên bố cục | Tốt nhất | Chỉ nói “trông giống/looks similar”, đưa card sản phẩm thật |
| Cùng nhóm nhưng không qua ngưỡng/margin | Có thể nhận nhóm | Đưa tối đa ba mẫu cùng nhóm để khách tự đối chiếu |
| Ảnh chụp góc khác, crop mạnh, nền rối, thiếu sáng hoặc nhiều mẫu gần giống | Kém/chưa hiệu chỉnh ảnh thật | Không chọn đại một mẫu; nói chưa nhận ra hoặc chỉ nêu nhóm |
| WebP khi runtime không có bộ giải mã ảnh cục bộ | Không đủ để match mẫu cụ thể | Vẫn có thể phân loại nhóm bằng Gemini; không biến tên AI đoán thành match |
| Hỏng/lỗi, hóa đơn/đơn, đầu/người hỏi size, ngoài phạm vi, unsafe | Xử lý theo mục đích | Chuyển nhân viên; không phán bảo hành/OCR/đoán size; từ chối hoặc xóa ảnh unsafe |

Ví dụ tự động đã chạy: fixture mũ `mu-tanami` khớp khi dùng đúng bytes và khi thu nhỏ cùng bố cục;
đổi sang màu/hình khác thì bị loại, một ảnh gắn hai sản phẩm thì không chọn một sản phẩm tùy tiện.

Ví dụ bằng ảnh catalog thật, chạy read-only và không gọi AI: ảnh chính 1.000×1.000 của **Mũ bảo
hiểm 3/4 LS2 OF626** được thu xuống 500×500 rồi so với chính mẫu đó, một ảnh găng và một ảnh túi.
Mẫu OF626 đạt tổng **0,9898** (hình 0,9844; màu 0,9930; tỷ lệ 1,0000), trong khi hai ảnh nhiễu đạt
0,8750 và 0,8170; đủ ngưỡng và khoảng cách an toàn của matcher. Đây chỉ chứng minh ảnh giữ nguyên
bố cục, **không chứng minh ảnh chụp bằng điện thoại ở góc/nền khác** và không phải benchmark toàn
bộ kho. Owner vẫn cần dùng ảnh thử không có người/PII để hiệu chỉnh trước khi bật cho khách.

## 5. Chi phí ảnh và trần đề xuất

Theo [cách Gemini tính token ảnh](https://ai.google.dev/gemini-api/docs/tokens), ảnh nhỏ tối đa
384×384 dùng 258 token; ảnh lớn được chia ô 768×768, mỗi ô 258 token. Ảnh BigBike sau làm sạch
không vượt 1.600×1.600 nên tối đa khoảng 9 ô = 2.322 token ảnh.

Với Gemini 2.5 Flash:

- riêng phần pixel khoảng **0,000077–0,000697 USD/ảnh**;
- output tối đa 512 token khoảng **0,00128 USD**, chưa tính prompt/catalog, thinking và fallback;
- ngân sách vận hành nên dự trù **0,003 USD/ảnh bình thường**, hoặc **0,006 USD/ảnh** nếu phải
  gọi thêm fallback. Đây là mức dự phòng, dashboard mới là số thực.

Giữ trần đã triển khai là **20 ảnh/ngày**. Theo mức dự phòng cao 0,006 USD, trần này tương đương
tối đa khoảng **0,12 USD/ngày, 3,60 USD/30 ngày**. Một lượt một ảnh, một hội thoại tối đa ba ảnh,
JPG/PNG/WebP tối đa 8 MB. Hết trần ảnh vẫn chat chữ bình thường.

## 6. Chính sách quyền riêng tư đã cập nhật

Website VI/EN và disclosure cạnh nút ảnh nay nói rõ:

- ảnh được gửi tới Google Gemini chỉ để nhận diện mục đích/nhóm hàng;
- ảnh được làm sạch tên file và metadata EXIF/GPS, rồi lưu ở bucket MinIO riêng không public;
- chỉ khách sở hữu hội thoại và nhân viên có `chat.read` xem được qua backend; không dùng link
  public/presigned token;
- ảnh hết hạn cùng hội thoại sau tối đa 90 ngày; xóa lịch sử phải xóa object trước khi báo thành
  công, lỗi kho ảnh được job thử lại; upload bỏ dở quá một giờ cũng được dọn;
- nội dung unsafe bị ẩn ngay và object được xóa; khách được nhắc che dữ liệu giấy tờ không cần
  thiết trước khi gửi.

Tắt tính năng không làm lộ hoặc tự xóa ảnh cũ; retention/xóa lịch sử vẫn tiếp tục áp dụng.

## 7. Bảng nghiệm thu

| # | Ca | Kết quả |
|---:|---|---|
| 1 | Đổi model trong Cài đặt có hiệu lực lượt kế tiếp | Đạt tự động |
| 2 | Danh sách live đúng account, có nhãn tốc độ/giá | Đạt cơ chế + đã kiểm tra live 26/08 |
| 3 | Model chat độc lập model kiểm duyệt review | Đạt tự động |
| 4 | Dataset versioned, ngoài customer quota, lưu kết quả | Đạt cơ chế; chưa đạt phần câu thật đã kiểm chứng |
| 5 | Registry có toàn bộ ca giai đoạn 1–3 | Đạt, 85 ID giai đoạn 1–4 |
| 6 | Bảng so sánh đủ tiêu chí | Đạt cơ chế/scorer; Not run benchmark trả phí |
| 7 | Lỗi/chậm tự lùi, vẫn có câu trả lời | Đạt tự động |
| 8 | Admin thấy số/tỷ lệ/lý do fallback | Đạt tự động |
| 9 | Chi phí hôm nay/tháng/trung bình, tách chữ/ảnh | Đạt tự động |
| 10 | Ảnh mặc định tắt, bật mới gửi | Đạt tự động |
| 11 | Mũ đang bán chỉ nói “trông giống” và đưa đúng mẫu | Đạt fixture + probe ảnh catalog OF626; chưa hiệu chỉnh ảnh điện thoại |
| 12 | Hàng không bán/no-match không bị đoán bừa | Đạt fixture |
| 13 | Sản phẩm hỏng chuyển nhân viên, không phán bảo hành | Đạt VI/EN tự động |
| 14 | Ảnh đầu/người không đoán size | Đạt VI/EN tự động |
| 15 | Ảnh ngoài phạm vi bị từ chối | Đạt VI/EN tự động |
| 16 | Quá 8 MB/sai định dạng báo rõ, chat không hỏng | Đạt tự động |
| 17 | Hết 20 ảnh/ngày báo rõ, chữ vẫn dùng | Đạt tự động |
| 18 | Xóa lịch sử xóa object trước success | Đạt tự động, gồm lỗi MinIO |
| 19 | Ảnh quá 90 ngày/pending quá một giờ được dọn | Đạt tự động |
| 20 | Thiếu `chat.read` không xem được ảnh | Đạt tự động |
| 21 | Chính sách/disclosure VI/EN đầy đủ | Đạt tự động |
| 22 | Regression giai đoạn 1–3 với adapter model cũ/mới | Đạt full regression: backend 1.578 ca, admin 1.018/1.018, web 522/522 |

## 8. Phần chưa làm được và lý do

- **Not run: 141 hội thoại thật và đáp án chuẩn.** Máy local không có dữ liệu vận hành thật và
  phạm vi cấm đụng dữ liệu khách. Công cụ xuất bản nháp đã che PII có sẵn cho owner chạy trên VPS;
  bước kiểm tra tay/ground truth vẫn bắt buộc. Đây là phần còn thiếu lớn nhất của A2.
- **Not run: benchmark trả phí giữa model.** Vì owner cấm gọi trợ lý thật hàng loạt; bảng ở mục 1
  cố ý để `Not run`, không bịa số.
- **Not run: ảnh điện thoại thật và hiệu chỉnh toàn bộ 176 ảnh catalog owner đã đo.** Đã probe
  read-only một ảnh catalog OF626 thu nhỏ với hai ảnh nhiễu; chưa đủ bằng chứng nói loại hàng nào
  nhận tốt ngoài ảnh gần catalog.
- **Not run: triển khai VPS và smoke test MinIO/Gemini.** Không tự triển khai theo phạm vi.
- **Not run: theo dõi 14 ngày sau đổi model.** Chỉ bắt đầu sau khi owner chọn và triển khai model.
- Model Google mới có thể xuất hiện live nhưng sẽ bị khóa cho đến khi có giá chính thức được thêm
  với ngày hiệu lực. Đây là chủ ý chống bịa chi phí.
- Dataset thật sau khi owner xác minh hiện cần developer kiểm vào resource versioned; giao diện chưa
  có upload dataset.

Kết quả kiểm tra mã nguồn cuối ngày 26/08/2026:

- Backend `./mvnw test`: **1.578 ca**, 0 thất bại, 0 lỗi, 1 ca bỏ qua có chủ đích; migration
  PostgreSQL 16 tới V1061 cũng chạy thật trong Testcontainers.
- Admin: lint đạt; **107/107 tệp, 1.018/1.018 ca** đạt khi chạy một worker; production build đạt.
- Web: lint đạt; **75/75 tệp, 522/522 ca** đạt; production build 73 trang đạt. Build chỉ còn cảnh
  báo đổi tên cấu hình Sentry, không làm build thất bại.
- E2E luồng khách xem disclosure, preview ảnh và chỉ gửi private image id: **1/1 đạt** bằng API
  fixture, không gửi ảnh tới Gemini và không dùng dữ liệu khách.
- `git diff --check`, guard không chứa dữ liệu nghiệp vụ/mock runtime và parse OpenAPI/dataset/locale
  VI/EN đều đạt.

`Not run: npm test -- --maxWorkers=1 --minWorkers=1` vì Vitest hiện tại không hỗ trợ cờ
`--minWorkers`; lệnh được hỗ trợ `npm test -- --maxWorkers=1` đã chạy thay thế và đạt đủ 1.018 ca.

## 9. Việc owner cần tự chạy sau

### Kiểm tra local trước khi phát hành

Local dùng `.env` mặc định, không dùng `.env.vps`:

```bash
cd /root/myproject/bigbike
(cd bigbike-backend && ./mvnw test)
(cd bigbike-admin && npm run lint && npm test && npm run build)
(cd bigbike-web && npm run lint && npm test && npm run build)
```

### Trên VPS — chỉ khi owner quyết định triển khai

Tất cả lệnh VPS phải chỉ rõ `.env.vps`:

```bash
cd /root/myproject/bigbike
docker compose --env-file .env.vps config --quiet
docker compose --env-file .env.vps build bigbike-backend bigbike-admin bigbike-web
docker compose --env-file .env.vps up -d --no-deps bigbike-backend bigbike-admin bigbike-web
docker compose --env-file .env.vps ps
docker compose --env-file .env.vps logs --since=10m bigbike-backend
```

Kiểm tra migration mới bằng lệnh chỉ đọc:

```bash
docker compose --env-file .env.vps exec -T postgres sh -lc \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "select version, description, success from flyway_schema_history where version = '\''1061'\'';"'
```

Kiểm tra dịch vụ:

```bash
curl -fsS http://127.0.0.1:8080/actuator/health
curl -fsSI http://127.0.0.1:3000/vi
curl -fsSI http://127.0.0.1:4000/
```

Sau đó owner tự làm trên giao diện:

1. Mở Cài đặt Trợ lý, kiểm tra danh sách model; **chưa bật ảnh**.
2. Tải bản nháp câu thật, kiểm tra lại PII và đáp án với dữ liệu shop; chuyển cho developer tạo
   dataset đã xác minh.
3. Chạy 2.5 Flash cạnh 3.7 Flash với trần 2 USD; xem đủ sáu tiêu chí rồi mới chọn.
4. Dùng một hội thoại thử và ảnh sản phẩm thử không có người/PII: kiểm tra preview, admin xem ảnh,
   no-match, hỏng, size, xóa lịch sử và bucket riêng không public.
5. Khi các bước trên đạt mới bật đọc ảnh; giữ trần 20/ngày.
6. Ghi 14 ngày answers/give-ups/fallback/p50/p95/chi phí chữ/ảnh; so give-up với 9%. Nếu xấu hơn,
   chọn lại 2.5 Flash trong Cài đặt.

Không dùng ảnh/hội thoại khách thật cho smoke test và không đặt file dump chứa dữ liệu khách trong
repository.
