# BUSINESS_RULES.md

> Business rule source cho dự án BigBike.
>
> File này mô tả các quy tắc nghiệp vụ ổn định của hệ thống bán hàng BigBike.
>
> Áp dụng cho:
> - `bigbike-web`: website bán hàng / SEO cho khách hàng cuối
> - `bigbike-admin`: dashboard vận hành nội bộ
> - `bigbike-backend`: backend Spring Boot
>
> File này không định nghĩa UI layout, API endpoint, database schema hoặc workflow từng bước. Con người rất thích nhét mọi thứ vào một file, nhưng rồi chính con người lại khóc khi phải bảo trì.

---

## 1. Purpose

`BUSINESS_RULES.md` định nghĩa các quy tắc nghiệp vụ mà toàn hệ thống BigBike phải tuân thủ.

File này trả lời:

- Điều gì được phép?
- Điều gì không được phép?
- Khi nào một trạng thái được coi là hợp lệ?
- Quy tắc nào phải nhất quán giữa web, admin và backend?
- Những giả định nghiệp vụ nào không được AI agent tự phát minh?

File này không trả lời:

- Người dùng bấm gì trước/sau trong từng màn hình.
- API request/response cụ thể.
- Database table/column.
- UI token hoặc component style.
- Code implementation.

---

## 2. Business Domain

BigBike là hệ thống retail/D2C bán sản phẩm cho biker / người chơi xe máy, trọng tâm là:

- Mũ bảo hiểm.
- Áo/quần bảo hộ.
- Găng tay.
- Giày bảo hộ.
- Balo / túi treo xe.
- Giáp bảo hộ.
- Tai nghe Bluetooth / intercom gắn mũ.
- Phụ kiện biker khác.

Mô hình chính:

- Khách hàng cuối truy cập website.
- Khách browse/search/filter sản phẩm.
- Khách xem PDP.
- Khách thêm giỏ hàng hoặc mua ngay.
- Khách checkout.
- Shop xác nhận đơn / tư vấn / giao hàng theo quy trình vận hành.
- Admin quản trị sản phẩm, nội dung, đơn hàng và hỗ trợ.

Không mặc định có dealer/B2B flow nếu chưa có tài liệu nghiệp vụ riêng xác nhận.

---

## 3. Source of Truth Rules

### 3.1 Business rule ownership

Business rules phải được quản lý tại:

```text
docs/business/BUSINESS_RULES.md
```

Nếu business rule thay đổi, cần cập nhật file này trước hoặc cùng lúc với code.

### 3.2 No invented rules

AI agent/developer không được tự phát minh:

- Trạng thái đơn hàng.
- Trạng thái thanh toán.
- Quy tắc tồn kho.
- Quy tắc bảo hành.
- Quy tắc đổi trả.
- Quy tắc khuyến mãi.
- Quy tắc tính phí giao hàng.
- Quy tắc phân quyền.

Nếu chưa rõ, phải để `TBD` hoặc trích dẫn tài liệu nguồn, không đoán.

### 3.3 Backend is enforcement point

Frontend có thể validate để UX tốt hơn, nhưng backend phải là nơi enforce nghiệp vụ cuối cùng.

Ví dụ:

- Giá đơn hàng.
- Tồn kho.
- Trạng thái đơn.
- Quyền thao tác admin.
- Khuyến mãi.
- Hủy/đổi trạng thái đơn.
- Dữ liệu cá nhân.

Frontend không được là nguồn sự thật duy nhất.

---

## 4. Product Rules

### 4.1 Product identity

Mỗi sản phẩm cần có định danh rõ ràng để hiển thị và vận hành.

Thông tin product tối thiểu nên có:

- Tên sản phẩm.
- Danh mục.
- Giá bán.
- Ảnh đại diện.
- Trạng thái hiển thị.
- Tình trạng hàng hoặc khả năng đặt hàng.
- Mô tả ngắn hoặc thông tin chính.

Nếu có SKU/model/brand thì phải hiển thị nhất quán trên web và admin.

### 4.2 Product publish rule

Sản phẩm chỉ nên hiển thị trên public website khi:

