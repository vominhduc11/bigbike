# BigBike Web — UX / Customer Journey Audit

> Phạm vi: `bigbike-web` (public website). Góc nhìn: khách hàng thật truy cập website để tìm hiểu, chọn và mua đồ bảo hộ moto.
> Ngày audit: 2026-05-16
> Loại: AUDIT + TRACE + REPORT. Không sửa code hàng loạt — chỉ liệt kê issue, evidence và recommended fix.
> Docs tham chiếu: `AGENTS.md`, `docs/engineering/API_CONTRACT.md`, `bigbike-web/STYLEGUIDE.md` (UI stack), `docs/business/BUSINESS_RULES.md`.

---

## 1. Executive Summary

`bigbike-web` là một website thương mại đã ở mức **hoàn thiện cao**: kiến trúc journey rõ ràng, mọi route đều có `loading.tsx`, có `error.tsx` / `not-found.tsx` toàn cục, empty/error state được thiết kế tử tế, guest checkout hoạt động (không ép đăng nhập), checkout có idempotency key chống đặt trùng và có xử lý price-change. Thanh tìm kiếm (autocomplete + keyboard nav + recent search) thuộc loại tốt.

Tuy nhiên còn một số điểm **làm giảm niềm tin và tỷ lệ chuyển đổi** ở các khoảnh khắc quyết định:

1. **Luồng "Mua ngay" (Quick Buy)** cho khách xác nhận đơn hàng mà **không hề thấy tổng tiền** — không line total, không phí ship, không grand total trong modal.
2. **Menu điều hướng chính trên header không có fallback** — nếu API menu lỗi, desktop header mất sạch link danh mục (footer thì có fallback, header thì không).
3. **Giỏ hàng không hiển thị tình trạng tồn kho theo từng sản phẩm** và không có "price/stock changed notice" — trái với tinh thần `AGENTS.md` Section 13.
4. Một số chi tiết nhỏ về tồn kho (nút thêm giỏ ở listing không tôn trọng `OUT_OF_STOCK`, quantity stepper không cap theo tồn kho), nhãn nút gây hiểu nhầm, và validation số điện thoại không nhất quán giữa 2 luồng mua.

Không phát hiện issue **CRITICAL** chặn đứng việc mua hàng. Các issue HIGH đều là "degraded experience" có đường vòng, nhưng ảnh hưởng trực tiếp đến trust/conversion nên cần xử lý sớm.

---

## 2. UX Score tổng thể

**78 / 100**

| Hạng mục | Điểm | Ghi chú |
|---|---|---|
| First impression (homepage) | 9/10 | Hero + fallback tốt, thông điệp rõ "shop đồ bảo hộ moto chính hãng" |
| Product discovery (listing/search/filter) | 8.5/10 | Filter đầy đủ, search xuất sắc; thiếu xử lý out-of-stock ở card |
| Product decision (PDP) | 8/10 | Đủ ảnh/giá/variant/spec/trust; "Mua ngay" disabled không giải thích |
| Conversion (cart/checkout/quick-buy) | 6.5/10 | Checkout chuẩn; Quick Buy thiếu tổng tiền; cart thiếu trạng thái tồn kho |
| Trust (header/footer/policy/contact) | 8/10 | Footer + giấy phép + BCT tốt; header nav không fallback |
| Mobile UX | 8.5/10 | Sticky purchase bar, drawer menu, touch target 44px đạt |
| State handling | 8.5/10 | Loading/empty/error phủ tốt; vài chỗ error còn generic |
| Data/API integrity | 8/10 | Contract khớp; vài bất nhất frontend-side |

---

## 3. Danh sách Customer Journey đã kiểm tra

