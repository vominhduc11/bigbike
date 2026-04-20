# WEB_DESIGN.md

> Public website UX/UI guideline cho `bigbike-web`.
>
> Mục tiêu của `bigbike-web`: website bán hàng và SEO cho khách hàng cuối của BigBike. Giao diện phải giúp khách khám phá sản phẩm, tin tưởng thương hiệu, đọc nội dung tư vấn, vào PDP, thêm giỏ hàng / mua ngay / liên hệ và hoàn tất luồng mua hàng rõ ràng.
>
> File này phải bám theo:
> - `docs/brand/BRAND_GUIDELINES.md`
> - `docs/design/DESIGN_SYSTEM.md`
> - `docs/tokens/WEB_DESIGN_TOKENS.md`
>
> File này không định nghĩa backend API, database schema, business rules chi tiết hoặc admin dashboard UX. Website bán hàng không cần biến thành cái bảng điều khiển phi thuyền, cảm ơn.

---

## 1. Purpose

`WEB_DESIGN.md` là tài liệu thiết kế riêng cho `bigbike-web`, tập trung vào public website / customer-facing website.

Website này phục vụ:

- Khách hàng cuối tìm mua đồ bảo hộ moto và phụ kiện biker.
- Người dùng vào từ Google/Search/SEO.
- Người dùng vào từ social, Zalo, Messenger, ads hoặc giới thiệu.
- Người dùng cần xem sản phẩm, giá, thương hiệu, tình trạng hàng, chính sách, hướng dẫn mua hàng.
- Người dùng cần tin tưởng trước khi đặt hàng hoặc liên hệ shop.

File này chịu trách nhiệm cho:

- UX/UI cho public website.
- Homepage, category/listing, product detail, cart/checkout, content/SEO page.
- Product discovery.
- Conversion flow.
- Trust signals.
- SEO-friendly content layout.
- Responsive/mobile-first rules.
- Visual direction cho brand-facing web.
- State design riêng cho web commerce.

File này không cover:

- Admin dashboard UX.
- Backend/API contract.
- Database model.
- Business rule chi tiết như tính phí ship, trạng thái đơn, bảo hành theo từng loại sản phẩm.
- Token implementation cụ thể.
- Source asset inventory chi tiết.

Boundary:

- Brand identity: `docs/brand/BRAND_GUIDELINES.md`
- Shared UI rulebook: `docs/design/DESIGN_SYSTEM.md`
- Web-specific design: `docs/design/WEB_DESIGN.md`
- Web implementation tokens: `docs/tokens/WEB_DESIGN_TOKENS.md`
- Admin-specific design: `docs/design/ADMIN_DESIGN.md`
- Business behavior: `BUSINESS_RULES.md`
- API behavior: `API_CONTRACT.md`
- Data contract: `DATA_CONTRACT.md`

---

## 2. Website Design Goals

### 2.1 SEO-first commerce

`bigbike-web` phải vừa là website bán hàng, vừa là hệ thống SEO/content commerce.

Thiết kế phải hỗ trợ:

- Crawlable pages.
- Semantic headings.
- Internal linking.
- Category SEO copy.
- Product detail rich content.
- Blog/news/article content.
- Fast loading.
- Mobile-first browsing.
- Product discovery từ search engines.

Không render nội dung quan trọng chỉ bằng image/canvas nếu làm giảm SEO.

### 2.2 Product discovery

Người dùng phải tìm sản phẩm nhanh bằng:

- Navigation rõ.
- Category rõ.
- Search box dễ thấy.
- Filter/sort dễ dùng.
- Product cards dễ scan.
- Product detail đủ thông tin.
- Related/recommended products.

Với catalog nhiều SKU, chỉ dựa vào menu là không đủ. Website bán hàng mà không có search tốt thì giống cửa hàng bắt khách tự mò từng kệ trong bóng tối, rất nghệ thuật nhưng ít doanh thu.

### 2.3 Conversion clarity

Mọi page commerce phải hướng đến hành động rõ:

- Xem sản phẩm.
- Xem chi tiết.
- Thêm vào giỏ.
- Mua ngay.
- Liên hệ tư vấn.
- Xem chính sách.
- Hoàn tất checkout.

CTA phải rõ, đúng thứ tự ưu tiên, không bị chìm trong decoration.

### 2.4 Trust-building

Khách hàng mua đồ bảo hộ moto cần tin tưởng về:

- Sản phẩm thật.
- Thương hiệu rõ.
- Chính sách bảo hành.
- Đổi trả.
- Giao hàng.
- COD / thanh toán.
- Shop có địa chỉ/liên hệ.
- Review/feedback nếu có.
- Nội dung tư vấn có chuyên môn.

Trust block phải xuất hiện ở đúng nơi, đặc biệt trên homepage, PDP, checkout và policy pages.

### 2.5 Mobile-first

Nhiều khách sẽ vào bằng mobile. Website phải:

- Load nhanh.
- Header gọn.
- Search dễ dùng.
- Product card dễ đọc.
- Filter không che nội dung.
- CTA dễ bấm.
- Checkout form dễ nhập.
- Không bắt pinch zoom như đang khảo cổ web 2010.

---

## 3. Brand Application for Web

### 3.1 Visual mood

`bigbike-web` là nơi brand được thể hiện mạnh nhất.

Mood:

- Bold
- Fast
- Sporty
- Mechanical
- Biker-focused
- Rugged but professional
- Commercially clear

Không đi theo hướng:

