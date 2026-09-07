# Rà soát thao tác trùng trên BigBike Web — 2026-09-07

Trạng thái: đã sửa 7 nhóm giao diện theo yêu cầu chủ shop. Đây là báo cáo tại thời điểm rà soát; quy tắc giao diện hiện hành nằm trong [STYLEGUIDE.md — Hành động không trùng lặp](../../bigbike-web/STYLEGUIDE.md).

## Phạm vi và cách kiểm tra

- Lập danh sách toàn bộ **35 file `page.tsx`**, gồm trang khách hàng, trang trung gian/URL tương thích và trang xem trước; quét **254 file TSX** trong `app/` và `components/`, không tính file kiểm thử. Ghi nhận 455 vị trí khai báo điều khiển hoặc liên kết trước khi sửa, rồi đọc điều kiện hiển thị và cách ghép các thành phần dùng chung.
- Đối chiếu cùng đích đến/cùng hàm xử lý, trạng thái tải/rỗng/lỗi/thành công, kích thước màn hình và vị trí trong trang. Không kết luận trùng chỉ vì hai nút cùng tên hoặc cùng URL.
- Kiểm tra trình duyệt với dữ liệu dịch vụ thật. Web Docker tại `http://localhost:3000` là bản cũ hơn mã trong thư mục làm việc. Bản sửa được kiểm tra qua Next.js chạy riêng tại `http://localhost:3001` bằng `npx next dev --webpack -p 3001`.
- Phạm vi bao phủ mẫu trang và thành phần dùng chung; không phải kiểm duyệt từng bài viết hoặc từng sản phẩm trong toàn bộ dữ liệu kinh doanh. Nội dung HTML do quản trị nhập được lấy mẫu trên trang đang chạy.

## Những chỗ đã sửa

| Nhóm trang | Trùng trước khi sửa | Sau khi sửa | Bằng chứng mã |
|---|---|---|---|
| Tài khoản và 4 mẫu trang con: đơn hàng, chi tiết đơn, sổ địa chỉ, sửa thông tin | Icon cạnh hồ sơ và dòng cuối menu cùng đăng xuất | Giữ dòng “Đăng xuất” cuối menu; bỏ icon và phần đệm thừa | [AccountNav.tsx](../../bigbike-web/components/account/AccountNav.tsx) |
| Tất cả sản phẩm, danh mục, thương hiệu, tìm kiếm | Khi lọc không ra kết quả, cả đầu danh sách và thông báo rỗng cùng hiện bộ chip/nút bỏ lọc; lọc size còn có liên kết bỏ size riêng | Một bộ thao tác bỏ lọc trong thông báo rỗng. Khi có kết quả/lỗi hệ thống, bộ thao tác ở đầu danh sách | [CatalogResults.tsx](../../bigbike-web/components/catalog/CatalogResults.tsx), [CatalogClient.tsx](../../bigbike-web/components/catalog/CatalogClient.tsx) |
| Giỏ hàng trên điện thoại | Nút “Đặt hàng” ở khối tổng tiền và thanh cố định cùng hiện | Điện thoại dùng thanh cố định; máy tính dùng khối tổng tiền | [CartSummary.tsx](../../bigbike-web/components/cart/parts/CartSummary.tsx) |
| Trang tổng hợp hướng dẫn | Menu bên và thẻ bài dẫn tới cùng hai bài hướng dẫn | Giữ thẻ bài; các trang hướng dẫn chi tiết vẫn có menu bên | [GuidePage.tsx](../../bigbike-web/app/[locale]/(storefront)/huong-dan/GuidePage.tsx) |
| Liên hệ | Số Zalo trong thông tin cửa hàng và thẻ Zalo đều mở cùng cuộc liên hệ | Giữ thẻ Zalo; số vẫn đọc được nhưng không là nút thứ hai | [ContactPageContent.tsx](../../bigbike-web/components/contact/ContactPageContent.tsx) |
| Xác nhận đơn hàng | Số Zalo trong thanh liên hệ và nút hỗ trợ ngay bên dưới mở cùng đích | Giữ nút hỗ trợ; vẫn hiển thị số Zalo | [OrderConfirmView.tsx](../../bigbike-web/app/[locale]/(storefront)/don-hang/xac-nhan/OrderConfirmView.tsx) |
| Sản phẩm ngừng bán, gồm URL lịch sử | Link nhóm hàng trong thông tin và “Xem cả nhóm hàng” bị lặp; khi thiếu gợi ý, nút “Xem hàng tương đương” cũng dẫn tới chính nhóm đó | Trong khối trạng thái chỉ có một link nhóm hàng. Có gợi ý: giữ link ở thông tin. Không có gợi ý: nút chính ghi đúng “Xem cả nhóm hàng” | [DiscontinuedStatusPanel.tsx](../../bigbike-web/components/catalog/DiscontinuedStatusPanel.tsx) |

Các thay đổi dùng chung cho tiếng Việt và tiếng Anh. Không thay đổi cơ chế đăng xuất, xử lý giỏ, đặt đơn, trạng thái thanh toán hoặc đích URL.

