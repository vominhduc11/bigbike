# BUSINESS_PROCESS.md

> Business process document cho BigBike.
>
> File này mô tả các quy trình nghiệp vụ end-to-end của hệ thống, từ khách hàng vào website đến admin vận hành.
>
> File này không định nghĩa UI token, API contract, database schema hoặc code implementation. Process là “việc đi từ A đến B”, không phải mọi con ốc trong chiếc xe.

---

## 1. Purpose

`BUSINESS_PROCESS.md` mô tả các quy trình nghiệp vụ chính của BigBike ở mức end-to-end.

File này trả lời:

- Quy trình bắt đầu từ đâu?
- Ai tham gia?
- Các bước lớn là gì?
- Điểm chuyển giao giữa web/admin/backend/vận hành nằm ở đâu?
- Kết quả mong muốn là gì?
- Những exception lớn nào cần xử lý?

File này không trả lời:

- Component UI cụ thể.
- API endpoint.
- Database table.
- Exact enum.
- Token style.
- Code.

---

## 2. Actors

### 2.1 Customer

Khách hàng cuối truy cập `bigbike-web` để:

- Xem sản phẩm.
- Tìm kiếm/lọc sản phẩm.
- Đọc bài tư vấn.
- Xem chính sách.
- Thêm giỏ hàng.
- Đặt hàng.
- Liên hệ tư vấn.

### 2.2 Admin / Operator

Người vận hành nội bộ dùng `bigbike-admin` để:

- Quản lý sản phẩm.
- Quản lý danh mục/brand nếu có.
- Quản lý đơn hàng.
- Cập nhật trạng thái.
- Quản lý nội dung.
- Xử lý hỗ trợ/liên hệ.
- Theo dõi vận hành.

### 2.3 System / Backend

Backend chịu trách nhiệm:

- Validate nghiệp vụ.
- Lưu dữ liệu.
- Tính/verify giá/tổng tiền.
- Quản lý trạng thái.
- Cung cấp API.
- Tích hợp dịch vụ ngoài nếu có.
- Bảo vệ dữ liệu và quyền truy cập.

### 2.4 Support / Sales staff

Nhân sự hỗ trợ/bán hàng có thể:

- Gọi xác nhận đơn.
- Tư vấn sản phẩm.
- Xác nhận thông tin giao hàng.
- Xử lý câu hỏi chính sách.
- Hỗ trợ bảo hành/đổi trả.

---

## 3. Process Map Overview

Các process chính:

1. Product discovery process.
2. Product detail decision process.
3. Cart and checkout process.
4. Manual/contact order process.
5. Admin order handling process.
6. Product catalog management process.
7. Content/SEO publishing process.
8. Promotion/campaign process.
9. Support/contact process.
10. Warranty/return process.
11. Data/privacy process.
12. Incident/content correction process.

---

## 4. Product Discovery Process

### 4.1 Goal

Giúp khách tìm được sản phẩm phù hợp nhanh nhất từ homepage, category, search, SEO article hoặc direct link.

### 4.2 Entry points

Khách có thể vào từ:

- Homepage.
- Google/Search.
- Category page.
- Product URL.
- Article/blog.
- Social link.
- Zalo/Messenger/share link.
- Campaign page nếu có.

### 4.3 Main flow

```text
Customer enters website
-> sees header/search/category navigation
-> chooses category/search/filter
-> scans product cards
-> opens product detail page
```

### 4.4 Required system behavior

Website phải hỗ trợ:

- Category navigation.
- Search.
- Filter/sort.
- Product card state.
- Empty/no result state.
- Internal links từ content sang product/category.

### 4.5 Exceptions

- Không có sản phẩm trong category.
- Search không có kết quả.
- Product image lỗi.
- Product đã hidden/unpublished.
- Network/API lỗi.

### 4.6 Success outcome

Khách tìm được sản phẩm/category/article phù hợp và tiếp tục vào PDP hoặc liên hệ.

---

## 5. Product Detail Decision Process

### 5.1 Goal

Giúp khách quyết định mua, thêm giỏ hoặc liên hệ tư vấn.

### 5.2 Main flow

```text
Customer opens PDP
-> reviews image/name/price/variant/stock
-> reads short benefits/specs/policy snippets
-> selects variant/quantity if required
-> clicks Add to cart / Buy now / Contact
```