- Generic template.
- Cute/pastel.
- Corporate nhạt.
- Fashion luxury mềm.
- Neon/cyberpunk không kiểm soát.
- Quá nhiều effect làm chậm page.

### 3.2 Color usage

BigBike Red `#F90606` dùng cho:

- Primary CTA.
- Price highlight.
- Sale badge.
- Active nav.
- Focus state.
- Campaign accent.
- Urgent/promotion blocks.
- Important action.

Black/dark gray dùng cho:

- Header.
- Hero.
- Footer.
- Product spotlight.
- Campaign sections.
- Brand-heavy sections.

Supporting colors dùng tiết chế cho:

- Campaign accent.
- Category visual.
- Info/success/warning states.
- Seasonal highlight.

Không dùng red full-screen liên tục. Red là accent mạnh, không phải sơn tường toàn bộ website.

### 3.3 Typography

Web dùng:

- `Bungee` cho hero headline, campaign headline, brand display, short impact copy.
- `Exo` cho body, navigation, product text, article content, forms, filters, checkout.

Rules:

- H1/H2 campaign có thể dùng Bungee.
- Product name, description, price detail dùng Exo.
- Article content dùng Exo để đọc lâu không mỏi.
- Không dùng Bungee cho paragraph dài hoặc product specs.

### 3.4 Image direction

Ảnh nên có:

- Biker / motorcycle lifestyle.
- Gear protection.
- Touring, road, garage, asphalt.
- Helmet, gloves, jacket, armor, intercom, accessories.
- Sản phẩm rõ, sắc, đúng màu.
- Contrast cao nhưng không phá text.

Không dùng ảnh quá stock, quá sạch corporate hoặc ảnh nền rối làm chìm sản phẩm.

### 3.5 Icon and logo

Logo/icon rules lấy từ `BRAND_GUIDELINES.md`.

Trong web:

- Header logo rõ.
- Favicon đúng brand.
- Footer logo có đủ contrast.
- Icon category cùng style.
- Icon trust block dễ hiểu.
- Không mix nhiều icon set lệch style.

---

## 4. Global Website Structure

### 4.1 Required public surfaces

Tùy scope thực tế, `bigbike-web` nên có các surface chính:

- Homepage.
- Product catalog.
- Category pages.
- Product detail pages.
- Search result page.
- Cart.
- Checkout.
- Order success / thank you page.
- Blog/news/content listing.
- Blog/news/article detail.
- About page.
- Contact page.
- Policy/help pages.
- Account/login/register nếu có.
- 404 / error pages.

Không bắt buộc làm tất cả cùng lúc nếu scope chưa có, nhưng khi có route thì phải theo guideline.

### 4.2 Header

Header phải hỗ trợ discovery và conversion.

Nên có:

- Logo.
- Main navigation.
- Product categories.
- Search.
- Cart entry.
- Account/contact entry nếu có.
- Hotline/Zalo/Messenger shortcut nếu phù hợp.
- Mobile menu.

Rules:

- Header phải rõ trên desktop và mobile.
- Active nav state rõ.
- Search không bị giấu quá sâu.
- Cart count rõ.
- Sticky header chỉ dùng nếu không chiếm quá nhiều viewport.
- Header dark-first phù hợp brand.

### 4.3 Footer

Footer là trust/navigation area.

Nên có:

- Logo.
- Short brand description.
- Contact info.
- Store address nếu có.
- Hotline/Zalo/Messenger/social links nếu có.
- Category links.
- Policy links.
- Payment/shipping/support links.
- Copyright year dynamic.

Không để footer lỗi thời, sai năm, sai contact hoặc link chết. Footer sai làm trust rơi khá nhanh, kiểu nhìn shop còn sống hay không cũng khó biết.

### 4.4 Mobile navigation

Mobile navigation phải:

- Dễ mở/đóng.
- Có category rõ.
- Có search dễ dùng.
- Có cart visible.
- Không che mất CTA quan trọng nếu đang ở PDP/cart.
- Không tạo menu nhiều cấp khó back.

---

## 5. Homepage Design

### 5.1 Homepage goal

Homepage phải trả lời nhanh:

1. BigBike là ai?
2. Bán gì?
3. Có gì nổi bật?
4. Vì sao nên tin?
5. Khách nên bấm vào đâu tiếp?

Homepage không chỉ là banner đẹp. Nó là entry point để dẫn khách vào product/category/PDP.

### 5.2 Homepage section hierarchy

Thứ tự section khuyến nghị:

1. Hero / campaign spotlight.
2. Category shortcuts.
3. Featured products / best sellers.
4. Promotion / sale block nếu có.
5. New arrivals hoặc recommended products.
6. Trust/service benefits.
7. Brand/story/lifestyle block.
8. SEO intro content.
9. Latest articles/news.
10. Contact/support block.
11. Footer.

Không cần tất cả section nếu content chưa đủ. Nhưng khi có section, mỗi section phải có mục tiêu rõ.

### 5.3 Hero section

Hero nên có:

- Strong headline.
- Short subcopy.
- Primary CTA.
- Secondary CTA nếu cần.
- Product/lifestyle image.
- Dark/rugged background.
- Red accent có kiểm soát.

CTA examples:

- `Shop helmets`
- `Explore riding gear`
- `View promotions`
- `Contact BigBike`

Hero không nên:

- Chỉ có ảnh đẹp nhưng không có CTA.
- Dùng text trên ảnh quá rối.
- Load video quá nặng làm chậm LCP.
- Dùng slider nhiều banner nếu không có lý do rõ.

### 5.4 Category shortcuts

