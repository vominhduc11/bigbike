# DEV-7 / DEV-8 / DEV-9 — 06/11/2026

## Phạm vi và căn cứ

Phiếu owner 06/11/2026; `BUSINESS_RULES.md` GMC_RULE_006, STORE_HOURS_RULE_001, ANALYTICS_RULE_009 và ANALYTICS_RULE_006; `API_CONTRACT.md` mục Local inventory feed. Chỉ sửa web và cấu hình/tài liệu liên quan. Các thay đổi có sẵn của phiên khác trong workspace được giữ nguyên.

## Thực hiện

- DEV-7: GET/HEAD `/google-local-inventory.tsv`, UTF-8, bốn cột; projection chung với XML bảo đảm cùng SKU, hàng đủ điều kiện, availability và giá đang bán. Không quantity theo inventory boolean hiện hành. Đọc mới mỗi lần như nguồn chính, không cache; lịch hằng ngày cùng giờ XML đặt ở GMC. Thiếu/sai mã cửa hàng hoặc dữ liệu lỗi trả 503, Retry-After 300, không xuất thiếu hàng dưới trạng thái thành công. Proxy bỏ qua TSV; env server-only và Compose đã khai GMC_STORE_CODE, mẫu để trống.
- DEV-8: `lib/content/store-hours.ts` làm nguồn chung cho header, footer, contact, product, confirmation và homepage schema. Xóa chín khóa giờ cũ ở mỗi ngôn ngữ. Chuẩn hóa ba giá trị giờ khi web đọc settings để bản EN cũ không còn lọt vào HTML dữ liệu kèm trang. Không sửa DB hoặc giờ xử lý trực tuyến.
- DEV-9: chống lặp Meta ViewContent qua render/VI/EN, kể cả slug khác hoặc chuyển ngôn ngữ có anchor cần tải lại tài liệu; token chuyển locale chỉ sống 30 giây và được tiêu thụ một lần. Mọi sự kiện Meta chủ động có eventID, Purchase giữ ID ổn định. PageView hiện hữu vốn dùng track chuẩn; chỉ thêm eventID, không thêm bộ gửi PageView điều hướng. Không bật CAPI.

## Bằng chứng chỉ đọc hệ thống đang chạy

- Đã `docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'` trước khi đọc container.
- `docker exec bigbike-web node -e ...`: chỉ in trạng thái configured/blank của NEXT_PUBLIC_CLARITY_PROJECT_ID, NEXT_PUBLIC_META_PIXEL_ID, GMC_STORE_CODE. Clarity và store code trống/chưa khai; Meta đã khai. Không in secret.
- GET `https://bigbike.vn/en/`: tìm thấy một lệnh `fbq('track','PageView')`, không thấy trackCustom PageView, không có Clarity loader.
- GET settings/public VI/EN trên backend :8080: bản VI đúng ngày thường/CN, bản EN còn Mon–Fri/Sat–Sun 18:00; mã web mới chuẩn hóa riêng ba trường giờ, giữ nguyên các trường khác.

## Trạng thái bàn giao

1. Owner đã cung cấp mã cửa hàng thật `BIGBIKE-HCM-01`; đã cấu hình và nghiệm thu nguồn hoạt động.
2. Web mới đã triển khai; đã đặt GMC_STORE_CODE và nạp lại riêng web, giữ nguyên image đã nghiệm thu.
3. Shop thêm scheduled fetch local inventory trong GMC 124097107, cùng giờ nguồn chính; theo dõi local_stores_lack_inventory và Google Maps sau 2–3 ngày.
4. Kiểm nhãn/receipt trong Meta Events Manager bằng tài khoản của shop. CAPI còn ngoài phạm vi; khi bật phải chuyển cùng eventID sang server.
5. Clarity đang không hoạt động ở bản đã kiểm. Chỉ điền project ID/build lại sau khi quản trị viên xác nhận che URL key/token/tiep/s/q theo ANALYTICS_RULE_006.

## Kiểm tra cuối phiên