### 5.3 Required information

PDP nên có:

- Tên sản phẩm.
- Ảnh/gallery.
- Giá.
- Sale state nếu có.
- Stock/preorder/out-of-stock state.
- Variant/quantity controls.
- CTA.
- Mô tả/thông số.
- Chính sách liên quan.
- Related products.

### 5.4 Decision points

- Sản phẩm có đủ thông tin không?
- Giá có rõ không?
- Còn hàng không?
- Có size/màu phù hợp không?
- Chính sách có tạo đủ tin tưởng không?
- Cần liên hệ tư vấn không?

### 5.5 Exceptions

- Chưa chọn variant required.
- Hết hàng.
- Product unavailable.
- Giá/tồn kho thay đổi.
- Add to cart lỗi.

### 5.6 Success outcome

Khách thêm sản phẩm vào cart, mua ngay hoặc liên hệ tư vấn.

---

## 6. Cart Process

### 6.1 Goal

Cho khách kiểm tra đơn tạm trước checkout.

### 6.2 Main flow

```text
Customer adds item to cart
-> opens cart
-> reviews items/quantity/price
-> updates quantity/removes item if needed
-> proceeds to checkout
```

### 6.3 Required behavior

Cart phải:

- Hiển thị item rõ.
- Cho cập nhật quantity.
- Cho remove item.
- Hiển thị subtotal/tạm tính.
- Báo lỗi nếu item không khả dụng.
- Giữ cart state ổn định.

### 6.4 Exceptions

- Empty cart.
- Quantity invalid.
- Product out of stock.
- Price changed.
- Network failure.

### 6.5 Success outcome

Cart hợp lệ và khách chuyển sang checkout.

---

## 7. Checkout Process

### 7.1 Goal

Thu thông tin cần thiết và tạo đơn hàng hợp lệ.

### 7.2 Main flow

```text
Customer opens checkout
-> enters contact information
-> enters shipping/address information if required
-> reviews order summary
-> selects payment/shipping method if available
-> submits order
-> backend validates cart/customer/price/stock
-> order is created
-> customer sees order success page
```

### 7.3 Required validation

- Contact info.
- Address/shipping info nếu required.
- Cart item availability.
- Variant/quantity.
- Price/totals.
- Payment/shipping method nếu required.

### 7.4 COD / confirmation process

Nếu đơn dùng COD hoặc shop gọi xác nhận:

```text
Order submitted
-> order is recorded as waiting confirmation/unpaid if applicable
-> shop/admin reviews order
-> shop contacts customer
-> customer confirms details
-> order proceeds to fulfillment flow
```

Tên trạng thái chính thức phải lấy từ data/business contract.

### 7.5 Exceptions

- Backend validation fail.
- Product/stock changed.
- Payment method unavailable.
- Network fail.
- Duplicate submit.
- Required field missing.

### 7.6 Success outcome

Đơn được tạo hợp lệ, khách biết bước tiếp theo, admin có thể xử lý.

---

## 8. Manual / Contact Order Process

### 8.1 Goal

Hỗ trợ khách đặt hàng hoặc hỏi mua qua hotline/Zalo/Messenger/comment/contact form.

### 8.2 Main flow

```text
Customer contacts shop
-> provides product interest/contact/shipping info
-> staff confirms product/price/availability
-> staff creates or records order if admin supports it
-> staff confirms delivery/payment process
```

### 8.3 Required behavior

Nếu hệ thống hỗ trợ nhập đơn thủ công:

- Admin phải nhập customer info.
- Admin phải chọn product/variant/quantity.
- Backend verify price/stock.
- Order source nên ghi nhận là manual/contact nếu contract có.

### 8.4 Exceptions

- Khách hỏi nhưng chưa đặt.
- Không đủ thông tin giao hàng.
- Sản phẩm hết hàng.
- Giá/tồn kho cần xác nhận lại.
- Duplicate customer/order.

### 8.5 Success outcome

Đơn thủ công được ghi nhận hoặc lead/support request được xử lý.

---

## 9. Admin Order Handling Process

### 9.1 Goal

Giúp admin xử lý đơn hàng từ lúc tạo đến hoàn tất/hủy.

### 9.2 Main flow concept

```text
New order received
-> admin reviews order details
-> admin contacts customer if needed
-> admin confirms order
-> admin prepares/fulfills order
-> admin updates shipping/processing state
-> order completes or is cancelled
```