Category shortcuts giúp khách đi nhanh vào nhóm sản phẩm.

Mỗi category card nên có:

- Icon/thumbnail.
- Category name.
- Optional short description.
- Link rõ.

Category examples:

- Mũ bảo hiểm.
- Áo/quần bảo hộ.
- Găng tay.
- Giày bảo hộ.
- Balo/túi treo xe.
- Giáp bảo hộ.
- Tai nghe Bluetooth/intercom.
- Phụ kiện khác.

### 5.5 Featured products

Featured products phải thể hiện:

- Product image.
- Product name.
- Price.
- Sale/discount nếu có.
- Stock/preorder state nếu relevant.
- CTA/link.

Không nhồi quá nhiều sản phẩm trên homepage nếu làm giảm focus.

### 5.6 Trust/service benefits

Trust block nên có:

- Chính hãng / nguồn gốc rõ nếu có.
- Bảo hành.
- Đổi trả.
- COD / thanh toán.
- Giao hàng.
- Tư vấn chọn size/chọn gear.
- Store/showroom/contact.

Không ghi claim không được business docs xác nhận.

### 5.7 SEO intro content

Homepage có thể có SEO intro nhưng không nên biến thành bài văn dài ngay đầu trang.

Rules:

- SEO content đặt sau commercial sections chính.
- Có heading semantic.
- Copy hữu ích, không spam keyword.
- Internal links tới category/content liên quan.

---

## 6. Product Listing & Category Pages

### 6.1 Category page goal

Category page phải vừa bán hàng, vừa hỗ trợ SEO.

Nó cần:

- H1 rõ.
- Category intro ngắn.
- Product grid.
- Search/filter/sort.
- SEO content bổ sung.
- Internal links.
- Empty/filter state.
- Pagination hoặc load more nếu cần.

### 6.2 Category header

Category header nên có:

- Breadcrumbs.
- H1 category.
- Short description.
- Optional category hero image.
- Count sản phẩm nếu có.

Không dùng header quá lớn khiến product grid bị đẩy xuống quá sâu trên mobile.

### 6.3 Product grid

Product grid phải:

- Responsive.
- Product image rõ.
- Card size ổn định.
- Giá dễ đọc.
- Product name không bị cắt quá khó hiểu.
- Badge không che ảnh.
- CTA hoặc click target rõ.

Desktop có thể nhiều columns. Mobile ít columns, ưu tiên readability.

### 6.4 Product card content

Product card nên có:

- Image.
- Brand/category nếu hữu ích.
- Product name.
- Price.
- Compare price nếu sale.
- Sale badge nếu có.
- Stock/preorder label nếu relevant.
- Rating/review nếu có.
- CTA hoặc quick action nếu phù hợp.

Không nhồi specs dài vào card.

### 6.5 Filter

Filter nên hỗ trợ:

- Category/subcategory.
- Brand.
- Price range.
- Size/color nếu relevant.
- Stock state nếu có.
- Promotion/sale nếu có.
- Sort.

Rules:

- Mobile filter dùng drawer/bottom sheet.
- Desktop filter có sidebar hoặc toolbar rõ.
- Có reset filter.
- Active filters hiển thị rõ.
- Filter không làm mất scroll/context một cách khó chịu.

### 6.6 Sort

Sort options phổ biến:

- Newest.
- Popular.
- Price low to high.
- Price high to low.
- Sale/discount nếu có.

Không đưa quá nhiều sort nếu không có data thật.

### 6.7 Search within listing

Search nên:

- Dễ thấy.
- Có placeholder cụ thể.
- Có clear button.
- Có no result state.
- Không reset filter vô lý nếu user search trong category.

### 6.8 Empty listing state

Phân biệt:

- Category chưa có sản phẩm.
- Không có kết quả do filter/search.
- Load lỗi.

Ví dụ:

```text
Không tìm thấy sản phẩm phù hợp.
Hãy thử bỏ bớt bộ lọc hoặc tìm bằng từ khóa khác.
[Reset filters]
```

### 6.9 SEO content on category pages

SEO content nên có:

- H2/H3 semantic.
- Tư vấn chọn sản phẩm.
- Link nội bộ tới category/product/article liên quan.
- FAQ nếu phù hợp.
- Nội dung thật sự hữu ích.

Không spam keyword. Google không cần thêm một bãi chữ “mũ bảo hiểm mũ bảo hiểm mũ bảo hiểm” như bùa chú.

---

## 7. Search Experience

### 7.1 Global search

Global search nên có trong header.

Search phải hỗ trợ:

- Product name.
- SKU/model nếu có.
- Brand/category nếu có.
- Suggestions nếu có.
- Empty state.
- Error state.

### 7.2 Search result page

Search result page nên có:

- Query visible.
- Result count.
- Product grid/list.
- Filters/sort.
- Suggested categories/articles nếu không có result.
- Breadcrumb hoặc back context.

### 7.3 Search suggestions

Nếu có autocomplete:

- Hiển thị sản phẩm nổi bật.
- Hiển thị category suggestion.
- Không quá chậm.
- Keyboard accessible.
- Không che toàn màn hình trên desktop nếu không cần.

### 7.4 No result

No-result state nên gợi ý:

- Kiểm tra chính tả.
- Thử từ khóa ngắn hơn.
- Xem category phổ biến.
- Liên hệ tư vấn nếu phù hợp.

---

## 8. Product Detail Page

### 8.1 PDP goal

PDP phải giúp khách quyết định mua hoặc liên hệ tư vấn.

PDP cần trả lời:

1. Sản phẩm là gì?
2. Có đúng loại/size/màu/variant không?
3. Giá bao nhiêu?
4. Còn hàng không?
5. Có khuyến mãi không?
6. Bảo hành/đổi trả/giao hàng thế nào?
7. Vì sao nên tin?
8. Hành động tiếp theo là gì?

### 8.2 PDP layout

PDP desktop khuyến nghị:

```text
Breadcrumbs
Product media gallery | Product summary / price / CTA
Trust/service strip
Product details/specifications
Description/content
Related products
Recently viewed / recommendations if available
```

Mobile:

```text
Breadcrumbs
Product gallery
Product summary
Sticky buy/contact action if appropriate
Details/specs accordion
Related products
```

### 8.3 Product media gallery

Gallery phải:

- Ảnh rõ, đúng tỷ lệ.
- Có thumbnail.
- Có zoom/lightbox nếu phù hợp.
- Có fallback khi ảnh lỗi.
- Có video nếu có nhưng không autoplay phá trải nghiệm.
- Không crop mất sản phẩm chính.

Ảnh đầu tiên nên là cover/product image tốt nhất.

### 8.4 Product summary

Product summary nên có:

- Brand/category nếu hữu ích.
- Product name.
- Rating/review nếu có.
- Price.
- Compare price/sale nếu có.
- Stock/preorder state.
- Variant selector.
- Quantity selector.
- Primary CTA.
- Secondary CTA.
- Short benefits.
- Contact/help link.

CTA hierarchy:

- Primary: `Mua ngay` hoặc `Thêm vào giỏ`.
- Secondary: `Liên hệ tư vấn`, `Xem chính sách`, `Thêm vào yêu thích` nếu có.

### 8.5 Variant selector

Variant selector phải:

- Rõ option.
- Disabled option nếu không available.
- Hiển thị selected state.
- Báo lỗi nếu user chưa chọn required option.
- Không chỉ dựa vào màu, đặc biệt với color swatches.

### 8.6 Quantity selector

Quantity selector phải:

- Dễ bấm trên mobile.
- Không cho số âm/invalid.
- Có limit nếu stock/business rule cung cấp.
- Có loading/disabled state nếu đang update cart.

### 8.7 Stock/preorder/out-of-stock state

Stock state phải có text rõ, không chỉ dùng màu.

Examples:

- `Còn hàng`
- `Sắp hết hàng`
- `Hết hàng`
- `Hàng đặt trước`
- `Liên hệ để kiểm tra hàng`

Không tự invent business state. Label thật phải bám business/data contract.

### 8.8 Trust information on PDP

PDP nên có trust/service block gần CTA:

- Bảo hành.
- Đổi trả.
- Giao hàng.
- COD/thanh toán.
- Tư vấn size/sản phẩm.
- Hotline/Zalo/Messenger.

Chỉ hiển thị claim đã được business docs xác nhận.

### 8.9 Product specs

Specs phải dễ đọc:

- Table hoặc definition list.
- Group specs nếu nhiều.
- Không trộn mô tả marketing với thông số kỹ thuật.
- Mobile readable.

### 8.10 Product description

Description nên có:

- Nội dung giải thích lợi ích.
- Ảnh/video nếu hữu ích.
- Heading semantic.
- Không dùng ảnh chứa toàn bộ text quan trọng.
- Internal links tới content/category liên quan.

### 8.11 Related products

Related products nên:

- Có logic rõ nếu backend cung cấp.
- Không quá nhiều.
- Product cards consistent.
- Không làm chậm PDP quá mức.

---

## 9. Cart UX

### 9.1 Cart goal

Cart phải giúp khách kiểm tra sản phẩm và chuyển sang checkout nhanh.

Cart cần:

- Product list.
- Image/name/variant.
- Price.
- Quantity control.
- Subtotal.
- Remove action.
- Promotion/discount nếu có.
- Shipping/payment hint nếu có.
- Checkout CTA.

### 9.2 Cart item

Cart item phải rõ:

- Product image.
- Product name.
- Selected variant.
- Unit price.
- Quantity.
- Line total.
- Remove/edit action.

Không dùng icon-only remove nếu không có accessible label.

### 9.3 Cart summary

Cart summary nên có:

- Subtotal.
- Discount nếu có.
- Shipping estimate nếu có.
- Total hoặc estimated total.
- Primary CTA `Checkout` / `Tiến hành đặt hàng`.
- Policy hints.

Không hiển thị total mơ hồ nếu shipping chưa tính. Ghi rõ `Tạm tính` nếu chưa đủ dữ liệu.

### 9.4 Empty cart

Empty cart phải có:

- Message rõ.
- Link về catalog/category.
- Optional featured products.

Ví dụ:

```text
Giỏ hàng đang trống.
Khám phá sản phẩm bảo hộ và phụ kiện biker tại BigBike.
[Tiếp tục mua sắm]
```

### 9.5 Cart update states

Cart phải handle:

- Updating quantity.
- Remove item loading.
- Stock changed.
- Price changed.
- Item unavailable.
- Network failure.

Không silently fail khi update cart.

---

## 10. Checkout UX

### 10.1 Checkout goal

Checkout phải giảm friction và tăng trust.

Checkout cần:

- Customer/contact info.
- Shipping/address info.
- Order items summary.
- Payment method.
- Shipping method/info nếu có.
- Policy confirmation nếu required.
- Final submit action.
- Loading/error/success states.

### 10.2 Checkout layout

Desktop:

```text
Form fields / customer info | Order summary
Shipping/payment section     | Sticky summary
Final confirmation           |
```