| # | Journey | Route / Component chính | Trạng thái |
|---|---|---|---|
| 1 | First impression | `app/page.tsx`, `HeroSlider`, `SiteHeader` | ✅ Tốt |
| 2 | Product discovery | `app/san-pham/page.tsx`, `app/danh-muc-san-pham/[slug]/page.tsx`, `app/tim-kiem/page.tsx`, `CatalogFilters`, `SearchToggle` | ⚠️ Vài điểm |
| 3 | Product decision (PDP) | `app/product/[slug]/page.tsx`, `PurchaseSectionClient` | ⚠️ Vài điểm |
| 4 | Conversion | `app/gio-hang/page.tsx`, `app/thanh-toan/page.tsx`, `QuickBuyModal`, `app/don-hang/xac-nhan/page.tsx` | ⚠️ Cần xử lý |
| 5 | Trust | `SiteHeader`, `SiteFooter`, `app/lien-he/page.tsx`, `ContactForm` | ⚠️ Vài điểm |
| 6 | Mobile | Sticky bar PDP, `MobileHeaderMenu`, `CatalogFilters` mobile toggle | ✅ Tốt |
| 7 | State handling | `app/error.tsx`, `not-found.tsx`, `loading.tsx`, `EmptyState`, `ErrorState` | ✅ Tốt |
| 8 | Data/API | `lib/api/public-api.ts`, `lib/api/client-api.ts` | ✅ Khớp contract |

---

## 4. Danh sách Issue theo Severity

### CRITICAL

Không phát hiện issue CRITICAL chặn đứng việc mua hàng hoặc làm trắng màn hình.

---

### HIGH

#### H-1 — Quick Buy ("Mua ngay") cho khách đặt hàng mà không thấy tổng tiền

- **Journey:** Conversion
- **File:** `bigbike-web/components/catalog/QuickBuyModal.tsx`
- **Mô tả:** Modal "Mua ngay" thu thập địa chỉ + phương thức thanh toán + phương thức vận chuyển, rồi có nút **"Xác nhận mua ngay"**. Trong toàn bộ modal **không hiển thị**: đơn giá sản phẩm, số lượng đang mua, phí vận chuyển của method đã chọn, hay tổng tiền phải trả. Khách bấm xác nhận tạo đơn thật mà không biết mình sẽ trả bao nhiêu.
- **Vì sao ảnh hưởng khách hàng:** Đây là cam kết tài chính. Bắt khách "mua mù" phá vỡ niềm tin, tăng tỷ lệ huỷ đơn sau khi thấy giá ở trang xác nhận, và đi ngược tinh thần `AGENTS.md` Section 13 (Cart/Checkout Rules — phải rõ ràng trước khi đặt). So với luồng giỏ hàng → `thanh-toan` (hiển thị đầy đủ tạm tính / giảm giá / phí ship / tổng), Quick Buy là một bước lùi lớn.
- **Evidence:** `QuickBuyModal.tsx` chỉ có form fields + nút submit; `shippingMethods` có `cost` (`API_CONTRACT.md` "Checkout Options Contract") nhưng chỉ dùng trong dropdown label, không tổng hợp. `quantity` được truyền vào qua prop nhưng không hiển thị.
- **Recommended fix:** Thêm block "Tóm tắt đơn hàng" trong `SheetContent`: tên sản phẩm + variant + số lượng + đơn giá, phí vận chuyển theo method đã chọn, và **grand total**. Có thể fetch giá hiện tại của sản phẩm/variant (snapshot route đã có sẵn) để hiển thị chính xác.
- **Auto-fix:** ❌ Không — cần thiết kế block tóm tắt và quyết định nguồn giá (snapshot vs prop). Đánh dấu **NEEDS_CONFIRMATION** về việc lấy giá từ đâu.

#### H-2 — Header navigation không có fallback khi API menu lỗi