Trạng thái chính thức phải lấy từ `DATA_CONTRACT.md`.

### 9.3 Admin responsibilities

Admin cần kiểm tra:

- Customer info.
- Product items.
- Quantity.
- Total.
- Payment state.
- Shipping/contact notes.
- Risk/exception flags nếu có.

### 9.4 Status change

Admin chỉ được chuyển trạng thái theo transition hợp lệ.

Không cho đổi trạng thái tùy tiện nếu backend/business không cho phép.

### 9.5 Exceptions

- Không liên hệ được khách.
- Khách muốn đổi sản phẩm/quantity.
- Sản phẩm hết hàng.
- Đơn bị hủy.
- Payment issue.
- Shipping issue.

### 9.6 Success outcome

Đơn được xử lý đúng trạng thái, có lịch sử rõ, không mất dữ liệu.

---

## 10. Product Catalog Management Process

### 10.1 Goal

Admin tạo/cập nhật sản phẩm để public website hiển thị đúng, bán được và SEO tốt.

### 10.2 Product creation flow

```text
Admin opens create product
-> enters basic info
-> uploads/selects media
-> sets price/category/brand
-> sets stock/visibility/publish state
-> adds description/specs/SEO info if available
-> saves draft or publishes
```

### 10.3 Product update flow

```text
Admin opens existing product
-> edits fields
-> saves changes
-> backend validates
-> public website updates if product is published
```

### 10.4 Publish flow

```text
Draft product
-> admin reviews required fields
-> admin publishes
-> product appears on public web
```

### 10.5 Exceptions

- Missing required field.
- Invalid price.
- Missing image.
- Duplicate slug/SKU.
- Upload fail.
- Product cannot publish due to validation.

### 10.6 Success outcome

Product data public-ready, consistent between admin and web.

---

## 11. Category / Brand Management Process

### 11.1 Goal

Giữ information architecture rõ cho browsing và SEO.

### 11.2 Main flow

```text
Admin creates/edits category or brand
-> sets name/slug/description/media if available
-> assigns products
-> publishes/enables
-> public web uses category/brand for navigation/filter/SEO
```

### 11.3 Exceptions

- Duplicate slug.
- Empty category.
- Category hidden but products still public.
- Category URL changed without redirect.

### 11.4 Success outcome

Category/brand giúp khách tìm sản phẩm và hỗ trợ SEO.

---

## 12. Content / SEO Publishing Process

### 12.1 Goal

Xuất bản nội dung SEO/tư vấn/chính sách rõ ràng và nhất quán.

### 12.2 Article/page flow

```text
Admin creates content
-> writes title/body/meta/slug
-> adds cover/media if needed
-> saves draft
-> previews
-> publishes
-> content appears on public web
```

### 12.3 Policy content flow

```text
Policy draft/update
-> review business/legal consistency
-> publish
-> public website links to policy page
-> related PDP/checkout snippets updated if needed
```

### 12.4 Exceptions

- Missing title/slug.
- Broken internal links.
- Outdated policy.
- Conflicting promotion/warranty/return copy.
- Draft accidentally public.

### 12.5 Success outcome

Content được publish đúng trạng thái, hỗ trợ SEO và không mâu thuẫn business rule.

---

## 13. Promotion / Campaign Process

### 13.1 Goal

Quản lý khuyến mãi/campaign nhất quán giữa banner, product card, PDP, cart và checkout.

### 13.2 Main flow

```text
Admin defines promotion/campaign
-> sets name/message/time range/scope if supported
-> configures visual/public placement if supported
-> reviews preview
-> publishes/activates
-> public web displays promotion consistently
-> promotion ends or is disabled
```

### 13.3 Required consistency

Promotion message phải nhất quán:

- Homepage banner.
- Category badge.
- PDP.
- Cart/checkout if applicable.
- Admin.

### 13.4 Exceptions

- Campaign expired but still visible.
- Product badge shows sale without sale price.
- Banner links to empty listing.
- Conflicting discount copy.

### 13.5 Success outcome

Khuyến mãi rõ, đúng thời gian, đúng sản phẩm, không gây hiểu nhầm.

---

## 14. Support / Contact Process

### 14.1 Goal

Ghi nhận và xử lý yêu cầu tư vấn/hỗ trợ của khách.