- Đã được admin publish/enable.
- Có tên hợp lệ.
- Có giá hợp lệ nếu sản phẩm bán online.
- Có ít nhất một ảnh hoặc fallback hợp lệ.
- Không bị đánh dấu hidden/archived/deleted.
- Không vi phạm rule hiển thị khác do business xác định.

Không hiển thị sản phẩm draft/disabled như sản phẩm mua được.

### 4.3 Product image rule

Product image public-facing phải:

- Rõ sản phẩm.
- Không crop mất phần chính.
- Không dùng ảnh lỗi.
- Có fallback nếu ảnh không load.
- Có alt text phù hợp cho SEO/accessibility nếu có thể.

Admin có thể cho phép thiếu ảnh trong draft, nhưng public page phải xử lý fallback tử tế.

### 4.4 Product description rule

Mô tả sản phẩm phải phục vụ quyết định mua:

- Nêu rõ sản phẩm là gì.
- Nêu lợi ích chính.
- Nêu thông số quan trọng nếu có.
- Nêu chính sách liên quan nếu phù hợp.
- Không chứa thông tin sai về bảo hành/khuyến mãi/tồn kho.

### 4.5 Product variant rule

Nếu sản phẩm có biến thể như size, màu, model:

- Khách phải chọn biến thể bắt buộc trước khi mua.
- Biến thể hết hàng/không khả dụng phải được disable hoặc ghi rõ.
- Giá/tồn kho theo biến thể phải hiển thị đúng nếu business hỗ trợ.
- Không tự chọn biến thể ngầm nếu gây nhầm lẫn.

### 4.6 Product deletion rule

Không nên hard-delete sản phẩm đã liên quan đơn hàng nếu điều đó làm mất lịch sử nghiệp vụ.

Khuyến nghị:

- Dùng archive/hidden/unpublished.
- Giữ dữ liệu lịch sử cho đơn hàng.
- Hard-delete chỉ dành cho dữ liệu test hoặc item chưa có liên kết nghiệp vụ, nếu backend cho phép.

---

## 5. Category and Brand Rules

### 5.1 Category visibility

Category public chỉ nên hiển thị khi:

- Category đang active.
- Có sản phẩm public hoặc có mục tiêu SEO/content rõ.
- Có tên/slug hợp lệ.
- Không bị archive/hidden.

### 5.2 Category SEO rule

Category page nên có:

- H1 rõ.
- Mô tả ngắn.
- Product listing.
- SEO content bổ sung nếu có.
- Internal links.

Không spam keyword.

### 5.3 Product-category relationship

Một sản phẩm nên thuộc ít nhất một category chính nếu hiển thị public.

Nếu có multi-category, phải xác định category chính để:

- Breadcrumb.
- SEO canonical.
- Related products.
- Admin filtering.

---

## 6. Pricing Rules

### 6.1 Price validity

Giá bán phải hợp lệ trước khi cho mua online.

Rule chung:

- Giá không được âm.
- Giá bằng 0 chỉ hợp lệ nếu business xác nhận sản phẩm miễn phí/contact-only.
- Giá hiển thị public phải đồng nhất với giá dùng để tạo đơn.
- Không để frontend tự tính giá cuối cùng mà backend không verify.

### 6.2 Compare price / sale price

Nếu có giá gốc và giá sale:

- Sale price phải nhỏ hơn compare/original price.
- Discount badge phải tính từ dữ liệu hợp lệ.
- Không hiển thị sale giả nếu dữ liệu không đủ.
- Không hiển thị đồng thời nhiều thông điệp sale mâu thuẫn.

### 6.3 Price display

Giá public phải:

- Rõ ràng.
- Định dạng tiền tệ nhất quán.
- Có trạng thái `Liên hệ` nếu sản phẩm không public price.
- Không để giá cũ/giá mới gây nhầm.

### 6.4 Price authority

Backend là nguồn quyết định cuối cùng khi tạo đơn.

Frontend/admin có thể hiển thị/tạm tính, nhưng backend phải verify:

- Product price.
- Sale price.
- Quantity.
- Promotion.
- Total.