Mobile:

```text
Order summary collapsible
Customer/contact form
Shipping/payment form
Final total
Submit CTA
```

### 10.3 Form design

Checkout form phải:

- Label visible.
- Required fields rõ.
- Validation near field.
- Input type phù hợp: phone/email/address.
- Không quá nhiều optional fields.
- Preserve input khi submit lỗi.

### 10.4 Order summary

Order summary phải:

- Dễ kiểm tra.
- Product item rõ.
- Quantity/variant/price rõ.
- Total/tạm tính rõ.
- Shipping/payment note rõ nếu có.

### 10.5 COD / manual confirmation UX

Nếu checkout có COD hoặc shop gọi xác nhận:

- Nói rõ quy trình sau khi đặt hàng.
- Nói rõ khách sẽ được liên hệ.
- Không làm khách tưởng đã thanh toán online nếu chưa có payment online.
- Hiển thị hotline/Zalo nếu cần.

### 10.6 Submit state

Submit order button phải:

- Disable khi đang submit.
- Hiển thị loading.
- Không cho double-submit.
- Có error message nếu fail.
- Không xóa form khi fail.

### 10.7 Checkout trust

Checkout cần trust elements gần form/summary:

- Secure checkout wording nếu phù hợp.
- Chính sách đổi trả.
- Bảo hành.
- Giao hàng/COD.
- Contact support.

Không nhồi quá nhiều link khiến checkout bị xao nhãng.

---

## 11. Order Success / Thank You Page

### 11.1 Goal

Order success page phải xác nhận rõ đơn hàng đã được ghi nhận và hướng dẫn bước tiếp theo.

Nên có:

- Success title.
- Order code nếu có.
- Summary.
- Next steps.
- Contact support.
- Continue shopping CTA.
- Related products optional.

### 11.2 Next steps

Copy nên rõ:

```text
BigBike đã ghi nhận đơn hàng. Shop sẽ liên hệ để xác nhận thông tin và phương thức giao hàng.
```

Không dùng message mơ hồ như `Done`.

### 11.3 Trust continuation

Có thể hiển thị:

- Hotline/Zalo.
- Chính sách mua hàng.
- Link theo dõi đơn nếu có.
- Email/SMS note nếu backend hỗ trợ.

Không invent tracking nếu hệ thống chưa có.

---

## 12. Content / SEO Pages

### 12.1 Content strategy

Content pages hỗ trợ SEO và tư vấn mua hàng.

Nội dung nên xoay quanh:

- Tư vấn chọn mũ bảo hiểm.
- Tư vấn chọn áo/quần/găng/giày bảo hộ.
- So sánh sản phẩm.
- Hướng dẫn sử dụng/bảo quản.
- Biker lifestyle/touring.
- Chính sách mua hàng/bảo hành/đổi trả.
- Tin tức sản phẩm/campaign.

### 12.2 Article listing

Article listing nên có:

- Page title.
- Category filter nếu có.
- Search nếu nhiều bài.
- Article cards.
- Pagination.
- Empty state.

Article card nên có:

- Thumbnail.
- Title.
- Excerpt.
- Publish date.
- Category/tag.
- Link.

### 12.3 Article detail

Article detail phải:

- Có H1 rõ.
- Có publish/update date nếu có.
- Có author nếu có.
- Có table of contents nếu bài dài.
- Có semantic H2/H3.
- Có hình ảnh tối ưu.
- Có internal links.
- Có related articles/products nếu phù hợp.
- Có CTA mềm về category/product/contact.

Không đặt toàn bộ bài viết trong ảnh.

### 12.4 Policy/help pages

Policy pages cần:

- Heading rõ.
- Nội dung dễ scan.
- Section heading.
- Contact/help CTA.
- Last updated nếu có.
- Không dùng language quá mơ hồ.

Các policy quan trọng:

- Hướng dẫn mua hàng.
- Hướng dẫn mua hàng online.
- Chính sách bảo hành.
- Chính sách đổi trả.
- Chính sách bảo vệ dữ liệu cá nhân.
- Điều kiện và điều khoản.

### 12.5 SEO readability

SEO content phải:

- Dùng heading semantic.
- Paragraph ngắn.
- List/table khi hữu ích.
- Internal links tự nhiên.
- Không spam keyword.
- Không duplicate nội dung hàng loạt.

---

## 13. About / Contact / Trust Pages

### 13.1 About page

About page phải giúp khách tin shop.

Nên có:

- BigBike story.
- Ngành hàng/specialty.
- Store/showroom info nếu có.
- Brand values.
- Product/service focus.
- Images thật nếu có.
- Contact CTA.

Không viết about page chung chung kiểu “chúng tôi luôn nỗ lực mang đến giá trị tốt nhất”. Internet đã chịu đủ rồi.

### 13.2 Contact page

Contact page phải có:

- Address.
- Phone/hotline.
- Zalo/Messenger/social links nếu có.
- Map nếu có.
- Opening hours nếu có.
- Contact form nếu có.
- Support copy rõ.

### 13.3 Store/location trust

Nếu có cửa hàng vật lý:

- Hiển thị địa chỉ rõ.
- Map dễ dùng.
- Ảnh showroom nếu có.
- Parking/arrival note nếu relevant.
- Hotline visible.

---

## 14. Account / Auth Public UX

### 14.1 Login/register

Nếu public website có account:

- Login/register form phải đơn giản.
- Label visible.
- Error message rõ.
- Forgot password link rõ.
- Social login nếu có phải hoạt động nhất quán.
- Privacy/policy links nếu thu data.