- **Journey:** First impression, Product discovery, Trust
- **File:** `bigbike-web/components/layout/SiteHeader.tsx`
- **Mô tả:** Header build menu từ `getPublicMenu("primary")`. Nếu API lỗi, code chỉ `console.warn` và `resolvedMenuTree = []`. Kết quả: trên desktop, `<nav className="bb-navigation">` render rỗng — **không còn link danh mục nào** ở header. Trên mobile, drawer menu cũng rỗng (vẫn còn cart/account/hotline). Footer thì có `FALLBACK_FOOTER_LINKS` / `FALLBACK_GUIDE_LINKS`, header thì không có gì tương đương.
- **Vì sao ảnh hưởng khách hàng:** Mất điều hướng cấp 1 = khách không biết shop bán những danh mục gì, phải đoán hoặc dùng search. Ảnh hưởng cả discovery lẫn trust (website "vỡ"). `AGENTS.md` Section 5.3 yêu cầu mọi screen handle state lỗi; Section 15.1 yêu cầu internal links.
- **Evidence:** `SiteHeader.tsx` dòng `if (!menuResult.data) { console.warn(...) }` rồi `resolvedMenuTree = menuResult.data ? buildMenuTree(...) : []`. So sánh `SiteFooter.tsx` dòng 162–163 có fallback.
- **Recommended fix:** Định nghĩa `FALLBACK_PRIMARY_MENU` tĩnh (Trang chủ, Sản phẩm, Danh mục, Thương hiệu, Tin tức, Liên hệ — trỏ tới các route đã tồn tại) và dùng khi `menuResult.data` rỗng, giống pattern footer.
- **Auto-fix:** ⚠️ Có thể — đây là thay đổi additive (thêm fallback, không đổi contract/route). Nên xác nhận danh sách menu fallback với user trước khi commit. **NEEDS_CONFIRMATION** nhẹ về nội dung menu.

#### H-3 — Giỏ hàng không hiển thị tình trạng tồn kho / không có cảnh báo giá-tồn thay đổi

- **Journey:** Conversion
- **File:** `bigbike-web/app/gio-hang/page.tsx`
- **Mô tả:** Trang giỏ hàng render từng dòng (ảnh, tên, variant, SKU, số lượng, đơn giá, line total) nhưng **không hiển thị** sản phẩm còn hàng / sắp hết / hết hàng, cũng không cảnh báo khi giá hoặc tồn kho thay đổi so với lúc thêm. Khách chỉ phát hiện sự cố ở bước `thanh-toan` (price-change được xử lý ở đó) hoặc khi `submitCheckout` trả lỗi (hiển thị `submitError` generic).
- **Vì sao ảnh hưởng khách hàng:** Khách có thể giữ trong giỏ một sản phẩm đã hết hàng suốt cả phiên rồi mới bị chặn ở phút chót — gây hụt hẫng và bỏ giỏ. `AGENTS.md` Section 13: *"Show price/stock changed notice."*
- **Evidence:** `gio-hang/page.tsx` map `cart.items` không đọc field tồn kho; `Cart`/`CartItem` (`lib/contracts/commerce.ts`) cần kiểm tra có field stock không. Price-change chỉ được render ở `thanh-toan/page.tsx` (`priceChanges` state), không ở giỏ.
- **Recommended fix:** Hiển thị badge tồn kho theo từng dòng giỏ (nếu `CartItem` đã có field tương ứng); nếu chưa có thì ghi nhận gap data contract (xem mục 8). Khi `updateCartItem` / `fetchCart` trả về thông tin lệch giá, hiển thị notice ngay trong giỏ.
- **Auto-fix:** ❌ Không — phụ thuộc data contract của `CartItem`. **NEEDS_CONFIRMATION**: xác nhận `GET /api/v1/cart` có trả tồn kho per-item không.

---

### MEDIUM

#### M-1 — Nút "THÊM VÀO GIỎ HÀNG" trên product card không tôn trọng `OUT_OF_STOCK`

- **Journey:** Product discovery
- **File:** `bigbike-web/components/catalog/ProductCardAddBar.tsx`, `ProductCard.tsx`
- **Mô tả:** Card sản phẩm (compact) hiển thị badge "Hết hàng" nhưng thanh `ProductCardAddBar` vẫn hiện "THÊM VÀO GIỎ HÀNG" và vẫn bấm được. Bấm xong backend từ chối → toast "Không thể thêm vào giỏ". Component không hề đọc `product.stockState`.
- **Vì sao ảnh hưởng khách hàng:** Cho khách thao tác một hành động chắc chắn thất bại = trải nghiệm hụt. Nên disable hoặc đổi nhãn thành "Hết hàng" / chỉ cho "Xem chi tiết".
- **Evidence:** `ProductCardAddBar.tsx` không nhận `stockState`; `ProductCard.tsx` truyền vào `ProductCardAddBar` chỉ `productId`, `hasVariants`, `slug`.
- **Recommended fix:** Truyền `stockState` xuống `ProductCardAddBar`; khi `OUT_OF_STOCK` → disable nút + nhãn "Tạm hết hàng".
- **Auto-fix:** ✅ Có thể — thay đổi nội tại UI, không đụng API/contract/state machine.