## Những trường hợp được giữ có chủ đích

- Menu đầu/chân website và điều hướng trong nội dung: khác vị trí sử dụng. Các nút trên mobile/desktop chỉ là bản thay thế nhau khi có điều kiện ẩn/hiện tương ứng.
- Ảnh, tên và nút chọn của một thẻ sản phẩm; mã đơn và nút xem đơn: giúp khách mở đúng nội dung từ những điểm dễ nhận biết. Các nút điều hướng slide ở nhiều dải sản phẩm xử lý các dải khác nhau.
- Tóm tắt tài khoản dẫn tới đơn hàng/địa chỉ/thông tin cá nhân: là lối tắt trong nội dung, đi cùng menu điều hướng thường trực.
- Nút viết đánh giá ở đầu sản phẩm và trong mục đánh giá ở dưới: trang dài, một hộp viết đánh giá dùng chung. Hai nút trong mã của riêng mục đánh giá thuộc hai trạng thái có/chưa có đánh giá và không cùng hiện.
- Thanh mua nổi trên điện thoại chỉ hiện khi cụm mua ở đầu trang ra khỏi màn hình. Các khối liên hệ theo từng đoạn của trang sản phẩm dài vẫn có mục đích hỗ trợ tại vị trí khách đang đọc. “Mua ngay” cuối trang cuộn tới khu chọn sản phẩm, không tự thêm giỏ như nút chính.
- “Tiếp tục” và “Chuyển khoản sau” ở bước hướng dẫn chuyển khoản cùng dẫn tới xác nhận nhưng là hai lựa chọn đã được chủ shop chốt trong [API_FLOW_MAP.md — Manual transfer receipt](../engineering/API_FLOW_MAP.md). Không tự gộp hoặc biến một nút thành xác nhận đã trả tiền. Xem [BUSINESS_RULES.md — PAY_RULE_002/PAY_RULE_003](../business/BUSINESS_RULES.md).
- Gửi lại email ở màn thiếu mã và màn mã lỗi, nút trở lại đơn hàng ở màn lỗi và màn thành công, nút quay lại mua hàng ở các trạng thái giỏ: các nhánh loại trừ nhau, không trùng trên một màn hình.
- Đóng hộp thoại qua lớp nền, phím Escape và nút đóng: các cách tương tác thay thế, không phải nhiều nút hành động dư thừa. Nút đóng tự sinh đã được ẩn ở nơi có nút đóng riêng.
- Các trang còn lại đã đọc: đăng nhập/đăng ký/quên mật khẩu/xác nhận email, đặt hàng, tra cứu đơn chưa nhập mã, tin tức và bài viết, giới thiệu, hướng dẫn size, chính sách, trang lỗi/404, từ chối thư mời đánh giá, xem trước và URL trung gian. Không phát hiện thêm thao tác trùng cần sửa trong phần mã được rà soát.

## Căn cứ

- [STYLEGUIDE.md](../../bigbike-web/STYLEGUIDE.md): Buttons, Catalog filters và mục mới Hành động không trùng lặp. Quy tắc được cập nhật trước khi sửa mã.
- [BUSINESS_RULES.md](../business/BUSINESS_RULES.md): bộ hai bài hướng dẫn hiện hành; `REDIRECT_RULE_013` vẫn yêu cầu đường dẫn nhóm/thương hiệu và Zalo cho hàng ngừng bán; `PAY_RULE_002`/`PAY_RULE_003` giữ việc ghi nhận tiền ở quản trị.
- [API_FLOW_MAP.md](../engineering/API_FLOW_MAP.md): Catalog filters và Manual transfer receipt.
- `AGENTS.md` §5.3, §6.2, §6.4: trạng thái thiết kế đầy đủ, hệ giao diện thống nhất, dùng lại thành phần hiện có.

## Kiểm chứng và giới hạn