### 14.2 Password recovery

Forgot password flow phải:

- Có hướng dẫn rõ.
- Không leak account existence quá mức nếu security policy yêu cầu.
- Có success state.
- Có resend/retry state.

### 14.3 Account page

Nếu có customer account:

- Profile info.
- Order history nếu có.
- Address book nếu có.
- Password/security settings nếu có.
- Logout rõ.

Không hiển thị raw technical state hoặc backend errors.

---

## 15. SEO Technical UX Rules

### 15.1 Semantic structure

Mỗi page phải có:

- Một H1 chính.
- H2/H3 theo hierarchy.
- Breadcrumbs khi phù hợp.
- Meaningful links.
- Text crawlable.

Không dùng heading chỉ vì muốn style to hơn. Style dùng CSS/token, heading dùng semantic.

### 15.2 Metadata

Page cần metadata phù hợp:

- Title.
- Meta description.
- Canonical nếu cần.
- Open Graph image.
- Product/category/article metadata nếu có.
- Structured data nếu backend/content hỗ trợ.

Chi tiết implementation thuộc SEO/technical docs nếu có, nhưng UI phải không cản trở.

### 15.3 URL and internal linking

UX phải hỗ trợ URL rõ:

- Category URL stable.
- Product URL stable.
- Article URL stable.
- Breadcrumb links.
- Related content/product links.

Không đổi URL tùy hứng vì SEO không thích trò roulette.

### 15.4 Image SEO

Images cần:

- Alt text hữu ích.
- File size tối ưu.
- Responsive image.
- Lazy loading cho below-the-fold.
- Priority image cho hero/PDP main image nếu cần.

### 15.5 Performance and Core Web Vitals

Web design phải để ý:

- LCP.
- CLS.
- INP.
- Image size.
- Font loading.
- Heavy animation/video.
- Third-party scripts.

Không dùng hero video quá nặng nếu làm chết performance. Đẹp mà chậm thì khách đã rời đi trước khi “wow”.

---

## 16. Responsive & Mobile Rules

### 16.1 Mobile-first

Public web phải thiết kế mobile-first.

Mobile ưu tiên:

- Header gọn.
- Search dễ thấy.
- Category navigation dễ dùng.
- Product cards readable.
- Sticky CTA trên PDP nếu phù hợp.
- Cart/checkout form dễ nhập.
- Touch target đủ lớn.

### 16.2 Desktop enhancement

Desktop có thể bổ sung:

- Larger hero.
- Multi-column grids.
- Sidebar filter.
- Rich product gallery.
- Sticky summary.
- More content sidebars.

Không được để desktop tốt nhưng mobile tệ. Mobile tệ là cách donate traffic cho đối thủ.

### 16.3 Product grid breakpoints

Product grid phải adapt:

- Mobile: 1-2 columns tùy card width.
- Tablet: 2-3 columns.
- Desktop: 3-5 columns tùy container và card.
- Không để card quá hẹp làm text/price vỡ.

### 16.4 Filter on mobile

Mobile filter nên là:

- Drawer.
- Bottom sheet.
- Collapsible panel.

Phải có:

- Apply.
- Reset.
- Close.
- Active filter count.

### 16.5 Checkout mobile

Mobile checkout phải:

- 1 column.
- Input đủ lớn.
- Summary rõ.
- Submit CTA dễ bấm.
- Error gần field.
- Không làm user scroll qua lại quá nhiều.

---

## 17. State Design for Web

### 17.1 Loading

Loading state theo context:

- Homepage/product section: skeleton card.
- Category: product grid skeleton.
- PDP: gallery + summary skeleton.
- Cart: item skeleton.
- Checkout submit: button loading.
- Search: suggestion/list loading.

Không dùng spinner full page cho mọi thứ.

### 17.2 Empty

Empty state cần hữu ích:

- Empty category.
- No search result.
- Empty cart.
- No articles.
- No related products.

Luôn có next action nếu có thể.

### 17.3 Error

Error state phải:

- Nói rõ lỗi.
- Có retry.
- Có link/contact nếu cần.
- Không expose raw error.

### 17.4 Success

Success state dùng cho:

- Add to cart.
- Submit order.
- Form contact sent.
- Newsletter subscribed nếu có.
- Account created/updated nếu có.

### 17.5 Offline/network failure

Nếu request fail do network:

- Giữ data cũ nếu có thể.
- Show retry.
- Không làm mất cart/form input.

### 17.6 Price/stock changed

Cart/PDP phải có UX khi:

- Price changed.
- Stock changed.
- Variant unavailable.
- Product removed/unpublished.

Không silently update nếu ảnh hưởng quyết định mua.

---

## 18. Component Patterns for Web

### 18.1 Buttons

Button hierarchy:

- Primary: Mua ngay, Thêm vào giỏ, Checkout, Submit order.
- Secondary: Xem thêm, Liên hệ, Tiếp tục mua sắm.
- Tertiary: Link phụ, Read more.
- Destructive: Remove cart item, cancel account action nếu có.
- Disabled/loading: Khi thiếu variant, hết hàng, đang submit.

### 18.2 Product cards

Product card là component core.

Rules:

- Image area stable.
- Product name readable.
- Price prominent.
- Sale state clear.
- Badge controlled.
- Click target clear.
- Mobile friendly.

### 18.3 Category cards

Category card phải:

- Dễ nhận diện category.
- Có icon/image phù hợp.
- Không quá nhiều text.
- Click target lớn.
- Consistent grid.