---

## 7. Promotion Rules

### 7.1 Promotion visibility

Promotion chỉ hiển thị public khi:

- Đang active/published.
- Nằm trong thời gian hiệu lực nếu có.
- Có sản phẩm/category áp dụng nếu rule yêu cầu.
- Không mâu thuẫn với giá sản phẩm.

### 7.2 Promotion messaging

Thông điệp khuyến mãi phải nhất quán:

- Không ghi banner `Sale up to 50%` nhưng nội dung lại `80%`.
- Không dùng badge sale nếu sản phẩm không có sale thật.
- Không để CTA dẫn tới danh sách không có sản phẩm phù hợp.

### 7.3 Promotion stacking

Nếu có nhiều promotion áp dụng cùng lúc, rule stacking phải do business/backend xác định.

Không tự suy diễn ở frontend.

---

## 8. Inventory / Stock Rules

### 8.1 Stock state

Stock state public có thể gồm các nhóm semantic:

- `in_stock`: còn hàng.
- `low_stock`: sắp hết hàng.
- `out_of_stock`: hết hàng.
- `preorder` / `backorder`: hàng đặt trước nếu business hỗ trợ.
- `contact_for_stock`: liên hệ kiểm tra hàng nếu chưa chắc.

Tên enum chính thức phải lấy từ `DATA_CONTRACT.md`.

### 8.2 Public stock display

Public UI phải hiển thị stock bằng text rõ, không chỉ dùng màu.

Ví dụ:

- `Còn hàng`
- `Sắp hết hàng`
- `Hết hàng`
- `Hàng đặt trước`
- `Liên hệ kiểm tra hàng`

### 8.3 Purchase availability

Không cho khách mua sản phẩm/variant không khả dụng nếu business không cho phép.

Nếu cho phép preorder/backorder:

- Phải hiển thị rõ.
- Phải nói rõ đây không phải hàng có sẵn.
- Checkout/order confirmation phải giữ thông tin đó.

### 8.4 Quantity rule

Quantity phải:

- Là số nguyên dương.
- Không vượt quá giới hạn backend cho phép.
- Không âm.
- Không NaN/null.
- Không tự tin vào dữ liệu frontend.

---

## 9. Cart Rules

### 9.1 Cart item validity

Cart item hợp lệ khi:

- Product tồn tại.
- Product có thể mua hoặc đặt theo business rule.
- Variant đã chọn hợp lệ nếu required.
- Quantity hợp lệ.
- Price được backend verify khi checkout.

### 9.2 Cart update

Khi cập nhật giỏ hàng:

- Quantity thay đổi phải validate.
- Item không khả dụng phải báo rõ.
- Price/stock thay đổi phải báo khách trước checkout nếu ảnh hưởng tổng tiền.
- Không silently fail.

### 9.3 Empty cart

Empty cart không phải lỗi. UI phải có state riêng và hướng khách quay lại catalog/category.

---

## 10. Checkout Rules

### 10.1 Checkout required information

Checkout cần thu thông tin tối thiểu để xử lý đơn.

Thông tin có thể gồm:

- Tên khách hàng.
- Số điện thoại.
- Địa chỉ giao hàng nếu giao hàng.
- Email nếu business yêu cầu.
- Ghi chú nếu có.
- Phương thức nhận/giao hàng nếu có.
- Phương thức thanh toán nếu có.

Không thu dữ liệu không cần thiết.

### 10.2 Checkout validation

Validation phải có cả frontend và backend.

Frontend giúp UX tốt hơn. Backend enforce cuối cùng.

### 10.3 Checkout total

Tổng đơn hàng phải được backend xác nhận trước khi tạo đơn chính thức.

Frontend chỉ được coi là tạm tính nếu backend chưa verify.

### 10.4 Checkout failure

Nếu checkout fail:

- Không mất dữ liệu form nếu có thể.
- Hiển thị lỗi rõ.
- Cho retry.
- Không tạo nhiều đơn do double-submit.

### 10.5 Double-submit rule

Submit order phải có protection:

- Disable button khi đang submit.
- Backend idempotency nếu có.
- Không tạo trùng đơn khi user bấm nhiều lần hoặc network retry.

---

## 11. Order Rules

### 11.1 Order creation

Đơn hàng chỉ được tạo khi:

- Cart/checkout hợp lệ.
- Customer/contact info hợp lệ.
- Product/variant/quantity hợp lệ.
- Backend verify giá/tổng tiền.
- Payment/shipping method hợp lệ nếu required.

### 11.2 Order code

Mỗi đơn nên có mã đơn dễ tra cứu.

Order code public/admin phải nhất quán.

### 11.3 Order status

Trạng thái đơn hàng chính thức phải được định nghĩa trong `DATA_CONTRACT.md` hoặc tài liệu nghiệp vụ liên quan.

Không tự tạo status trong UI hoặc docs phụ.

Các trạng thái concept thường gặp có thể gồm:

- Pending / waiting confirmation.
- Confirmed / processing.
- Shipping.
- Completed.
- Cancelled.
- Failed.

Danh sách trên là concept, không phải enum bắt buộc.

### 11.4 Order status transition

Không cho chuyển trạng thái tùy tiện.

Mỗi transition phải hợp lệ theo workflow/backend.

Ví dụ concept:

- Pending -> Confirmed.
- Confirmed -> Processing.
- Processing -> Shipping.
- Shipping -> Completed.
- Pending/Confirmed -> Cancelled nếu business cho phép.

Không cho Completed quay về Pending nếu không có rule đặc biệt.

### 11.5 Order history

Order đã tạo phải giữ lịch sử chính:

- Thời điểm tạo.
- Trạng thái hiện tại.
- Item snapshot.
- Tổng tiền.
- Customer/contact snapshot.
- Payment/shipping info nếu có.
- Admin actions nếu backend hỗ trợ.

Không phụ thuộc vào product hiện tại để render lại lịch sử đơn cũ.

### 11.6 Order cancellation

Cancellation phải có rule rõ:

- Ai được hủy.
- Hủy ở trạng thái nào.
- Có cần lý do không.
- Ảnh hưởng stock/payment thế nào.
- Có cần confirmation không.

Nếu chưa có rule, UI không được tự mở action hủy ở mọi trạng thái.

---

## 12. Payment Rules

### 12.1 Payment methods

Payment methods phải do backend/business config quyết định.

Các concept có thể gồm:

- COD.
- Bank transfer.
- Manual confirmation.
- Online payment nếu có tích hợp.

Không tự thêm payment method ở frontend nếu backend chưa hỗ trợ.

### 12.2 COD/manual confirmation

Nếu đơn theo COD hoặc shop gọi xác nhận:

- Public web phải nói rõ sau khi đặt hàng shop sẽ xác nhận.
- Không hiển thị như đơn đã thanh toán online.
- Admin phải thấy trạng thái cần xác nhận/thanh toán nếu backend hỗ trợ.

### 12.3 Payment state

Payment state phải tách khỏi order fulfillment state nếu hệ thống hỗ trợ.

Ví dụ concept:

- Unpaid.
- Paid.
- Pending payment.
- Failed.
- Refunded.

Tên enum chính thức phải lấy từ contract.

### 12.4 Payment authority

Không tin payment status từ frontend.

Backend/payment integration/admin verification mới là nguồn quyết định.

---

## 13. Shipping / Delivery Rules

### 13.1 Shipping information

Shipping info cần rõ với khách:

- Có giao hàng hay nhận tại cửa hàng.
- Có COD hay không.
- Shop có gọi xác nhận hay không.
- Phí ship nếu tính được.
- Nếu chưa tính được, phải ghi rõ là tạm tính/chờ xác nhận.

### 13.2 Address validation

Địa chỉ phải đủ để xử lý giao hàng.

Không cần ép format quá cứng nếu vận hành còn xác nhận thủ công, nhưng phải tránh dữ liệu quá thiếu như chỉ nhập tên đường.

### 13.3 Shipping fee

Shipping fee nếu chưa được backend tính chính thức thì UI phải ghi là estimate/tạm tính/chờ xác nhận.