#### M-2 — `QuantityStepper` không giới hạn theo tồn kho

- **Journey:** Product decision, Conversion
- **File:** `bigbike-web/components/ui/QuantityStepper.tsx` (dùng tại `PurchaseSectionClient.tsx`, `gio-hang/page.tsx`)
- **Mô tả:** `QuantityStepper` có hỗ trợ prop `max` nhưng cả PDP lẫn giỏ hàng đều không truyền `max`. Khách có thể nhập số lượng tuỳ ý (vd 999) và chỉ biết vượt tồn khi nhận lỗi từ backend.
- **Vì sao ảnh hưởng khách hàng:** Friction không cần thiết; với variant `LOW_STOCK` thì đặc biệt khó chịu. PDP đã có sẵn `effectiveStockData.quantity` (số tồn của variant đã chọn).
- **Evidence:** `PurchaseSectionClient.tsx` dòng `<QuantityStepper value={quantity} onChange={setQuantity} min={1} ... />` — không có `max`. `effectiveStockData` có `quantity`.
- **Recommended fix:** Truyền `max={effectiveStockData?.quantity ?? undefined}` ở PDP; ở giỏ truyền max theo tồn item nếu contract có. Backend vẫn enforce (không tin frontend).
- **Auto-fix:** ⚠️ PDP có thể auto-fix (dữ liệu sẵn có); phần giỏ hàng phụ thuộc contract — **NEEDS_CONFIRMATION**.

#### M-3 — BACS (chuyển khoản) + email tuỳ chọn → khách có thể không nhận được thông tin chuyển khoản qua email

- **Journey:** Conversion, Trust
- **File:** `bigbike-web/app/thanh-toan/page.tsx` (`PAYMENT_DESC.BACS`), `lib/schemas/checkout.ts`, `QuickBuyModal.tsx`
- **Mô tả:** Mô tả phương thức BACS ghi: *"Chuyển khoản ngân hàng — thông tin TK gửi qua email sau khi đặt hàng."* Nhưng `checkoutAddressSchema` đặt `email` là **optional**, Quick Buy cũng không bắt buộc email. Nếu khách chọn BACS mà không nhập email, lời hứa "gửi qua email" không thực hiện được. Trang `don-hang/xac-nhan` có hiển thị thông tin chuyển khoản inline (giảm nhẹ rủi ro), nhưng nếu khách rời trang đó thì không còn bản ghi nào.
- **Vì sao ảnh hưởng khách hàng:** Khách chuyển khoản là khâu nhạy cảm; mất thông tin TK = đơn treo, phải gọi hotline. Ảnh hưởng trust và tỷ lệ hoàn tất thanh toán.
- **Evidence:** `thanh-toan/page.tsx` dòng `PAYMENT_DESC` ; `checkout.ts` `email: z.string().email().optional().or(z.literal(""))`. `API_CONTRACT.md` Checkout Options xác nhận `BACS`/`COD`. Docs **không** quy định email bắt buộc → không phải vi phạm contract.
- **Recommended fix (chọn một):** (a) Khi chọn BACS → yêu cầu email bắt buộc (validate động); hoặc (b) bỏ cụm "gửi qua email" trong mô tả, nhấn mạnh "thông tin chuyển khoản hiển thị ngay sau khi đặt hàng". Phương án (a) tốt hơn cho khách.
- **Auto-fix:** ❌ Không — phương án (a) đổi quy tắc validation checkout. **NEEDS_CONFIRMATION** với user (business rule chọn (a) hay (b)).