### 18.4 Trust cards

Trust card dùng cho:

- Warranty.
- Shipping.
- COD/payment.
- Return.
- Support.

Mỗi card nên có icon + title + short copy.

### 18.5 Article cards

Article card phải có:

- Thumbnail.
- Title.
- Excerpt.
- Date/category.
- Link.

Không dùng article card giống product card nếu gây nhầm.

### 18.6 Badges

Badge dùng cho:

- Sale.
- New.
- Hot.
- In stock.
- Out of stock.
- Preorder.
- Campaign.

Không spam nhiều badge trên cùng một card.

### 18.7 Breadcrumbs

Breadcrumbs nên dùng trên:

- Category page.
- PDP.
- Article detail.
- Policy detail nếu deep.

Breadcrumbs phải crawlable links nếu có thể.

### 18.8 Accordions

Accordion phù hợp cho mobile/PDP:

- Specs.
- Description sections.
- FAQ.
- Policy snippets.

Không ẩn nội dung SEO quan trọng theo cách crawler không đọc được nếu implementation có rủi ro.

### 18.9 Sticky CTA

Sticky CTA có thể dùng trên mobile PDP/cart:

- Không che nội dung quan trọng.
- Không quá cao.
- Có price/selected variant nếu cần.
- Disable rõ nếu chưa đủ lựa chọn.

---

## 19. Trust, Policy, and Support UX

### 19.1 Trust signals

Trust signals nên xuất hiện ở:

- Homepage.
- PDP.
- Cart.
- Checkout.
- Footer.
- Policy pages.

Nội dung trust nên gồm:

- Bảo hành.
- Đổi trả.
- Giao hàng.
- COD/thanh toán.
- Hotline/Zalo/Messenger.
- Địa chỉ cửa hàng.
- Review/testimonial nếu có thật.

### 19.2 Policy snippets

Policy snippet trên PDP/checkout nên ngắn và link đến full policy.

Không copy toàn bộ policy dài vào PDP làm khách bị chôn trong văn bản.

### 19.3 Contact support

Contact CTA phải rõ:

- Hotline.
- Zalo.
- Messenger.
- Contact form nếu có.

Không ẩn thông tin liên hệ ở footer duy nhất.

---

## 20. Copywriting for Web

### 20.1 Tone

Copy public web phải:

- Ngắn.
- Mạnh.
- Rõ lợi ích.
- Có chất biker/motorcycle.
- Không phóng đại vô căn cứ.
- Không sáo rỗng.

### 20.2 CTA labels

CTA tốt:

- `Mua ngay`
- `Thêm vào giỏ`
- `Xem sản phẩm`
- `Khám phá mũ bảo hiểm`
- `Liên hệ tư vấn`
- `Xem chính sách bảo hành`
- `Tiếp tục mua sắm`

CTA không tốt:

- `Click here`
- `Submit`
- `More`
- `OK`
- `Go`

### 20.3 Product copy

Product copy phải:

- Nêu rõ sản phẩm dành cho ai.
- Lợi ích chính.
- Tính năng/spec quan trọng.
- Chính sách liên quan.
- Không viết quá dài trên card/listing.

### 20.4 SEO copy

SEO copy phải:

- Tự nhiên.
- Có keyword nhưng không spam.
- Có internal links.
- Có heading rõ.
- Giúp người đọc chọn mua tốt hơn.

---

## 21. Performance UX

### 21.1 Image performance

Rules:

- Optimize product image.
- Use responsive image.
- Lazy load below-the-fold.
- Reserve image dimensions để tránh CLS.
- Use priority loading cho hero/PDP main image khi cần.

### 21.2 Font loading

Font phải load hợp lý:

- Không gây flash layout quá mạnh.
- Có fallback.
- Không load quá nhiều weight/style không dùng.

### 21.3 Video/animation

Video/animation phải:

- Có poster.
- Không autoplay có âm thanh.
- Không quá nặng.
- Có reduced-motion fallback.
- Không phá Core Web Vitals.

### 21.4 Third-party scripts

Third-party scripts như analytics/chat/social phải:

- Không block rendering.
- Load có kiểm soát.
- Không làm checkout chậm.
- Không phá privacy/compliance.

---

## 22. Accessibility

### 22.1 Contrast

Text phải đủ contrast.

Đặc biệt kiểm tra:

- Red text trên dark background.
- Muted metadata.
- Badge text.
- Button disabled.
- Footer links.

### 22.2 Keyboard

Keyboard navigation phải hoạt động cho:

- Header nav.
- Search.
- Product cards.
- Filter controls.
- Quantity selector.
- Cart actions.
- Checkout form.
- Modal/drawer.

### 22.3 Screen reader

Implement cần đảm bảo:

- Image alt text.
- Icon-only buttons có aria-label.
- Form errors liên kết với fields.
- Modal/drawer có title.
- Dynamic cart updates có feedback nếu cần.

### 22.4 Touch targets

Mobile touch targets phải đủ lớn:

- Header menu.
- Search.
- Product card CTA.
- Variant selector.
- Quantity control.
- Checkout submit.
- Filter controls.

### 22.5 Status not color-only

Stock, sale, error, success không được chỉ dùng màu. Phải có text/icon/message.

---

## 23. Error, 404, and Fallback Pages

### 23.1 404 page

404 page phải:

- Nói rõ không tìm thấy trang.
- Có search.
- Có link về homepage/catalog.
- Có category suggestions.
- Giữ brand mood.

Không chỉ hiển thị `404`.

### 23.2 General error page

Error page phải:

- Message rõ.
- Retry hoặc back/home action.
- Không expose stack trace.
- Có contact support nếu cần.

### 23.3 Product unavailable

Nếu product không available:

- Nói rõ sản phẩm không còn hiển thị/hết hàng.
- Gợi ý sản phẩm liên quan/category.
- Có contact support nếu phù hợp.

### 23.4 Maintenance state

Nếu có maintenance:

- Message rõ.
- Thời điểm nếu biết.
- Contact channel nếu cần.
- Không dùng wording gây hoang mang.

---

## 24. Do / Don't

### Do

- Do thiết kế mobile-first.
- Do dùng BigBike Red cho CTA và price/sale highlight.
- Do ưu tiên product image, price, stock, CTA.
- Do thêm search rõ trên website bán hàng.
- Do có filter/sort usable.
- Do viết category/PDP/article SEO-friendly.
- Do giữ checkout đơn giản.
- Do hiển thị trust signals gần decision points.
- Do thiết kế loading/empty/error/success states.
- Do tối ưu image/font/performance.
- Do dùng internal links tự nhiên.

### Don't

- Don't lạm dụng red background.
- Don't dùng Bungee cho paragraph/spec/table.
- Don't ẩn search quá sâu.
- Don't để product card thiếu giá hoặc CTA.
- Don't dùng ảnh sản phẩm mờ/crop lỗi.
- Don't biến category page thành bãi keyword.
- Don't che CTA bằng banner/chat/widget.
- Don't dùng slider nặng chỉ để “trông chuyên nghiệp”.
- Don't render blank khi category/search/cart rỗng.
- Don't invent policy/business claim chưa được xác nhận.
- Don't copy admin table UX sang public website.

---

## 25. Page Review Checklist

### Global

- [ ] Header có logo/nav/search/cart rõ.
- [ ] Footer có contact/policy/category links.
- [ ] Responsive mobile ổn.
- [ ] Không có layout shift rõ.
- [ ] Font/brand đúng guideline.
- [ ] CTA chính nổi bật.
- [ ] Focus state visible.
- [ ] Không dùng màu là tín hiệu duy nhất.

### SEO

- [ ] Page có H1 rõ.
- [ ] Heading hierarchy đúng.
- [ ] Metadata phù hợp.
- [ ] Internal links hợp lý.
- [ ] Image có alt text.
- [ ] Content crawlable.
- [ ] URL ổn định.
- [ ] Không spam keyword.

### Commerce

- [ ] Product image rõ.
- [ ] Price rõ.
- [ ] Stock/variant state rõ.
- [ ] CTA rõ.
- [ ] Trust/policy info gần decision point.
- [ ] Cart/checkout có loading/error state.
- [ ] Empty state có next action.

### Performance

- [ ] Hero/PDP image optimized.
- [ ] Below-the-fold lazy loaded.
- [ ] No heavy animation blocking.
- [ ] Third-party scripts kiểm soát.
- [ ] Mobile load không quá nặng.

---

## 26. Relationship With Other Docs

### `BRAND_GUIDELINES.md`

Nguồn chuẩn cho:

- Logo.
- Brand colors.
- Typeface.
- Visual mood.
- Asset usage.

`WEB_DESIGN.md` chỉ áp dụng brand vào public web UX.

### `DESIGN_SYSTEM.md`

Nguồn chuẩn cho:

- Shared UI rules.
- Component behavior.
- State design.
- Accessibility.
- Responsive principles.

`WEB_DESIGN.md` mở rộng cho website bán hàng/SEO.

### `WEB_DESIGN_TOKENS.md`

Nguồn chuẩn cho:

- Web color tokens.
- Typography tokens.
- Spacing/radius/shadow tokens.
- Component token mapping.

File này không hardcode token implementation chi tiết.

### `ADMIN_DESIGN.md`

Nguồn chuẩn cho admin dashboard UX. Không dùng admin density/table-first patterns cho public website trừ khi thật sự phù hợp.

### `BUSINESS_RULES.md`

Nguồn chuẩn cho business behavior: checkout, bảo hành, đổi trả, order, payment, stock, promotion.

`WEB_DESIGN.md` chỉ mô tả cách hiển thị, không tự phát minh rule.

### `API_CONTRACT.md`

Nguồn chuẩn cho backend/API. Web design không định nghĩa endpoint hoặc payload.

### `DATA_CONTRACT.md`

Nguồn chuẩn cho data model. Web design không định nghĩa schema.

---

## 27. AI Agent Rules

Khi AI agent sửa `bigbike-web`:

1. Đọc `BRAND_GUIDELINES.md`.
2. Đọc `DESIGN_SYSTEM.md`.
3. Đọc `WEB_DESIGN.md`.
4. Đọc `WEB_DESIGN_TOKENS.md`.
5. Không dùng admin UI pattern cho public web nếu không phù hợp.
6. Không hardcode màu/font/spacing nếu token đã có.
7. Không tạo visual language mới.
8. Không bỏ qua SEO semantics.
9. Không bỏ qua mobile.
10. Không bỏ qua loading/empty/error states.
11. Không invent business claim.
12. Không làm page đẹp nhưng chậm.
13. Không giấu CTA chính.
14. Không render product/category/content bằng cách làm crawler khó đọc.

BigBike public web phải bán hàng tốt, SEO tốt, nhanh, rõ sản phẩm, rõ CTA và đáng tin. Nếu khách vào mà không biết nên bấm gì trong 5 giây đầu, UI đang làm từ thiện traffic cho đối thủ.