Không hiển thị phí ship như chắc chắn nếu chưa có rule.

---

## 14. Warranty Rules

### 14.1 Warranty display

Warranty information phải:

- Rõ với khách.
- Gắn đúng sản phẩm/category.
- Không mâu thuẫn giữa PDP và policy page.
- Không claim quá mức nếu chưa xác nhận.

### 14.2 Warranty eligibility

Điều kiện bảo hành phải nằm trong business/policy source.

Frontend/admin chỉ hiển thị và hỗ trợ workflow, không tự quyết định eligibility nếu backend/business chưa có rule.

### 14.3 Sale/no-warranty cases

Nếu hàng sale không áp dụng bảo hành hoặc có rule riêng:

- Phải hiển thị rõ trước checkout.
- PDP/cart/checkout nên có notice nếu ảnh hưởng quyết định mua.
- Không ẩn trong policy dài mà không có cảnh báo gần CTA.

---

## 15. Return / Exchange Rules

### 15.1 Return/exchange policy display

Chính sách đổi trả phải rõ:

- Thời hạn.
- Điều kiện.
- Sản phẩm áp dụng/không áp dụng.
- Có hoàn tiền hay chỉ đổi hàng.
- Kênh liên hệ.

Không để PDP và policy page mâu thuẫn.

### 15.2 Return eligibility

Eligibility do business/backend/admin process quyết định.

UI không tự approve return nếu không có workflow.

### 15.3 Dangerous promise rule

Không ghi `đổi trả miễn phí mọi trường hợp` nếu business không xác nhận.

Copy sai chính sách là cách rất nhanh để CSKH được “tập gym tinh thần”.

---

## 16. Customer Account Rules

### 16.1 Guest checkout

Nếu business cho phép guest checkout, không bắt login trước khi mua.

Nếu bắt login, phải có lý do rõ và UX tốt.

### 16.2 Account data

Customer account data phải bảo vệ:

- Password không bao giờ hiển thị.
- Không leak dữ liệu cá nhân.
- Admin chỉ thấy dữ liệu cần thiết theo quyền.
- Export/copy dữ liệu phải theo permission.

### 16.3 Password recovery

Password recovery không được leak thông tin nhạy cảm quá mức.

---

## 17. Contact / Support Rules

### 17.1 Contact channels

Public web nên hiển thị kênh liên hệ rõ nếu business có:

- Hotline.
- Zalo.
- Messenger.
- Store address.
- Contact form.

### 17.2 Contact form

Contact form nếu có phải:

- Validate dữ liệu.
- Có anti-spam nếu cần.
- Có success/error state.
- Không tạo ticket trùng lặp nếu submit nhiều lần.

### 17.3 Support ownership

Nếu support/ticket module tồn tại:

- Admin xử lý yêu cầu.
- Customer-facing reply/internal note phải phân biệt.
- Không gửi nhầm internal note cho khách.

---

## 18. Content / SEO Rules

### 18.1 Content source

Content public như blog/news/page/policy phải có trạng thái publish.

Không hiển thị draft.

### 18.2 SEO content rule

SEO content phải hữu ích, không spam keyword.

Mỗi SEO page cần:

- H1 rõ.
- Heading hierarchy.
- Internal links.
- Nội dung crawlable.
- Metadata nếu hệ thống hỗ trợ.

### 18.3 Content consistency

Thông tin business như bảo hành, đổi trả, khuyến mãi, giao hàng không được mâu thuẫn giữa:

- Homepage.
- PDP.
- Category page.
- Policy page.
- Checkout.
- Admin content.

---

## 19. Admin Operation Rules

### 19.1 Admin action authority

Admin action phải theo role/permission nếu có.

Không hiển thị hoặc cho thao tác với action người dùng không có quyền.

### 19.2 Audit-sensitive actions

Các action nên có audit/history nếu backend hỗ trợ:

- Change order status.
- Change payment state.
- Publish/unpublish product.
- Delete/archive product.
- Update price.
- Update promotion.
- Edit policy/content quan trọng.

### 19.3 Dangerous admin actions

Dangerous actions cần confirmation:

- Delete.
- Cancel order.
- Bulk update.
- Disable product/customer.
- Reset config.
- Publish/unpublish critical content nếu ảnh hưởng public website.

---

## 20. Privacy / Personal Data Rules

### 20.1 Data minimization

Chỉ thu dữ liệu cần thiết cho:

- Mua hàng.
- Giao hàng.
- Liên hệ.
- Hỗ trợ.
- Tuân thủ pháp lý nếu có.

### 20.2 Public privacy notice

Website phải có policy về dữ liệu cá nhân nếu thu:

- Tên.
- Số điện thoại.
- Email.
- Địa chỉ.
- Nội dung liên hệ.

### 20.3 Admin privacy

Admin UI không nên expose dữ liệu cá nhân quá mức.

Không log/display secret/token/password.

---

## 21. Validation Rules

### 21.1 Required fields

Required fields phải được define theo business context.

Không tự yêu cầu field không cần thiết.

### 21.2 Phone/email

Phone/email validation nên đủ chặt để tránh dữ liệu rác, nhưng không chặn quá mức nếu khách Việt Nam dùng nhiều format khác nhau.

### 21.3 Slug

Nếu có slug public:

- Slug phải unique trong scope phù hợp.
- Không dùng ký tự gây lỗi URL.
- Không đổi slug tùy tiện nếu ảnh hưởng SEO.
- Nếu đổi slug, cần redirect rule ở hạ tầng/SEO docs.

---

## 22. State Consistency Rules

### 22.1 Public state

Public website không hiển thị trạng thái nội bộ như `DRAFT`, `INTERNAL_REVIEW`, `DELETED`.

Public copy phải user-friendly:

- `Hết hàng`
- `Đang cập nhật`
- `Liên hệ tư vấn`
- `Đặt hàng trước`

### 22.2 Admin state

Admin có thể hiển thị trạng thái kỹ thuật/nghiệp vụ chi tiết hơn, nhưng vẫn phải có label rõ.

### 22.3 Unknown state

Nếu frontend nhận state không biết:

- Không crash.
- Hiển thị fallback neutral.
- Log/report nếu cần.
- Không tự map bừa thành success.

---

## 23. Non-goals

File này không định nghĩa:

- Exact API endpoint.
- Exact enum/database field.
- Exact UI component style.
- Shipping fee formula.
- Promotion calculation formula.
- Warranty approval algorithm.
- Payment gateway behavior.
- Role matrix chi tiết.

Những phần đó phải nằm ở tài liệu tương ứng.

---

## 24. AI Agent Rules

Khi AI agent làm việc với business logic BigBike:

1. Không tự phát minh business rule.
2. Nếu rule chưa rõ, đánh dấu `TBD` hoặc hỏi tài liệu nguồn.
3. Không hardcode rule phức tạp ở frontend nếu backend chưa enforce.
4. Không tự tạo order/payment/product status mới.
5. Không đổi claim bảo hành/đổi trả/khuyến mãi nếu chưa có xác nhận.
6. Không làm UI hiển thị thông tin mâu thuẫn với business docs.
7. Không xóa dữ liệu lịch sử nghiệp vụ nếu không có rule.
8. Không trộn business rules với design tokens.
9. Không trộn API contract vào business rules.
10. Khi sửa code nghiệp vụ, cập nhật docs liên quan.

---

## 25. Review Checklist

Trước khi merge tính năng nghiệp vụ:

- [ ] Rule liên quan đã có trong `BUSINESS_RULES.md` hoặc tài liệu nguồn.
- [ ] Frontend không tự quyết định rule backend chưa enforce.
- [ ] Không tạo status mới ngoài contract.
- [ ] Giá/tổng tiền được backend verify.
- [ ] Stock/variant validation đúng.
- [ ] Order transition hợp lệ.
- [ ] Payment state không bị trộn với order state.
- [ ] Warranty/return/promotion copy không mâu thuẫn.
- [ ] Dangerous admin action có confirmation.
- [ ] Dữ liệu cá nhân không bị expose quá mức.
- [ ] Empty/error/unknown state không làm app crash.