### 14.2 Public contact flow

```text
Customer submits contact form or clicks contact channel
-> system records request if form-based
-> admin/support reviews
-> staff replies or contacts customer
-> request is resolved/closed if module supports status
```

### 14.3 Support ticket flow if available

```text
Ticket created
-> admin assigns/handles
-> admin replies or adds internal note
-> status updates
-> customer receives response if customer-facing channel exists
```

### 14.4 Exceptions

- Spam.
- Missing contact info.
- Duplicate request.
- Attachment/media upload fail.
- Internal note accidentally sent publicly.

### 14.5 Success outcome

Khách được hỗ trợ, request có trạng thái rõ nếu hệ thống quản lý.

---

## 15. Warranty / Return Process

### 15.1 Goal

Xử lý yêu cầu bảo hành/đổi trả theo chính sách.

### 15.2 Warranty request concept

```text
Customer contacts shop
-> provides order/product/problem info
-> staff verifies eligibility
-> staff records request if admin supports it
-> request is approved/rejected/needs more info
-> resolution is completed
```

### 15.3 Return/exchange concept

```text
Customer requests exchange/return
-> staff checks policy eligibility
-> staff verifies product/order condition
-> admin records decision if supported
-> exchange/return is processed
```

### 15.4 Exceptions

- Không có order reference.
- Hết thời hạn.
- Sản phẩm không áp dụng chính sách.
- Thiếu ảnh/video/chứng cứ nếu cần.
- Customer info không đủ.

### 15.5 Success outcome

Yêu cầu được xử lý minh bạch, không mâu thuẫn policy.

---

## 16. Privacy / Data Handling Process

### 16.1 Customer data collection

Data được thu khi:

- Checkout.
- Register/login.
- Contact form.
- Support request.
- Newsletter nếu có.

### 16.2 Data handling flow

```text
Customer submits personal data
-> system validates and stores only needed data
-> admin uses data for order/support purpose
-> data is protected by access control
-> requests for deletion/export handled by policy/process if available
```

### 16.3 Required principle

- Không thu thừa.
- Không hiển thị thừa.
- Không expose password/secret.
- Không bán hoặc chia sẻ dữ liệu trái policy.

---

## 17. Incident / Correction Process

### 17.1 Goal

Xử lý lỗi nội dung, giá, trạng thái, sản phẩm hoặc policy public.

### 17.2 Main flow

```text
Issue detected
-> identify impacted page/data
-> determine business impact
-> fix source data/content/config
-> verify public page/admin state
-> add redirect/correction if SEO-impacting
-> document if recurring
```

### 17.3 Examples

- Giá sai.
- Banner sale sai.
- Product out of stock nhưng vẫn mua được.
- Policy mâu thuẫn.
- Link chết.
- Social login lỗi.
- Checkout submit fail.

### 17.4 Success outcome

Lỗi được sửa tại source, không chỉ patch visual bên ngoài.

---

## 18. Process Ownership

### 18.1 Product/catalog

Owner: Admin/operator/content/product owner.

### 18.2 Orders

Owner: Sales/admin/operator.

### 18.3 Content/SEO

Owner: Content/SEO/admin.

### 18.4 Support

Owner: Support/sales/admin.

### 18.5 System validation

Owner: Backend/system.

### 18.6 UI consistency

Owner: Frontend/design system.

---

## 19. Relationship With Other Docs

- `BUSINESS_RULES.md`: quy tắc nghiệp vụ.
- `BUSINESS_PROCESS.md`: quy trình end-to-end.
- `WORKFLOW.md`: workflow thao tác theo vai trò/trạng thái.
- `DATA_CONTRACT.md`: schema/model/status chính thức.
- `API_CONTRACT.md`: API behavior.
- `DESIGN_SYSTEM.md`: shared UI rules.
- `WEB_DESIGN.md`: public web UX.
- `ADMIN_DESIGN.md`: admin UX.

---

## 20. AI Agent Rules

Khi AI agent sửa process hoặc code liên quan process:

1. Không tự thêm bước nghiệp vụ nếu chưa có rule.
2. Không tự tạo trạng thái mới.
3. Không biến process thành API contract.
4. Không biến process thành UI layout.
5. Nếu process thay đổi, kiểm tra ảnh hưởng tới web/admin/backend.
6. Nếu process có exception, phải có state/error handling.
7. Nếu liên quan SEO URL, phải kiểm tra redirect/canonical docs nếu có.
8. Nếu liên quan dữ liệu cá nhân, phải kiểm tra privacy rules.