#### M-4 — Nhãn "THÊM VÀO GIỎ HÀNG" trên ProductCard variant `featured` gây hiểu nhầm

- **Journey:** Product discovery
- **File:** `bigbike-web/components/catalog/ProductCard.tsx` (block `variant === "featured"`)
- **Mô tả:** Trong carousel sản phẩm nổi bật, mỗi card có overlay với nhãn **"THÊM VÀO GIỎ HÀNG"** nhưng thực chất chỉ là `<Link href={href}>` điều hướng tới trang PDP — không thêm gì vào giỏ.
- **Vì sao ảnh hưởng khách hàng:** Nhãn hứa hành động A, thực hiện hành động B. Gây mất lòng tin nhỏ và confuse khi khách trông đợi sản phẩm vào giỏ.
- **Evidence:** `ProductCard.tsx` block featured: `<div className="bb-fp-cart"><Link href={href}>...THÊM VÀO GIỎ HÀNG</Link></div>`.
- **Recommended fix:** Đổi nhãn thành "XEM SẢN PHẨM" / "XEM CHI TIẾT" cho đúng hành vi; hoặc biến nó thành nút add-to-cart thật (nếu sản phẩm không có variant).
- **Auto-fix:** ✅ Có thể (đổi nhãn là thay đổi text thuần, đúng hành vi thực tế).

#### M-5 — Validation số điện thoại không nhất quán giữa Checkout và Quick Buy

- **Journey:** Conversion
- **File:** `lib/schemas/checkout.ts` vs `bigbike-web/components/catalog/QuickBuyModal.tsx`
- **Mô tả:** Checkout dùng regex `^(0[3-9][0-9]{8}|\+84[3-9][0-9]{8})$` (chấp nhận cả `0xxx` và `+84xxx`). Quick Buy dùng `pattern="0[3-9][0-9]{8}"` + `maxLength={10}` (chỉ chấp nhận `0xxx`, **không** nhận `+84`). Cùng một khách, hai luồng mua, hai luật khác nhau.
- **Vì sao ảnh hưởng khách hàng:** Khách dùng `+84...` ở Quick Buy bị chặn không rõ lý do, dù số đó hợp lệ ở checkout thường.
- **Evidence:** `checkout.ts` `VN_PHONE_RE`; `QuickBuyModal.tsx` input phone `pattern="0[3-9][0-9]{8}"`.
- **Recommended fix:** Thống nhất một quy tắc — lý tưởng là dùng chung `VN_PHONE_RE` cho cả Quick Buy (gỡ `maxLength={10}` cứng hoặc nâng lên 12).
- **Auto-fix:** ✅ Có thể (đồng bộ regex, không đổi backend — backend `CheckoutService.validateAddress` mới là nguồn enforce).

#### M-6 — Trang xác nhận đơn hiển thị "Đặt hàng thành công" kể cả khi thiếu/ sai tham số đơn

- **Journey:** Conversion
- **File:** `bigbike-web/app/don-hang/xac-nhan/page.tsx`
- **Mô tả:** Nếu truy cập `/don-hang/xac-nhan` không có `so`/`key` (vd link hỏng, khách bookmark nhầm, share link mất param), trang vẫn render heading "Cảm ơn anh em đã tin BigBike!" + eyebrow "Đặt hàng thành công" nhưng không có mã đơn, không có chi tiết. Trường hợp `orderLookup.error && !order && orderNumber` mới có dòng "Đơn đã được tạo, nhưng không thể tải chi tiết".
- **Vì sao ảnh hưởng khách hàng:** Hiển thị "thành công" cho một trạng thái không xác định gây hiểu nhầm — khách tưởng có đơn trong khi không có.
- **Evidence:** `don-hang/xac-nhan/page.tsx`: phần `{orderNumber && (...)}` bọc bảng thông tin, nhưng heading/eyebrow luôn render bất kể có `orderNumber` hay không.
- **Recommended fix:** Khi không có `so`/`key`, hiển thị state trung tính ("Không tìm thấy thông tin đơn hàng" + link về `tai-khoan/don-hang` / trang chủ) thay vì màn hình success.
- **Auto-fix:** ✅ Có thể (thêm nhánh điều kiện cho state thiếu param — không đụng contract).