- `npm run test -- --maxWorkers=2`: **114 file / 783 bài đạt**, gồm đổi locale khác slug, ID sự kiện, ánh xạ feed và lỗi cấu hình/nguồn.
- `npx tsc --noEmit`, `npm run lint`, Prettier trên file mới/cập nhật và `git diff --check`: đạt.
- `npm run build` chạy riêng sau khi dừng các phép kiểm khác: **đạt, exit 0**. Compile, TypeScript, tạo trang và hoàn tất bản phát hành đều thành công.
- `bash deploy/nginx/tests/domain-boundary-config-test.sh --self-test`: đạt kiểm dương và cả hai kiểm âm.
- Chạy bản vừa build ở localhost:3002 rồi `PW_BASE_URL=http://localhost:3002 npx playwright test e2e/local-inventory-hours.e2e.ts --workers=1`: **3/3 đạt, 37,7 giây**. Toàn bộ **1.184 dòng** TSV/XML khớp ID/availability/giá đang bán. HTML và footer Liên hệ VI, trang chủ EN, sản phẩm VI/EN đúng giờ, không còn 18:00/18h00. VI → EN → VI giữ một ViewContent có eventID. Không có pageerror trong bài giờ.
- Cấu hình store_code trong thử nghiệm là E2E_STORE, chỉ ở tiến trình cục bộ, không sửa .env/DB hoặc gửi lên GMC. Chặn dịch vụ analytics thật khi duyệt thử. Bản preview chưa có internal token nên có cảnh báo redirect lookup 401; managed redirects không nằm trong phép nghiệm thu này.
- Lần build chạy cùng toàn bộ test gặp timeout dựng trang; lần chạy riêng sau đó đạt. E2E trên dev server từng gặp biên dịch lạnh/404; cả ba phép kiểm đã chạy lại đạt trên bản build cuối.
- Các tiến trình preview tạm đã dừng; container phục vụ shop không bị thay đổi. Tại mốc kiểm thử trước triển khai: chưa thay đổi website thật hoặc tài khoản Google/Meta/Clarity; kết quả triển khai tiếp nối ghi bên dưới.

## Đã triển khai lên web thật — owner duyệt 06/11/2026

- Build riêng web bằng `docker compose --env-file .env.vps build bigbike-web`: đạt, 97/97 trang. Giữ image cũ bằng tag `bigbike-web:before-dev789-20261106-070402`.
- Nạp riêng web bằng `docker compose --env-file .env.vps up -d --no-deps --no-build --wait --wait-timeout 180 bigbike-web`: đạt, container healthy. Image mới `sha256:60f52931e0a398dca288131aa364bae87f64f87619f7b3a039f4818cb29e7644`.
- Nghiệm thu HTTPS thật: XML 200, 1.184 SKU duy nhất; Liên hệ VI, trang chủ EN và sản phẩm VI/EN trả 200 (bản EN dùng slug VI có 308 chuẩn sang slug EN). Không còn 18:00/18h00 trong HTML các trang đã kiểm. Footer đúng T2–T7 21:00, CN 17:00. PageView dùng track chuẩn có eventID; không có Clarity loader.
- `PW_BASE_URL=https://bigbike.vn npx playwright test e2e/local-inventory-hours.e2e.ts --workers=1 -g 'VI and EN shop hours|locale changes'`: 2/2 đạt, 42,8 giây; VI → EN → VI chỉ có một ViewContent. Chặn collector và dùng bộ thu tại trình duyệt thử, không gửi lượt thử vào quảng cáo.
- `/google-local-inventory.tsv` đã có route trên web thật, trả 503 + Retry-After 300 đúng hợp đồng vì chưa có mã cửa hàng thật. Chưa thể đăng nguồn hoạt động vào GMC.
- Đã so ID container trước/sau: admin, backend, PostgreSQL, Redis và MinIO giữ nguyên. Hash .env và .env.vps giữ nguyên. GA4/Meta giữ nguyên cấu hình; Clarity vẫn tắt.
- Bằng chứng: [verification.json](evidence/dev789-deploy-2026-11-06/verification.json). Log build/deploy tại `/tmp/bigbike-dev789-docker-build.log`, `/tmp/bigbike-dev789-docker-deploy.log`; E2E tại `/tmp/bigbike-dev789-live-e2e.log`.