- `npm run test -- --maxWorkers=2`: **103 file / 658 kiểm thử đạt**. Bao gồm kiểm thử lọc rỗng/lỗi, giỏ hàng, bước chuyển khoản và nội dung công khai.
- Kiểm tra lại `CartParts.test.tsx` và `CartExperience.test.tsx` sau khi nhận các thay đổi giỏ hàng đang có trong thư mục dùng chung: **12 kiểm thử đạt**. Giữ nguyên phần xử lý giỏ của công việc khác; thay đổi của đợt rà soát này chỉ ẩn nút trong tổng tiền ở kích thước điện thoại.
- `npm run build -- --webpack`: **đạt**, dựng 75 trang tĩnh và biên dịch các trang động thành công.
- ESLint trên 7 file nguồn được sửa: **đạt**. `npx eslint . --ignore-pattern 'output/**'` trên mã web: **đạt**.
- `npm run lint` nguyên bản bị chặn bởi tệp tạm ngoài phần sửa `bigbike-web/output/playwright/chat-visibility-check.cjs` dùng `require()`. Không sửa hoặc xoá tệp của công việc khác.
- `npx tsc --noEmit --incremental false` riêng lẻ báo lỗi kiểu trong các file kiểm thử ngoài phần sửa; kết quả này không đồng nghĩa toàn bộ kiểm tra đều đạt. Lệnh build chính thức ở trên vẫn hoàn tất.
- Trình duyệt kiểm tra mẫu các trang công khai thật trên máy tính: trang chủ, danh sách sản phẩm/danh mục/thương hiệu/tìm kiếm, sản phẩm, tin tức/bài viết, giới thiệu, liên hệ, hướng dẫn và chính sách. Các lượt vào đăng nhập/đăng ký/quên mật khẩu/xác nhận email/tra cứu đơn được kiểm tra ở trạng thái khách chưa nhập thông tin.
- Hướng dẫn và Liên hệ đã kiểm tra lại ở **390px và 1440px**, đều HTTP 200, không tràn ngang. Trong nội dung Hướng dẫn mỗi bài chỉ có một liên kết chọn; trong nội dung Liên hệ chỉ có một liên kết Zalo. Đã mở và đối chiếu bốn ảnh `guide-390.png`, `guide-1440.png`, `contact-390.png`, `contact-1440.png`. Chi tiết nằm trong `output/playwright/web-duplicate-audit/final-screens.json` và các ảnh cùng thư mục (tệp cục bộ).
- Hai trang tương ứng tiếng Anh `/en/guide/` và `/en/contact/` cũng HTTP 200 trên điện thoại, có đúng số liên kết như tiếng Việt và không tràn ngang; xem `final-states.json` cùng thư mục.
- Lọc thật `/sp/?orderby=date&q=zzzauditempty&kich-co=XS` cho kết quả rỗng. Ở cả **390px và 1440px**, chỉ có một nút “Bỏ bộ lọc: XS” và một nút “Xoá tất cả”, không có bộ thứ hai phía trên. Bấm bỏ size xoá `kich-co` khỏi URL và nút size biến mất. Đã xem hai ảnh `filtered-empty-390.png`, `filtered-empty-1440.png`; kết quả thao tác lưu trong `filter-check.json`. Nút bỏ từng điều kiện và nút xoá toàn bộ vẫn được giữ vì phục vụ hai phạm vi thao tác khi khách chọn nhiều điều kiện.
- Chưa kiểm tra bằng phiên khách hàng đã đăng nhập, giỏ có sản phẩm, đơn hàng thật có khoá truy cập hoặc dữ liệu sản phẩm ngừng bán: không có phiên thích hợp trong trình duyệt riêng, và cơ sở dữ liệu đang chạy chưa có bảng/cột của phần hàng ngừng bán hiện tại. Lượt vào giỏ/đặt hàng ban đầu mới ghi nhận trạng thái tải, không được tính là xác minh đầy đủ luồng. Các phần đó được đối chiếu mã và kiểm thử có sẵn; không tạo đơn/khách/sản phẩm giả và không đổi dữ liệu kinh doanh.
- Một số cảnh báo/lỗi từ môi trường cũ (khác cổng favicon, thứ tự sắp xếp chưa được backend cũ hỗ trợ) nằm ngoài phạm vi trùng thao tác. Khi cần xem catalog thật, dùng lựa chọn sắp xếp mới nhất vốn được cả hai phiên bản hỗ trợ.
- Lượt mở URL không tồn tại gặp lỗi Next.js về root layout của `app/not-found.tsx`, kéo theo lượt kiểm tra mobile đầu tiên không hoàn tất. Đã khởi động lại riêng tiến trình xem thử do đợt rà soát này tạo để kiểm tra lại các trang ở trên; không tính lượt lỗi là đạt. Lần thử chạy bản build ở cổng 3107 gặp thiếu tệp `.next/required-server-files.json` tại thời điểm chạy và đã dừng tiến trình đó. Không sửa cấu hình hoặc trang 404 trong đợt dọn thao tác trùng.
- Không khởi động lại hoặc cập nhật container chung. Bản chạy cổng 3000 cần lần triển khai tiếp theo để nhận mã mới.

### Lệnh đọc Docker đã dùng

1. `docker ps --format '{{.Names}}\t{{.Status}}\t{{.Ports}}'`: xác nhận `bigbike-web`, `bigbike-backend`, `bigbike-postgres` đang chạy.
2. `docker exec bigbike-postgres psql -U bigbike -d bigbike -At -c "SELECT slug, category_slug FROM legacy_discontinued_products WHERE enabled = true ORDER BY updated_at DESC LIMIT 3;"`: trả về bảng chưa tồn tại.
3. `docker exec bigbike-postgres psql -U bigbike -d bigbike -At -c "SELECT table_schema,table_name FROM information_schema.tables WHERE table_name LIKE '%product%' AND table_schema NOT IN ('pg_catalog','information_schema') LIMIT 10;"`: xác nhận schema sản phẩm đang có.
4. `docker exec bigbike-postgres psql -U bigbike -d bigbike -At -c "SELECT column_name FROM information_schema.columns WHERE table_name='products' AND column_name IN ('slug','discontinued','stock_state','status');"`: có `slug`, `stock_state`, chưa có `discontinued`.