---

## 21. Phase 2 Legacy-Normalized Processes

This section translates sanitized legacy WordPress discovery into migration-aware process contracts. It does not authorize implementation work or raw data import.

### 21.1 Legacy discovery before implementation

Before product, order, content, auth, route, media, or SEO implementation:

```text
Read docs/legacy
-> update affected contract
-> answer or record Open Questions
-> only then implement app code in a later phase
```

If a legacy behavior is not documented in sanitized docs, extend sanitized discovery first.

### 21.2 Product/catalog migration process

```text
Read legacy product/category/brand model
-> define canonical Product/Category/Brand/Attribute/Variant fields
-> map media paths to new storage contract
-> preserve legacy public slugs
-> identify unsupported fields as TBD
-> implement import only in a later phase
```

Admin responsibilities after implementation:

- Maintain product name, slug, price, stock, media, categories, brands, variants, SEO, and publish status.
- Avoid hard-delete for products linked to orders.
- Keep category/brand route changes tied to redirect updates.

### 21.3 Content/page/news migration process

```text
Read legacy page slugs and template usage
-> map pages, news posts, homepage blocks, sliders, and videos
-> preserve `/tin-tuc/{slug}.html` unless SEO plan changes
-> sanitize HTML and media references
-> update SEO metadata and internal links
```

Policy pages for warranty, return, privacy, terms, and buying guides must remain discoverable after rebuild.

### 21.4 Cart, checkout, and order process

Legacy cart AJAX maps to new cart APIs. Legacy quick-buy maps to a dedicated quick-buy order flow if approved.

```text
Customer selects product/variant
-> backend validates product, variant, stock, and price
-> cart stores canonical item state
-> checkout collects contact/shipping/payment data
-> backend verifies totals and creates order snapshot
-> order waits for confirmation for COD/manual flows
-> admin confirms, processes, ships, completes, or cancels
```

No order process may depend on live product/customer data alone for history rendering.

### 21.5 COD/manual confirmation process

```text
Order submitted
-> payment status remains unpaid/pending according to method
-> order status is pending confirmation
-> sales/admin contacts customer if required
-> admin confirms or cancels
-> fulfillment continues after confirmation
```

The observed quick-buy shipping fee behavior is not canonical until business confirms it.

### 21.6 Warranty, return, sale-no-warranty, backorder, preorder

Process stance for Phase 2:

- Warranty and return flows are policy/support processes until implementation is scoped.
- Sale-no-warranty must be explicit content/data, never inferred from sale price.
- Backorder/preorder must be explicit stock state, never inferred from missing stock.
- Customer-facing copy must be shown before checkout if these rules affect the purchase decision.

### 21.7 Auth/account/recovery/social process

Legacy account behavior supports register, login, profile update, password change/recovery, and WooCommerce account pages.

New process requirements:

- Decide whether phone, email, or both are identity fields.
- Keep password recovery messages safe.
- Treat social login as TBD until live behavior is verified.
- Never migrate raw password hashes into repo artifacts.

### 21.8 Data migration process constraints

```text
Local legacy source/dump
-> read-only structural inspection
-> sanitizer
-> schema-only or PII-free artifact
-> contract update
-> later import implementation
```

Do not commit raw SQL, WordPress source, uploads, customer data, order data, user data, tokens, sessions, or secrets.

### 21.9 Open Questions

- Which team owns final warranty/return policy text?
- Is quick-buy a real checkout path in the new stack or a lead/contact flow?
- Does BigBike want guest checkout or account-required checkout?
- Should Polylang translations be migrated now or deferred?
- Which system owns redirects: app backend, edge middleware, or hosting/CDN config?

---

## 22. Process Review Checklist

- [ ] Process có actor rõ.
- [ ] Entry point rõ.
- [ ] Main flow rõ.
- [ ] Backend validation point rõ.
- [ ] Admin/customer handoff rõ nếu có.
- [ ] Exception lớn được liệt kê.
- [ ] Success outcome rõ.
- [ ] Không invent enum/API/schema.
- [ ] Không mâu thuẫn `BUSINESS_RULES.md`.
- [ ] Không duplicate UI layout chi tiết.