---

### LOW

#### L-1 — PDP: nút "Mua ngay" bị disable khi chưa chọn variant mà không có lời giải thích cạnh nút

- **Journey:** Product decision
- **File:** `bigbike-web/components/catalog/PurchaseSectionClient.tsx`
- **Mô tả:** Khi sản phẩm có variant chưa chọn, `isAvailable=false` → nút "Mua ngay" bị disable. Nút "Thêm vào giỏ" đổi nhãn thành "Vui lòng chọn biến thể", còn "Mua ngay" chỉ disable im lặng. Prompt `Vui lòng chọn size/màu sắc để mua hàng` có hiển thị phía trên nhưng không gắn trực tiếp với nút "Mua ngay".
- **Recommended fix:** Cho "Mua ngay" cũng đổi nhãn/hiện tooltip lý do khi disable.
- **Auto-fix:** ✅ Có thể.

#### L-2 — Hotline fallback hardcode không nhất quán giữa các trang

- **Journey:** Trust
- **File:** `app/lien-he/page.tsx` (`028.62797251`), `app/don-hang/xac-nhan/page.tsx` (`0906.902.404`)
- **Mô tả:** Khi setting `hotline` trống, trang Liên hệ fallback `028.62797251` còn trang xác nhận đơn hardcode `0906.902.404`. Hai số khác nhau xuất hiện cùng lúc làm khách bối rối số nào đúng.
- **Recommended fix:** Dùng chung một hằng fallback hotline, lý tưởng đọc từ `listPublicSettings()` ở mọi nơi.
- **Auto-fix:** ⚠️ Có thể — nhưng cần user xác nhận số hotline chính xác. **NEEDS_CONFIRMATION**.

#### L-3 — Homepage: H1 là `sr-only`, text nổi bật nhất của hero là thẻ `<p>`

- **Journey:** First impression / SEO
- **File:** `app/page.tsx`, `components/home/HeroSlider.tsx`
- **Mô tả:** `<h1 className="sr-only">` phục vụ SEO (hợp lệ), nhưng dòng tiêu đề lớn nhất khách nhìn thấy trong hero là `<p className="font-display ...">`. Không sai SEO (vẫn có đúng 1 H1) nhưng heading hierarchy về mặt visual hơi lệch.
- **Recommended fix:** Cân nhắc để hero title hiển thị chính là H1 (bỏ `sr-only`), hoặc giữ nguyên nếu là quyết định SEO có chủ đích.
- **Auto-fix:** ❌ Không — đụng SEO, để user quyết định. **NEEDS_CONFIRMATION**.

#### L-4 — Cart: lỗi hiển thị dưới dạng text thô ở đầu trang

- **Journey:** Conversion / State handling
- **File:** `app/gio-hang/page.tsx`
- **Mô tả:** Lỗi thao tác giỏ (`updateCartItem`/`removeCartItem` fail) đẩy vào `error` và render `<p className="bb-error-text">{error}`. Đủ dùng nhưng không nổi bật, không có hành động retry; nếu lỗi mạng khi load giỏ thì chỉ thấy dòng chữ.
- **Recommended fix:** Dùng `ErrorState` (đã có sẵn) cho lỗi load giỏ; lỗi thao tác có thể dùng toast.
- **Auto-fix:** ✅ Có thể (dùng component sẵn có).

---

## 5. Danh sách Flow đang TỐT