## Nguồn local inventory đã hoạt động — owner cung cấp mã 06/11/2026

- Owner xác nhận `BIGBIKE-HCM-01`. Đã lưu qua biến GMC_STORE_CODE trong `.env.vps` đang dùng; bản sao lưu bảo mật nằm ngoài repo. File env không được Git theo dõi, không đóng cứng mã trong code.
- `docker compose --env-file .env.vps up -d --no-deps --no-build --wait --wait-timeout 180 bigbike-web`: đạt, healthy. Giữ nguyên image web; các container admin/backend/PostgreSQL/Redis/MinIO không bị nạp lại. Chỉ GMC_STORE_CODE đổi; .env gốc giữ nguyên.
- HTTPS `https://bigbike.vn/google-local-inventory.tsv`: **200**, UTF-8 TSV, bốn cột, **1.184 dòng**, toàn bộ store_code đúng. Đối chiếu **tất cả** ID/Còn-Hết/giá đang bán với 1.184 item XML đạt; chọn ngẫu nhiên thêm 10 SKU cũng khớp. HEAD với User-Agent Googlebot trả 200, không body; đây không phải bằng chứng Google đã thực sự tìm nạp.
- `PW_BASE_URL=https://bigbike.vn npx playwright test e2e/local-inventory-hours.e2e.ts --workers=1 -g 'complete live main feed'`: **1/1 đạt** trên web thật.
- Bằng chứng: [store-code-verification.json](evidence/dev789-deploy-2026-11-06/store-code-verification.json). Log `/tmp/bigbike-gmc-store-deploy.log`, `/tmp/bigbike-gmc-store-e2e.log`. Các ghi nhận thiếu store code/503 bên trên là lịch sử trước mốc kích hoạt này.
- **Còn phía shop/GMC:** thêm URL TSV làm nguồn local inventory ở GMC 124097107, lịch hằng ngày cùng giờ XML; theo dõi xử lý, lỗi local_stores_lack_inventory và hiển thị Google Maps. Chưa có bằng chứng tài khoản Google đã nhận hoặc duyệt nguồn mới.

## GMC đã đọc nguồn nhưng từ chối mã cửa hàng — báo cáo owner 06/11/2026

- Owner cung cấp báo cáo nguồn `PRODUCTS_INVENTORY_FULL SOURCE 2`, ID `409043453`, tài khoản `124097107`, lần tải `16:41 06/11/2026 GMT+07:00`. Các dòng sản phẩm báo `[Trang doanh nghiệp] Mã cửa hàng không hợp lệ`, giá trị `BIGBIKE-HCM-01`; một số dòng chỉ báo `Lỗi nội bộ (9, 0)`, chưa có đủ bằng chứng xác định nguyên nhân riêng của mã lỗi nội bộ.
- Báo cáo là bằng chứng Google đã đọc nguồn nhưng chưa ghép được mã cửa hàng với hồ sơ đã liên kết; không còn chỉ là trạng thái chưa biết Google đã lấy tệp hay chưa. Không phải bằng chứng phê duyệt hoặc hiển thị Maps.
- Owner xác nhận mã được lưu trong hồ sơ Google Maps **hôm nay**. Khả năng cao còn trong thời gian đồng bộ; chưa có bằng chứng trực tiếp xác minh đúng hồ sơ liên kết trong GMC. Google nêu có thể mất tới 24 giờ sau cập nhật mã/liên kết, rồi cần gửi lại nguồn.
- Hướng xử lý: giữ mã đã xác nhận, kiểm đúng hồ sơ Shop Bigbike đã liên kết ở GMC; chờ đủ 24 giờ tính từ lúc lưu mã trên Business Profile, sau đó cập nhật lại nguồn local inventory. Nếu vẫn lỗi, đối chiếu mã/nhóm hồ sơ/liên kết/xác minh và báo cáo mới; không đổi mã hoặc sửa logic feed khi chưa có bằng chứng sai dữ liệu.
- Nguồn chính thức: [Google — Invalid store code](https://support.google.com/merchants/answer/15077749?hl=en). Không thực hiện thay đổi tài khoản Google hoặc mã nguồn trong lượt chẩn đoán này.