- **Guest checkout** — `thanh-toan/page.tsx` không ép đăng nhập; khách vãng lai mua được ngay, prefill thông tin nếu đã đăng nhập. Tốt cho conversion.
- **Chống đặt trùng** — `submitCheckout` và `submitQuickBuy` đều gửi `Idempotency-Key` (`crypto.randomUUID()`), nút submit disable khi `submitting`.
- **Xử lý price-change ở checkout** — khi backend báo giá giảm, hiển thị danh sách `oldPrice → newPrice` và cho khách tiếp tục xem xác nhận. Đúng tinh thần `AGENTS.md` Section 13.
- **Search (`SearchToggle`)** — autocomplete debounce, điều hướng bàn phím (↑↓ Enter Home End), recent searches, empty state, focus trap, phím tắt Ctrl/Cmd+K. Chất lượng cao.
- **Resilience của homepage** — mọi block render có điều kiện `length > 0`; `HeroSlider` có fallback section khi không có slide; nếu toàn bộ API lỗi trang vẫn render hero fallback + about + SEO content. Không trắng màn hình.
- **`not-found.tsx`** — có search box, CTA về trang chủ/sản phẩm/tin tức, danh sách bài viết mới. 404 mang tính cứu vãn journey.
- **State coverage** — mỗi route có `loading.tsx`; có `error.tsx` global; listing/category có `EmptyState`/`ErrorState` phân biệt rõ lỗi vs rỗng.
- **Footer trust** — có fallback link, hiển thị giấy phép ĐKKD, badge Bộ Công Thương, social, hotline/email/địa chỉ.
- **PDP mobile sticky bar** — giữ CTA "Thêm vào giỏ" + giá luôn trong tầm tay khi cuộn PDP dài; chừa padding tránh nút chat.
- **`ContactForm`** — có cooldown 30s chống spam, validate đầy đủ, success state có nút "Gửi tin nhắn khác".
- **Checkout free-shipping logic** — tính `effectiveShippingCost` theo `freeShippingThreshold`, cảnh báo `belowMinOrder`, đúng theo `API_CONTRACT.md` (cart total không gồm ship).

---

## 6. Danh sách Flow THIẾU hoặc CHƯA RÕ

| Flow | Trạng thái | Ghi chú |
|---|---|---|
| Hiển thị tồn kho trong giỏ hàng | THIẾU | Xem H-3 |
| Tóm tắt tổng tiền trong Quick Buy | THIẾU | Xem H-1 |
| Fallback menu header | THIẾU | Xem H-2 |
| Thời gian giao hàng dự kiến | THIẾU | Không trang nào (PDP/cart/checkout) cho biết bao lâu nhận hàng — ảnh hưởng quyết định mua |
| Cảnh báo khi sản phẩm trong giỏ đổi giá/tồn | CHƯA RÕ | Chỉ checkout xử lý price-change; giỏ và PDP không |
| Trạng thái "đơn lỗi nhưng đã tạo" | CHƯA RÕ | `don-hang/xac-nhan` có nhánh nhỏ, nhưng UX thiếu hướng dẫn bước tiếp theo rõ ràng |
| Đăng nhập có liên quan đến mua hàng | RÕ — không bắt buộc | Guest checkout OK; không có gate ép login. Đây là điểm cộng, ghi nhận để không "sửa nhầm" |

---

## 7. Mobile Journey — chi tiết

- ✅ `MobileHeaderMenu` dùng `Sheet` (drawer trái), accordion đa cấp, có account/cart/hotline/zalo. Touch target hợp lý.
- ✅ `CatalogFilters` có `bb-filters-mobile-toggle` để thu gọn bộ lọc trên mobile.
- ✅ PDP có sticky purchase bar riêng cho mobile (`md:hidden`), spacer `h-24` tránh che nội dung.
- ✅ `QuantityStepper` giữ `min-h-[44px]` — đạt chuẩn touch target `AGENTS.md` Section 6.2.
- ⚠️ Nếu API menu lỗi (H-2), drawer mobile cũng rỗng phần nav — cùng gốc với H-2.
- ⚠️ Quick Buy modal trên mobile là `Sheet` full-width có scroll; thiếu block tổng tiền (H-1) càng dễ thấy trên màn hình nhỏ vì khách phải cuộn nhiều.
- Không phát hiện overflow / layout vỡ rõ rệt qua đọc code; CTA checkout/cart đều dùng `Button` shadcn với layout flex-wrap responsive.

---

## 8. Data / API Mismatch

| # | Mô tả | Mức độ | Evidence |
|---|---|---|---|
| D-1 | `CartItem` trong giỏ hàng không được render tình trạng tồn kho. Cần xác nhận `GET /api/v1/cart` có trả field tồn kho per-item hay không — nếu **không có**, đây là gap data contract cần bổ sung backend trước khi fix H-3. | Cần xác minh | `gio-hang/page.tsx`, `lib/contracts/commerce.ts`, `API_CONTRACT.md` |
| D-2 | Validation SĐT lệch nhau giữa `checkout.ts` và `QuickBuyModal.tsx` (frontend-side). Backend `CheckoutService.validateAddress` là nguồn enforce duy nhất — đây là bất nhất UI, không phải mismatch contract. | Thấp | M-5 |
| D-3 | Variant-level price tồn tại trong schema nhưng web **cố ý bỏ qua** (giá chỉ ở product-level). Đây là quyết định có chủ đích, có comment trong `PurchaseSectionClient.tsx` ("Variant-level price columns exist ... intentionally ignored"). Ghi nhận, không phải bug. | Thông tin | `PurchaseSectionClient.tsx` |
| D-4 | `GET /api/v1/cart` trả `shippingAmount = 0` ở phase giỏ (theo `API_CONTRACT.md`); web xử lý đúng bằng nhãn "Tính ở bước thanh toán". Không mismatch. | OK | `gio-hang/page.tsx`, `API_CONTRACT.md` dòng 70 |
| D-5 | Field admin/backend mà web không dùng: chưa phát hiện field public bị bỏ phí đáng kể trong phạm vi journey audit này. `product.contentBottom`, `specifications`, `videos` đều được PDP dùng. | OK | — |

---

## 9. Recommended Implementation Plan (theo thứ tự ưu tiên)

### Đợt 1 — Trust & Conversion (ưu tiên cao nhất)

1. **H-1** — Thêm block tóm tắt tổng tiền vào `QuickBuyModal`. *(NEEDS_CONFIRMATION: nguồn giá)*
2. **H-2** — Thêm `FALLBACK_PRIMARY_MENU` cho `SiteHeader`. *(NEEDS_CONFIRMATION nhẹ: nội dung menu)*
3. **M-3** — Quyết định business rule BACS + email (bắt buộc email khi BACS, hoặc sửa text mô tả). *(NEEDS_CONFIRMATION)*

### Đợt 2 — Discovery & tồn kho

4. **H-3 / D-1** — Xác minh contract `CartItem`; nếu có tồn kho → hiển thị badge trong giỏ + notice giá/tồn thay đổi. *(NEEDS_CONFIRMATION)*
5. **M-1** — `ProductCardAddBar` tôn trọng `OUT_OF_STOCK`. *(auto-fix được)*
6. **M-2** — Truyền `max` tồn kho vào `QuantityStepper` ở PDP. *(PDP auto-fix; giỏ chờ D-1)*

### Đợt 3 — Polish & nhất quán

7. **M-4** — Đổi nhãn nút featured card "THÊM VÀO GIỎ HÀNG" → "XEM SẢN PHẨM". *(auto-fix)*
8. **M-5** — Đồng bộ regex SĐT Quick Buy với checkout. *(auto-fix)*
9. **M-6** — `don-hang/xac-nhan` hiển thị state trung tính khi thiếu param. *(auto-fix)*
10. **L-1, L-4** — Tooltip lý do disable "Mua ngay"; dùng `ErrorState` cho lỗi load giỏ. *(auto-fix)*
11. **L-2** — Thống nhất hotline fallback. *(NEEDS_CONFIRMATION: số đúng)*
12. **L-3** — Xem lại quyết định H1 `sr-only` ở homepage. *(NEEDS_CONFIRMATION: SEO)*

### Ghi chú

- Các issue đánh dấu **auto-fix được** là thay đổi nội tại UI, không ảnh hưởng business rule / API contract / data contract / state machine — có thể fix trực tiếp.
- Các issue **NEEDS_CONFIRMATION** đụng tới business rule, data contract, hoặc cần dữ liệu từ user (hotline, menu, SEO) — chỉ nên implement sau khi user xác nhận.
- Không issue nào yêu cầu đổi route, đổi schema DB, hay đổi versioning API.
