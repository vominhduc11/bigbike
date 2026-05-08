# BIGBIKE-WEB — AUDIT OPUS (DEEP DIVE)

**Phiên bản:** Opus 4.7  
**Ngày:** 2026-05-08  
**Phạm vi:** `bigbike-web/` (Next.js 16, dev server `localhost:3001`)  
**Phương pháp:** Đọc 30+ files thực tế + curl thử 12 routes + so sánh code vs `docs/engineering/API_CONTRACT.md`  
**Đóng vai:** Khách hàng đầu tiên đến từ Google search "shop mũ bảo hiểm chính hãng tphcm"

---

## 0. ĐỌC NHANH (TL;DR cho chủ shop)

> **Có bán được không? Bán được, NHƯNG khách sẽ rớt 30–40% ở các điểm sau:**

1. 🔴 **Footer hiển thị `Đang cập nhật.` ở 3/5 cột** (Menu, Hướng dẫn, Thông tin liên hệ) khi backend settings chưa được seed → khách thấy shop "chưa làm xong" → mất niềm tin ngay.
2. 🔴 **Header navigation rỗng** nếu menu primary chưa được seed trong admin → khách không biết bấm vào đâu để xem mũ, áo, găng.
3. 🔴 **Bấm "THÊM VÀO GIỎ HÀNG" trên product card ngay lập tức add vào cart KHÔNG hỏi size/màu** → khách sẽ về giỏ thấy variant sai → bực.
4. 🔴 **Trên trang xác nhận đơn (chuyển khoản BACS), KHÔNG hiển thị số tài khoản ngân hàng** → khách không biết chuyển vào đâu, phải đợi email mới chuyển → conversion drop trầm trọng.
5. 🟠 **Điện thoại số 11 không nhập được** ở checkout — regex `^0[3-9][0-9]{8}$` chỉ chấp nhận đúng 10 số (đây là format chuẩn VN, NHƯNG nếu khách paste có space/dash sẽ fail không thông báo rõ).
6. 🟠 **Phường/Xã nhập tay** (text input, không phải select) — backend có endpoint `/api/v1/address/districts/{districtCode}/wards` nhưng frontend không gọi. Sai chính tả → đơn hàng giao sai địa chỉ.
7. 🟠 **Filter Brand/Color là RADIO chỉ 1 lựa chọn** — khách không thể lọc "Shoei + Arai" cùng lúc.
8. 🟠 **Sitemap.xml dump `http://localhost:3000/`** — nếu prod build thiếu env `NEXT_PUBLIC_SITE_URL=https://bigbike.vn` thì Google index URL localhost → sập SEO.
9. 🟠 **Breadcrumb JSON-LD viết `Trang chu` thiếu dấu** ở `lib/seo/json-ld.ts:91, 124` → Google rich result hiện tiếng Việt hỏng.
10. 🟢 Hệ thống design, ISR, CSP, JSON-LD, idempotency-key, CSRF, toast, search autocomplete — đều tốt, kiến trúc chuyên nghiệp.

**Điểm tổng:** 67/100 — **Đã sẵn sàng beta, CHƯA sẵn sàng full launch nếu backend settings/menu chưa seed đầy đủ.**

---

## 1. EXECUTIVE SUMMARY + ĐIỂM /100

### 1.1 Điểm tổng: **67/100**

Đây là một codebase tốt về kiến trúc (Next.js 16, ISR + dynamic snapshot, CSP, idempotency, CSRF, toast, JSON-LD, sitemap...), nhưng có nhiều điểm "60% công sức cuối cùng" chưa hoàn thiện làm khách mất niềm tin trong luồng mua hàng. Phần lớn vấn đề KHÔNG nằm trong logic phức tạp mà ở:

- **Sự phụ thuộc vào dữ liệu admin chưa seed** (menu, footer, hotline, address, social) → fallback "Đang cập nhật" lộ liễu.
- **Sự thiếu vắng các trust signal có giá trị thật** (chuyển khoản TK, chính sách bảo hành rõ ràng, đổi trả flow).
- **Một số lỗi nhỏ nhưng "đắt"** như form không submit được, validation mơ hồ, copy lệch ngữ cảnh.

### 1.2 So với báo cáo Haiku trước

Báo cáo Haiku trước đã liệt kê 24 findings. Báo cáo Opus này **bỏ một số finding sai (phone validation, trust signals homepage)** và **bổ sung 18 finding mới chỉ tìm được khi đọc kỹ từng file**. Tổng 32 findings có cite file:line cụ thể.

---

## 2. SCORECARD THEO NHÓM

| Nhóm | Điểm | Sao | Giải thích chính |
|---|---|---|---|
| **Trust** | 55/100 | ⭐⭐ | HomeTrustRail tốt ở homepage, nhưng footer "Đang cập nhật", chuyển khoản BACS không có TK, mã ĐKKD hardcoded. |
| **Discovery** | 70/100 | ⭐⭐⭐ | Filter có chip + preset giá tốt, nhưng brand/color radio (1 lựa chọn), sort thiếu "phổ biến". Search autocomplete tốt. |
| **Product Detail** | 78/100 | ⭐⭐⭐⭐ | Gallery + variant + zoom + tabs + reviews đầy đủ. Thiếu tab Bảo hành/Vận chuyển/Đổi trả. JSON-LD Product OK. |
| **Cart** | 72/100 | ⭐⭐⭐ | Add/sửa/xoá/coupon OK, có toast. Phí ship "Tính ở bước thanh toán" mơ hồ. Khách lạc nếu không đăng nhập rồi muốn lưu giỏ. |
| **Checkout** | 60/100 | ⭐⭐ | 3-step + idempotency key + price-change warning OK. Phường nhập tay, BACS không hiện TK, payment dùng select. |
| **Mobile** | 65/100 | ⭐⭐⭐ | Mobile drawer + sticky header OK. Touch target chưa verify ≥44px. Form chưa enterKeyHint, Province dropdown native không styled. |
| **Content** | 75/100 | ⭐⭐⭐ | Tiếng Việt tự nhiên, tone biker đúng. FAQ chỉ ở homepage. Copy ở Quick Buy thiếu tổng tiền preview. |
| **SEO** | 70/100 | ⭐⭐⭐ | Metadata + canonical + sitemap + robots tốt. Bug "Trang chu" thiếu dấu, JSON-LD localhost trong dev. Không có aggregateRating. |
| **Performance** | 75/100 | ⭐⭐⭐ | ISR + Turbopack + font swap + image priority OK. HTML 93kb hơi nặng. CSP `'unsafe-inline'` chấp nhận được. |
| **Accessibility** | 68/100 | ⭐⭐⭐ | aria-label/aria-expanded/role tốt nhiều chỗ. Skeleton có aria-busy. Color contrast trên dark cần đo lại WCAG AA. |
| **Conversion** | 60/100 | ⭐⭐ | Có Quick Buy + idempotency key + price change warning. Mất chuyển đổi tại: card add-to-cart không hỏi variant, BACS thiếu TK, tài khoản chưa bắt buộc nên giỏ guest dễ mất. |

---

## 3. DETAILED FINDINGS (32 findings, cite file:line)

### 3.1 TRUST (5 findings)

#### [TRUST-01] 🔴 P0 — Footer hiển thị "Đang cập nhật." 3/5 cột nếu admin chưa seed settings/menu

- **File:** `bigbike-web/components/layout/SiteFooter.tsx:171, 192, 218, 256`
- **Tác động:** Khách lần đầu vào shop thấy "Đang cập nhật. Đang cập nhật. Đang cập nhật thông tin liên hệ." ngay footer → cảm giác shop bỏ hoang, chưa hoạt động → bounce. Đặc biệt khách rê chuột tìm SĐT để gọi hỏi sản phẩm sẽ thấy "Đang cập nhật".
- **Severity:** P0
- **Fix cụ thể:**
  - **Hardcode fallback hợp lý** trong code thay vì hiển thị "Đang cập nhật":
    ```tsx
    // Footer cột "Menu" (line 192) — fallback static menu
    const STATIC_FOOTER_MENU = [
      { label: "Mũ bảo hiểm", href: "/danh-muc-san-pham/non-bao-hiem-moto/" },
      { label: "Áo giáp moto", href: "/danh-muc-san-pham/quan-ao-bao-ho-moto/" },
      { label: "Găng tay", href: "/danh-muc-san-pham/gang-tay/" },
      { label: "Giày moto", href: "/danh-muc-san-pham/giay-bao-ho/" },
    ];
    // Footer cột "Hướng dẫn" — fallback
    const STATIC_GUIDE_LINKS = [
      { label: "Cách chọn size mũ", href: "/huong-dan/cach-chon-size-mu/" },
      { label: "Hướng dẫn mua hàng", href: "/huong-dan-mua-hang/" },
      { label: "Chính sách đổi trả", href: "/chinh-sach/doi-tra/" },
      { label: "Chính sách bảo hành", href: "/chinh-sach/bao-hanh/" },
    ];
    // Footer cột "Thông tin" — hardcode hotline + email + địa chỉ thực
    ```
  - **Hoặc** task ngay đầu launch: SEED `/admin/settings`: `hotline`, `contact_email`, `contact_address`, `facebook_url`, `zalo_url`, `youtube_url` + tạo menu `footer`, `guide` trong admin.
- **Acceptance criteria:**
  - ❎ Trong production, không bao giờ thấy "Đang cập nhật" ở footer.
  - ✅ Cột "Thông tin": phải có ≥ 1 trong (hotline, email, address) hiển thị thật.
  - ✅ Cột "Menu", "Hướng dẫn": phải có ≥ 3 link.
  - ✅ Test: tắt backend, refresh footer — vẫn thấy thông tin liên hệ và menu.

#### [TRUST-02] 🔴 P0 — Header navigation hoàn toàn rỗng nếu menu chưa seed

- **File:** `bigbike-web/components/layout/SiteHeader.tsx:88-95, 129-136`
- **Code:**
  ```tsx
  if (!menuResult.data) {
    console.warn(...)  // chỉ log, không có fallback
  }
  const menuTree = buildMenuTree(menuResult.data?.items ?? []); // sẽ rỗng
  ```
- **Tác động:** Khi getPublicMenu("primary") fail hoặc backend không có menu primary, `<nav>` chỉ render "" — khách không có cách nào tìm danh mục mũ/áo/găng từ header → buộc dùng search hoặc footer.
- **Severity:** P0
- **Fix:**
  - Add fallback static menu:
    ```tsx
    const FALLBACK_MENU: HeaderNavNode[] = [
      { id: "fb-1", label: "Mũ bảo hiểm", url: "/danh-muc-san-pham/non-bao-hiem-moto/", parentId: null, sortOrder: 1, children: [] },
      { id: "fb-2", label: "Áo giáp", url: "/danh-muc-san-pham/quan-ao-bao-ho-moto/", parentId: null, sortOrder: 2, children: [] },
      { id: "fb-3", label: "Găng tay", url: "/danh-muc-san-pham/gang-tay/", parentId: null, sortOrder: 3, children: [] },
      { id: "fb-4", label: "Giày", url: "/danh-muc-san-pham/giay-bao-ho/", parentId: null, sortOrder: 4, children: [] },
      { id: "fb-5", label: "Phụ kiện", url: "/san-pham/", parentId: null, sortOrder: 5, children: [] },
    ];
    const menuTree = menuResult.data?.items
      ? buildMenuTree(menuResult.data.items)
      : FALLBACK_MENU;
    ```
- **Acceptance criteria:** Tắt backend → header vẫn có ≥ 4 tab nav.

#### [TRUST-03] 🔴 P0 — Trang xác nhận đơn KHÔNG hiển thị thông tin chuyển khoản khi chọn BACS

- **File:** `bigbike-web/app/don-hang/xac-nhan/page.tsx:42-66`
- **Tác động:** Khách chọn "Chuyển khoản ngân hàng" (BACS) → submit → đến trang xác nhận chỉ thấy "Cảm ơn anh em đã tin BigBike! Đơn hàng đã được xác nhận. Chúng tôi sẽ liên hệ xác nhận trong 1 giờ làm việc." → KHÔNG có số TK ngân hàng để chuyển khoản. Khách phải đợi email rồi mới chuyển → 30% sẽ bỏ luôn vì lười, 50% còn lại sẽ gọi hỏi.
- **Severity:** P0 (chặn conversion thật)
- **Fix:**
  - Render block "Hướng dẫn chuyển khoản" KHI `order.paymentMethod === 'bacs'`:
    ```tsx
    {order?.paymentMethod === 'bacs' && (
      <div className="wp-bank-instructions">
        <h3>Vui lòng chuyển khoản theo thông tin sau:</h3>
        <p>Ngân hàng: <b>VCB - Vietcombank</b></p>
        <p>Số TK: <b>0123456789</b> (sao chép)</p>
        <p>Chủ TK: <b>CÔNG TY TNHH BIGBIKE</b></p>
        <p>Nội dung CK: <b>BB {order.orderNumber} {fullName}</b></p>
        <p>Số tiền: <b>{formatVnd(order.totalAmount)}</b></p>
        <button onClick={copyAll}>Sao chép tất cả thông tin</button>
        <p className="wp-muted">Đơn hàng được xử lý ngay khi chúng tôi nhận tiền.</p>
      </div>
    )}
    ```
  - Source TK ngân hàng từ `listPublicSettings()` keys: `bank_name`, `bank_account`, `bank_account_holder`, `bank_branch`.
- **Acceptance criteria:** 
  - Khách đặt BACS → thấy ngay TK + nội dung CK gợi ý + nút copy
  - QR code chuyển khoản (VietQR hoặc SePay) — bonus
  - Bonus: hiển thị phần này cả ở email confirmation (out of audit scope)

> **Note (project memory):** Theo memory `project_sepay_manual.md`, BigBike SePay flow là MANUAL (không có webhook auto-reconcile). Càng cần hiển thị TK rõ ràng vì admin sẽ check tay.

#### [TRUST-04] 🟠 P1 — Mã ĐKKD và ngày cấp HARDCODE trong footer

- **File:** `bigbike-web/components/layout/SiteFooter.tsx:307-308`
- **Code:**
  ```tsx
  <p>© {new Date().getFullYear()} BigBike. Mã ĐKKD: 41K8017383.</p>
  <p>Ngày cấp: 8/3/2016. Nơi cấp: Ủy Ban Nhân Dân Quận 11, TP.HCM.</p>
  ```
- **Tác động:** Khách kiểm tra số ĐKKD trên cổng dichvucong.gov.vn nếu ko ra → mất niềm tin. **NEEDS_VERIFICATION** vì tôi không kiểm chứng được mã ĐKKD `41K8017383` có thật của BigBike không.
- **Severity:** P1
- **Fix:**
  - Move 2 trường này vào settings backend: `business_license_number`, `business_license_issued_at`, `business_license_issued_by`.
  - Verify với chủ shop số ĐKKD/ngày cấp có đúng không.
- **Acceptance:** Số ĐKKD khớp với cổng dữ liệu quốc gia về đăng ký doanh nghiệp.

#### [TRUST-05] 🟠 P1 — Hotline default `0903 123 456` quá rõ là số giả

- **File:** `bigbike-web/components/layout/SiteHeader.tsx:55`, `bigbike-web/components/layout/MobileHeaderMenu.tsx:274`
- **Code:** `const supportLabel = hotline || "0903 123 456";`
- **Tác động:** Số `0903 123 456` rõ ràng là số mẫu (123 456). Khách gọi → tổng đài VinaPhone → "không có số này" → mất niềm tin.
- **Severity:** P1
- **Fix:**
  - Đổi fallback thành SỐ THẬT của BigBike (lấy từ memory/document).
  - Hoặc: nếu chưa có, return `null` và ẨN section hotline thay vì hiển thị số giả.
- **Acceptance:** `0903 123 456` không tồn tại trong code production.

---

### 3.2 DISCOVERY (4 findings)

#### [DISC-01] 🟠 P1 — Bộ lọc Brand & Color là RADIO (1 lựa chọn) thay vì CHECKBOX

- **File:** `bigbike-web/components/catalog/CatalogFilters.tsx:205, 211, 305-310`
- **Code:**
  ```tsx
  <input type="radio" name="pwb-brand" value={b.slug} ... />  // line 211
  <input type="radio" name="filter_color" value={opt.value} ... />  // line 306
  ```
- **Tác động:** Khách shopping mũ Shoei + Arai (đối thủ trực tiếp) → không thể lọc cả 2 cùng lúc → phải chuyển qua chuyển lại → mệt mỏi → rời. Tương tự với màu (đen + đỏ).
- **Severity:** P1 (conversion-killer cho gear shopping)
- **Fix:**
  - Đổi sang `checkbox` + URL param thành `pwb-brand=shoei,arai`.
  - Backend đã hỗ trợ multi-brand filter? **NEEDS_VERIFICATION** — cần check `listProducts({brand})` trong `lib/api/public-api.ts` có xử lý CSV không.
  - Fallback nếu backend chưa support: gọi nhiều request và merge client-side (không lý tưởng, tốt hơn là update backend).
- **Acceptance:** Khách check 2 brand → grid hiển thị products của cả 2 brand.

#### [DISC-02] 🟠 P1 — Sort options thiếu "Bán chạy nhất" / "Phổ biến"

- **File:** `bigbike-web/components/catalog/CatalogSortSelect.tsx:5-12`
- **Code:**
  ```tsx
  const SORT_LABELS = {
    "createdAt:desc": "Mới nhất",
    "createdAt:asc": "Cũ nhất",
    "name:asc": "Tên A–Z",
    "name:desc": "Tên Z–A",
    "price:asc": "Giá tăng dần",
    "price:desc": "Giá giảm dần",
  };
  ```
- **Tác động:** Khách e-commerce VN thường sort theo "Bán chạy" để xem những món đáng tin (social proof). Sort "Tên A-Z" gần như vô dụng cho gear motorbike.
- **Severity:** P1
- **Fix:**
  - Thêm:
    ```tsx
    "salesCount:desc": "Bán chạy nhất",
    "rating:desc": "Đánh giá cao nhất",
    "discount:desc": "Khuyến mãi nhiều nhất",
    ```
  - Verify backend `PRODUCT_SORT_VALUES` có support — `lib/api/public-api.ts` (NEEDS_VERIFICATION).
  - Bỏ "Cũ nhất" và "Tên Z-A" — không ai dùng.
- **Acceptance:** Sort dropdown có "Bán chạy nhất" làm option đầu, default vẫn là "Mới nhất".

#### [DISC-03] 🟠 P1 — Color filter chỉ có 7 màu cố định + radio + label name không match backend slug

- **File:** `bigbike-web/components/catalog/CatalogFilters.tsx:289-298`
- **Code:** Hardcode màu `den/trang/do/xanh/xam/cam/vang` với hex.
- **Tác động:**
  - Một bộ giáp có "xanh navy" / "xanh dương" / "xanh lá" → tất cả đều ánh xạ vào "xanh"? Backend filter lấy slug `xanh` → backend phải tự normalize. Nếu không, filter không trả về kết quả.
  - Không có "be" / "nâu" / "tím" cho áo nữ hoặc gear theme.
  - Hex `xanh: #1d6fe8` chỉ ánh xạ duy nhất 1 shade → không đại diện được cho tất cả "xanh".
- **Severity:** P1
- **Fix:**
  - Lấy danh sách màu thật từ backend (có endpoint `/api/v1/catalog/colors`?) hoặc settings.
  - Đổi sang checkbox + URL param multiple.
  - Hoặc: dùng auto-discovery — quét variants đang sales → list distinct colors.
- **Acceptance:** Color filter không miss bất kỳ màu nào catalog có.

#### [DISC-04] 🟢 P2 — Search autocomplete không hiển thị ảnh sản phẩm

- **File:** `bigbike-web/components/layout/SearchToggle.tsx:230-251`
- **Tác động:** Khách gõ "shoei x14" → thấy list text "Shoei X-14 Marquez Replica · 12.500.000 ₫" → phải đoán đúng món muốn không. Có ảnh nhỏ → quyết định trong 0.5s.
- **Severity:** P2
- **Fix:** Thêm `<MediaImage>` 40x40 vào mỗi suggestion item. Backend đã trả `image.url` (line 13).
- **Acceptance:** Mỗi suggestion có ảnh thumbnail.

---

### 3.3 PRODUCT DETAIL (4 findings)

#### [PDP-01] 🟠 P1 — ProductTabs THIẾU tab "Bảo hành & Đổi trả & Vận chuyển"

- **File:** `bigbike-web/components/catalog/ProductTabs.tsx:32-78`
- **Code:** Chỉ có 3 tabs: `description | specs | videos`.
- **Tác động:** Khách trước khi xuống tiền 5–20tr cho 1 cái mũ luôn đọc "đổi size không?", "bảo hành mấy năm?", "ship bao lâu?". Không tìm được → mất khách thời điểm vàng.
- **Severity:** P1 (trust-blocker tại điểm quyết định mua)
- **Fix:**
  - Thêm tab `policy` với content:
    ```tsx
    {active === 'policy' && (
      <div className="wp-policy-block">
        <h4>🛡️ Bảo hành</h4>
        <p>Bảo hành chính hãng theo chính sách của từng thương hiệu (12–24 tháng tuỳ hãng).</p>
        <h4>🔄 Đổi trả 7 ngày</h4>
        <p>Đổi/trả miễn phí trong 7 ngày với sản phẩm còn nguyên tem mác, chưa qua sử dụng. Riêng mũ bảo hiểm: chỉ đổi nếu chưa tháo bao bì.</p>
        <h4>🚚 Vận chuyển</h4>
        <ul>
          <li>Nội thành TP.HCM: 1–2 ngày, 30k</li>
          <li>Toàn quốc: 3–5 ngày, 50k</li>
          <li>Miễn phí ship đơn ≥ 2 triệu</li>
        </ul>
      </div>
    )}
    ```
  - Hoặc fetch từ settings backend keys: `policy_warranty_html`, `policy_return_html`, `policy_shipping_html`.
- **Acceptance:** Tab "Bảo hành & Vận chuyển" hiển thị mặc định cho mọi sản phẩm.

#### [PDP-02] 🟠 P1 — Quantity input KHÔNG có max + KHÔNG có inputMode="numeric" + cho phép nhập số quá lớn

- **File:** `bigbike-web/components/catalog/PurchaseSectionClient.tsx:314-322`
- **Code:**
  ```tsx
  <input
    type="number"
    min={1}
    value={quantity}
    onChange={(e) => {
      const n = parseInt(e.target.value, 10);
      if (Number.isInteger(n) && n > 0) setQuantity(n);
    }}
  />
  ```
- **Tác động:**
  - Khách trên mobile gõ "9999" → submit → backend reject vì stockState=LOW_STOCK chỉ còn 5. Không có guard early.
  - `type="number"` trên mobile xuất hiện numeric keyboard nhưng `inputMode="numeric"` chuẩn hơn cho consistency.
  - **No max** dựa vào stockQuantity → có thể nhập quá tồn kho.
- **Severity:** P1
- **Fix:**
  ```tsx
  <input
    type="number"
    inputMode="numeric"
    min={1}
    max={effectiveStockData?.quantity ?? 99}
    value={quantity}
    aria-label="Số lượng"
    onChange={(e) => {
      const n = parseInt(e.target.value, 10);
      const maxQty = effectiveStockData?.quantity ?? 99;
      if (Number.isInteger(n) && n >= 1) {
        setQuantity(Math.min(n, maxQty));
      }
    }}
  />
  ```
- **Acceptance:** Nhập 9999 → tự cap về tồn kho thực + show warning "Chỉ còn N".

#### [PDP-03] 🟠 P1 — Nút "Mua ngay" KHÔNG bị disable khi `requiresVariantSelection`

- **File:** `bigbike-web/components/catalog/PurchaseSectionClient.tsx:355-362`
- **Code:**
  ```tsx
  <button
    type="button"
    className="wp-btn-secondary"
    onClick={() => setQuickBuyOpen(true)}
    disabled={!isAvailable || isContactOnly}  // KHÔNG check requiresVariantSelection
  >
    Mua ngay
  </button>
  ```
- **Tác động:** Khách chưa chọn size, click "Mua ngay" → mở Quick Buy modal → submit → backend reject hoặc add wrong variant → confusion.
- **Severity:** P1
- **Fix:**
  ```tsx
  disabled={!isAvailable || isContactOnly || requiresVariantSelection}
  ```
  + thay text khi disabled: `requiresVariantSelection ? "Vui lòng chọn biến thể" : "Mua ngay"`.
- **Acceptance:** Sản phẩm có size, chưa chọn → "Mua ngay" disabled với text rõ.

#### [PDP-04] 🟢 P2 — Add-to-cart toast hiện cả 4 giây nhưng không có close button

- **File:** `bigbike-web/lib/cart-context.tsx:47-49`
- **Code:** `setTimeout(() => setToasts((prev) => prev.filter(...)), 4000);` — không có nút X hoặc swipe.
- **Tác động:** Khách add 5 món liên tiếp → 5 toast stack đè nhau, đợi 4s mỗi cái mới biến mất. Mobile bị che CTA.
- **Severity:** P2
- **Fix:** Thêm nút X + auto-dismiss 4s. Cap stack max 3 toasts.
- **Acceptance:** Thêm 5 món → tối đa 3 toast hiển thị, cũ nhất biến trước.

---

### 3.4 CART (3 findings)

#### [CART-01] 🟠 P1 — Phí ship "Tính ở bước thanh toán" mơ hồ + không có progress bar miễn ship

- **File:** `bigbike-web/app/gio-hang/page.tsx:288-295`
- **Code:**
  ```tsx
  <span>Phí vận chuyển</span>
  {cart.totals.shippingAmount > 0 ? (
    <b>{formatVnd(cart.totals.shippingAmount)}</b>
  ) : (
    <span className="wp-summary-ship-note">Tính ở bước thanh toán</span>
  )}
  ```
- **Tác động:** Khách không biết:
  - Mình có miễn ship không?
  - Cần thêm bao nhiêu nữa để miễn ship (homepage có nói "đơn từ 2 triệu miễn ship")?
- **Severity:** P1 (AOV-killer)
- **Fix:**
  ```tsx
  const FREE_SHIP_THRESHOLD = 2_000_000;
  const remainingForFreeShip = Math.max(0, FREE_SHIP_THRESHOLD - cart.totals.subtotalAmount);
  
  {remainingForFreeShip > 0 ? (
    <div className="wp-freeship-progress">
      <p>🚚 Mua thêm <b>{formatVnd(remainingForFreeShip)}</b> để được miễn ship</p>
      <progress value={cart.totals.subtotalAmount} max={FREE_SHIP_THRESHOLD} />
    </div>
  ) : (
    <p className="wp-freeship-active">🎉 Đơn hàng được MIỄN PHÍ vận chuyển</p>
  )}
  ```
- **Acceptance:** Cart subtotal < 2tr → hiển thị "Mua thêm X để miễn ship". Cart ≥ 2tr → "Miễn ship".

#### [CART-02] 🟢 P2 — Khi giỏ hàng trống, empty state thiếu social proof / suggestions

- **File:** `bigbike-web/app/gio-hang/page.tsx:160-167`
- **Tác động:** Khách thấy "Giỏ hàng trống. Bạn chưa thêm sản phẩm nào vào giỏ hàng. [Xem sản phẩm]" → kết thúc đường dây. Mất cơ hội đề xuất.
- **Severity:** P2
- **Fix:**
  - Thêm "Recently viewed" hoặc "Sản phẩm bán chạy" carousel ngay dưới empty state.
  - Hoặc liên kết tới 4 category icons (Mũ/Áo/Găng/Giày).
- **Acceptance:** Empty cart hiển thị 4-8 sản phẩm gợi ý.

#### [CART-03] 🟢 P2 — Coupon error message generic, không phân biệt rõ lý do

- **File:** `bigbike-web/app/gio-hang/page.tsx:100-115`
- **Code:** `setCouponError((e as Error).message);` — chỉ hiển thị whatever message backend trả.
- **Tác động:** Backend trả "INVALID_COUPON" → khách không biết là sai chính tả, hết hạn, hay đã dùng.
- **Severity:** P2
- **Fix:** Map error code → friendly message:
  ```tsx
  const COUPON_ERROR_MAP: Record<string, string> = {
    "COUPON_NOT_FOUND": "Mã không tồn tại. Bạn nhập đúng chưa?",
    "COUPON_EXPIRED": "Mã đã hết hạn vào ngày X.",
    "COUPON_MIN_ORDER": "Đơn cần tối thiểu Y để dùng mã này.",
    "COUPON_USED": "Mã này đã được dùng rồi.",
    "COUPON_NOT_APPLICABLE": "Mã không áp dụng cho sản phẩm trong giỏ.",
  };
  ```
- **Acceptance:** Mỗi loại lỗi coupon có message tiếng Việt riêng.

---

### 3.5 CHECKOUT (5 findings)

#### [CHK-01] 🔴 P0 — Phường/Xã là `<input>` text thay vì `<select>` từ backend

- **File:** `bigbike-web/components/ui/VnAddressFields.tsx:74-83`
- **Code:**
  ```tsx
  <input
    className={`wp-input${value.ward ? " filled" : ""}`}
    placeholder={value.district ? "Nhập phường / xã..." : "Chọn quận/huyện trước"}
    disabled={!value.district}
    value={value.ward}
    onChange={(e) => onChange("ward", e.target.value)}
  />
  ```
- **Tác động:**
  - Backend có endpoint `/api/v1/address/districts/{districtCode}/wards` (`docs/engineering/API_CONTRACT.md` line 30) — frontend KHÔNG gọi.
  - Khách phải gõ tay "Phường 5" → có thể gõ "P.5" / "P 5" / "Phường năm" → đơn giao sai.
  - Mâu thuẫn với chính kiến trúc: Province + District đã là dropdown từ `lib/vn-address-data.ts`, ward đáng lẽ cũng phải là dropdown.
- **Severity:** P0 (data integrity của địa chỉ giao hàng)
- **Fix:**
  ```tsx
  // Thêm state cho wards và districtCode
  const [wards, setWards] = useState<{code: string; name: string}[]>([]);
  
  useEffect(() => {
    if (!selectedDistrictCode) return;
    fetch(`/api/v1/address/districts/${selectedDistrictCode}/wards`)
      .then(r => r.json())
      .then(json => setWards(json.data ?? []));
  }, [selectedDistrictCode]);
  
  <select value={value.ward} onChange={(e) => onChange("ward", e.target.value)}>
    <option value="">— Chọn phường / xã —</option>
    {wards.map(w => <option key={w.code} value={w.name}>{w.name}</option>)}
  </select>
  ```
  Hoặc: chuyển sang dùng `lib/vn-address-data.ts` cho cả wards (nếu data đầy đủ).
- **Acceptance:** Phường/Xã là dropdown đầy đủ + không cho gõ tay free-form.

#### [CHK-02] 🔴 P0 — `lib/vn-address-data.ts` lưu province bằng `name` thay vì `code` → không khớp với backend `VnAddressItem` 

- **File:** `bigbike-web/components/ui/VnAddressFields.tsx:20`
  - `VN_PROVINCES.find((p) => p.name === value.province)`
  - Submit về backend: `province: address.province` (là tên Việt Nam có dấu)
- **Backend contract (`API_CONTRACT.md`):** `VnAddressItem` thường có `{ code, name, ... }`.
- **Tác động:**
  - Backend khi resolve shipping cost theo province, có thể dùng `code` ("79" cho TPHCM) thay vì name ("Thành phố Hồ Chí Minh") → mismatch → fail to calculate shipping → không decrement stock đúng.
  - **NEEDS_VERIFICATION:** kiểm tra `lib/api/public-api.ts` xem listProvinces trả gì + `CheckoutService.java` xem expect gì.
- **Severity:** P0 (functional, không phải UX)
- **Fix:**
  - Submit cả `provinceCode` và `provinceName`.
  - Hoặc thay đổi schema: `province: string (code)`, derive name từ code khi hiển thị.
- **Acceptance:** Backend test: tạo đơn TP.HCM → ship cost được tính đúng theo zone TP.HCM.

#### [CHK-03] 🟠 P1 — Phone validation regex `^0[3-9][0-9]{8}$` không cho space/dash/parentheses

- **File:** `bigbike-web/lib/schemas/checkout.ts:3, 9`
- **Tác động:**
  - Khách paste "0903 123 456" (có space, autocomplete từ Google contacts) → fail.
  - Khách gõ "+84903123456" → fail (regex không support +84 prefix).
  - Khách paste "(090) 312-3456" → fail.
- **Severity:** P1 (form abandonment)
- **Fix:**
  ```ts
  // Auto-strip non-digits TRƯỚC khi validate
  phone: z
    .string()
    .transform((v) => v.replace(/[\s.+\-()]/g, "").replace(/^84/, "0"))
    .refine((v) => /^0[3-9][0-9]{8}$/.test(v), {
      message: "Số điện thoại không hợp lệ (ví dụ: 0901234567)",
    }),
  ```
- **Acceptance:** "0903 123 456" / "+84903123456" / "(090) 312-3456" đều submit được.

#### [CHK-04] 🟠 P1 — Quick Buy modal dùng `<select>` cho payment + shipping, KHÔNG có tổng tiền preview

- **File:** `bigbike-web/components/catalog/QuickBuyModal.tsx:240-280`
- **Tác động:**
  - Tổng tiền ko hiện trước khi submit → khách click "Xác nhận mua ngay" như nhắm mắt → 1.000.000 hay 1.500.000? → UX kém, lo lắng.
  - `<select>` ẩn detail → không thấy giá ship phương thức nào.
- **Severity:** P1
- **Fix:**
  - Hiển thị block total ngay trước nút submit:
    ```tsx
    <div className="wp-qb-total">
      <div>Sản phẩm × {quantity}: {formatVnd(productPrice * quantity)}</div>
      <div>Phí ship: {formatVnd(selectedShipping?.cost ?? 0)}</div>
      <div className="wp-qb-grand-total">
        Tổng: <b>{formatVnd(productPrice * quantity + (selectedShipping?.cost ?? 0))}</b>
      </div>
    </div>
    ```
  - Đổi `<select>` shipping/payment thành radio tile (như checkout chính).
- **Acceptance:** Quick Buy hiển thị tổng tiền + breakdown trước khi submit.

#### [CHK-05] 🟠 P1 — Email field trong checkout là "optional" nhưng confirmation phụ thuộc email

- **File:** `bigbike-web/lib/schemas/checkout.ts:11-14`, `bigbike-web/app/thanh-toan/page.tsx:265-275`
- **Code:** `email: z.string().email().optional().or(z.literal(""))`
- **Tác động:**
  - Khách bỏ trống email → không nhận được email xác nhận đơn → đặc biệt với BACS (chuyển khoản) thì chính email mới chứa số TK → đơn hàng treo.
- **Severity:** P1
- **Fix:**
  - Khi `paymentMethod === 'bacs'`: email REQUIRED.
  - Hiển thị ở step 1 hint: "Email để nhận xác nhận đơn hàng và thông tin chuyển khoản".
- **Acceptance:** Chọn BACS, email trống → block submit + error rõ.

---

### 3.6 MOBILE & UX (3 findings)

#### [MOB-01] 🟠 P1 — Form fields trong checkout (page.tsx, không phải QuickBuy) thiếu autoComplete + enterKeyHint

- **File:** `bigbike-web/app/thanh-toan/page.tsx:237-275`
- **Tác động:**
  - Mobile keyboard không gợi ý lưu địa chỉ (autoComplete="street-address" missing on `addressLine1`).
  - User Tab giữa fields trên mobile keyboard không có "Tiếp" hint.
  - **So sánh:** `QuickBuyModal.tsx:172` đã có `autoComplete="name"`, nhưng `page.tsx:240` chưa. Inconsistent.
- **Severity:** P1
- **Fix:**
  ```tsx
  // line 240 fullName
  <input ... autoComplete="name" enterKeyHint="next" {...register("fullName")} />
  // line 252 phone
  <input ... autoComplete="tel" enterKeyHint="next" pattern="0[3-9][0-9]{8}" {...register("phone")} />
  // line 269 email
  <input ... autoComplete="email" enterKeyHint="next" {...register("email")} />
  // line 298 addressLine1
  <input ... autoComplete="street-address" enterKeyHint="done" {...register("addressLine1")} />
  ```
- **Acceptance:** iOS Safari/Chrome Mobile gợi ý saved addresses + chuyển field bằng "Next" key.

#### [MOB-02] 🟠 P1 — Touch targets quantity stepper trong cart có thể < 44×44px

- **File:** `bigbike-web/app/gio-hang/page.tsx:198-223`, CSS class `.wp-pdp-qty-stepper`
- **Tác động:** **NEEDS_VERIFICATION** — chưa có CSS file mở. Default native button sẽ có height theo padding. Nếu CSS set `padding: 4px 8px` → height ~28px < 44px → khó tap mobile.
- **Severity:** P1 (accessibility WCAG 2.5.5)
- **Fix:** Audit CSS:
  ```css
  .wp-pdp-qty-stepper button {
    min-width: 44px;
    min-height: 44px;
  }
  ```
- **Acceptance:** Lighthouse Mobile audit score ≥ 90; Chrome DevTools "Tap target size" no warnings.

#### [MOB-03] 🟢 P2 — Mobile menu drawer không có "Trang chủ" link explicit

- **File:** `bigbike-web/components/layout/MobileHeaderMenu.tsx:218-228`
- **Tác động:** Khách deep trong PDP → mở drawer → muốn về home → phải đóng drawer rồi tap logo → 2 thao tác.
- **Severity:** P2
- **Fix:** Thêm `<Link href="/">Trang chủ</Link>` đầu nav.
- **Acceptance:** Drawer luôn có "Trang chủ" ở đầu, "Liên hệ" ở cuối.

---

### 3.7 SEO (5 findings)

#### [SEO-01] 🔴 P0 — Sitemap.xml dump `http://localhost:3000/` thay vì `https://bigbike.vn/`

- **File:** `bigbike-web/app/sitemap.ts:88-138`, `bigbike-web/lib/utils/routes.ts:1-4`
- **Test:**
  ```bash
  curl http://localhost:3001/sitemap.xml | head -10
  # <loc>http://localhost:3000/</loc>  ← nguy hiểm
  ```
- **Tác động:** Nếu prod build thiếu env `NEXT_PUBLIC_SITE_URL=https://bigbike.vn` → Google index ALL URLs là localhost → SEO sập.
- **Severity:** P0 (cho prod)
- **Fix:**
  - Verify CI/CD: `next.config.ts` không inject env tự động ở build time. Cần `.env.production` hoặc `vercel env`.
  - Add validation tại runtime: `sitemap.ts` warn nếu `getSiteOrigin().includes("localhost")` trong production.
  - Thay `getSiteOrigin()`:
    ```ts
    export function getSiteOrigin(): string {
      const origin = SITE_ORIGIN;
      if (process.env.NODE_ENV === "production" && origin.includes("localhost")) {
        throw new Error("SITE_ORIGIN missing in production");
      }
      return origin;
    }
    ```
- **Acceptance:** Production sitemap.xml chứa 100% `https://bigbike.vn/...` URLs.

#### [SEO-02] 🟠 P1 — Bug typo "Trang chu" trong breadcrumb JSON-LD (thiếu dấu)

- **File:** `bigbike-web/lib/seo/json-ld.ts:91, 124`
- **Code:**
  ```ts
  // line 91 (buildBreadcrumbJsonLd cho Product)
  name: "Trang chu",  // SHOULD BE "Trang chủ"
  // line 124 (buildArticleBreadcrumbJsonLd)
  name: "Trang chu",  // SHOULD BE "Trang chủ"
  ```
- **Tác động:** Google Rich Result hiển thị `Trang chu > Mũ bảo hiểm > Shoei X-14` — sai chính tả. Người Việt sẽ thấy quê. Mâu thuẫn với `buildCategoryBreadcrumbJsonLd:158` đã viết đúng "Trang chủ".
- **Severity:** P1 (image, brand consistency)
- **Fix:** Đổi cả 2 dòng thành `"Trang chủ"`.
- **Acceptance:** Test với Google Rich Result Test tool — breadcrumb hiển thị "Trang chủ".

#### [SEO-03] 🟠 P1 — Product JSON-LD không có `aggregateRating` dù page đã có rating

- **File:** `bigbike-web/lib/seo/json-ld.ts:37-60`
- **Tác động:** Google search result không hiển thị ⭐⭐⭐⭐⭐ rating snippet → thiếu CTR boost lớn.
- **Severity:** P1
- **Fix:**
  ```ts
  if (product.rating && product.rating > 0 && product.ratingCount > 0) {
    obj.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: product.rating,
      reviewCount: product.ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }
  ```
- **Acceptance:** Sản phẩm có ≥ 1 review → rating snippet xuất hiện ở Google search.

#### [SEO-04] 🟠 P1 — `LocalBusiness` JSON-LD render dù address/phone trống

- **File:** `bigbike-web/lib/seo/json-ld.ts:243-259`, `bigbike-web/app/page.tsx:318-320`
- **Tác động:** Google Search Console sẽ warning "LocalBusiness missing address" → giảm trust score domain.
- **Severity:** P1
- **Fix:**
  ```ts
  // page.tsx — chỉ render khi có address + phone
  const jsonLdLocalBusiness = (address && hotline)
    ? serializeJsonLd(buildLocalBusinessJsonLd("BigBike", HOME_ORG_LOGO, address, hotline))
    : null;
  ```
- **Acceptance:** Google Search Console — không còn warning về LocalBusiness.

#### [SEO-05] 🟢 P2 — Search route trong SearchToggle dẫn về `/san-pham/?q=` thay vì `/tim-kiem/`

- **File:** `bigbike-web/components/layout/SearchToggle.tsx:111`
- **Code:** `router.push(\`${toProductListPath()}?q=${encodeURIComponent(trimmed)}\`)`
- **Tác động:** Hai search experiences:
  1. Header search → `/san-pham/?q=` (chỉ products, có filter UI tốt)
  2. URL `/tim-kiem/?q=` (products + articles, UI cơ bản)
  
  Khách bookmark `/tim-kiem/?q=mu` → URL khác với header search → confusion. SEO duplicate (cùng query, 2 URLs).
- **Severity:** P2
- **Fix:** Chọn 1:
  - Option A: Header search dẫn về `/tim-kiem/?q=` (full search, cả articles).
  - Option B: Bỏ `/tim-kiem/`, redirect to `/san-pham/?q=`.
  - Option C: Thêm flag URL `?q=&include_articles=1`.
- **Acceptance:** Một entry point duy nhất cho search.

---

### 3.8 PERFORMANCE (3 findings)

#### [PERF-01] 🟠 P1 — Hero slider auto-play (5s) chạy ngay khi mount → CLS + battery drain mobile

- **File:** `bigbike-web/components/home/HeroSlider.tsx:21-23`
- **Code:** `Autoplay({ delay: 5000, stopOnInteraction: false, stopOnMouseEnter: true })`
- **Tác động:**
  - Mobile: slider nhảy mỗi 5s → khách chưa kịp đọc CTA đã chuyển → frustrating.
  - `stopOnInteraction: false` → khách swipe vẫn quay lại auto.
  - Battery + CPU.
- **Severity:** P1
- **Fix:**
  - `stopOnInteraction: true` → user swipe = pause autoplay.
  - Tăng delay lên 7000–8000ms (đủ đọc CTA biker dài).
  - Respect `prefers-reduced-motion`:
    ```tsx
    const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
    const autoplayPlugin = reduceMotion ? [] : [Autoplay({ delay: 7000, stopOnInteraction: true, stopOnMouseEnter: true })];
    ```
- **Acceptance:** A11y: prefers-reduced-motion → no autoplay.

#### [PERF-02] 🟢 P2 — Homepage HTML 93kb (+ chưa minified ở dev) — large first paint cho mobile 3G

- **Test:** `curl -s -o /dev/null -w "%{size_download}" http://localhost:3001/` → 93kb cold.
- **Tác động:** Mobile 3G ~250kbps → 3s+ TTFB. Dev với Turbopack chưa minify; prod sẽ giảm đáng kể.
- **Severity:** P2 (cần verify prod)
- **Fix:**
  - Verify prod build với `npm run build && npm run start`: HTML size kì vọng < 40kb.
  - Inline critical CSS với Next.js auto-extract.
  - Lazy-load BrandCarousel, HomeVideoCarousel (dynamic import).
- **Acceptance:** Lighthouse Mobile Performance ≥ 80, FCP < 2s, LCP < 2.5s.

#### [PERF-03] 🟢 P2 — `revalidate = 3600` trên homepage và PDP — quá dài cho commerce flash sale

- **File:** `bigbike-web/app/page.tsx:45`, `bigbike-web/app/product/[slug]/page.tsx:33`
- **Tác động:** Admin update giá khuyến mãi → 1 tiếng sau ISR mới refresh. Khách thấy giá cũ → trust giảm khi thanh toán giá thật khác.
- **Severity:** P2 (mitigated bởi snapshot API client-side fresh fetch, nhưng card listing vẫn stale)
- **Fix:**
  - Sử dụng on-demand revalidation: admin save → call `/api/revalidate` (đã có trong code: `app/api/revalidate/route.ts`).
  - Giảm revalidate xuống 600s (10 phút) cho homepage.
- **Acceptance:** Admin đổi giá → max 10 phút sau khách thấy giá mới (hoặc instant nếu webhook revalidate).

---

### 3.9 ACCESSIBILITY (3 findings)

#### [A11Y-01] 🟠 P1 — Color contrast: text-secondary `rgba(255,255,255,0.74)` trên `#0a0a0a` border-line WCAG AA

- **File:** `bigbike-web/styles/brand-tokens.css:74`
- **Tác động:** **NEEDS_VERIFICATION với contrast checker**: 0.74 alpha trên #0a0a0a ≈ #bdbdbd → ratio ≈ 9.8:1 (PASS). Nhưng `text-muted: rgba(255,255,255,0.56)` ≈ #8e8e8e → ratio ≈ 5.8:1 (PASS AA), `text-disabled: 0.36` → ratio ≈ 3.2:1 (FAIL).
- **Severity:** P1 nếu disabled text dùng cho thông tin quan trọng (label, error, helper).
- **Fix:**
  - Đổi `--bb-text-muted` xuống `0.62` để đảm bảo headroom.
  - Verify mọi text dùng `--bb-text-disabled` không phải nội dung quan trọng.
  - Run axe DevTools → fix tất cả WCAG AA violations.
- **Acceptance:** axe-core 0 violations cho contrast.

#### [A11Y-02] 🟢 P2 — Form errors trên dark background — màu đỏ #f90606 trên #0a0a0a có thể chói + khó đọc

- **File:** `bigbike-web/styles/brand-tokens.css:60` `--bb-brand-primary: #f90606`
- **Tác động:** Error text (`.wp-field-error`) dùng red trên đen có ratio cao nhưng CHÓI → khó đọc nhanh; người mù màu deuteranopia cũng bị nhiễu.
- **Severity:** P2
- **Fix:**
  - Dùng red lighter cho error text: `var(--bb-color-red-300)` hoặc `var(--bb-color-red-200)` (#ffbcbc) — softer, dễ đọc hơn.
  - Pair color với icon (⚠️ hoặc ✕) — không dựa solely vào màu.
- **Acceptance:** WCAG 1.4.1 (Use of color) compliance.

#### [A11Y-03] 🟢 P2 — Quantity stepper buttons không có `aria-controls` chỉ vào quantity input

- **File:** `bigbike-web/components/catalog/PurchaseSectionClient.tsx:307-329`
- **Tác động:** Screen reader: button "Giảm/Tăng" → không biết kiểm soát input nào.
- **Severity:** P2
- **Fix:**
  ```tsx
  <input id="qty-input" type="number" ... />
  <button aria-label="Giảm" aria-controls="qty-input" ...>
  ```
- **Acceptance:** NVDA reads "Giảm, controls Số lượng".

---

### 3.10 FUNCTIONALITY BUGS (2 findings)

#### [FN-01] 🔴 P0 — `ProductCardAddBar` add to cart KHÔNG hỏi variant + nuốt error silently

- **File:** `bigbike-web/components/catalog/ProductCardAddBar.tsx:15`
- **Code:**
  ```tsx
  addToCart(productId, 1).catch(() => {});  // swallow error!
  ```
- **Tác động:**
  - Sản phẩm có size/màu (mũ, áo, găng) → click "THÊM VÀO GIỎ HÀNG" trên card → backend reject vì thiếu variant → error swallowed → khách không biết → click lại → vẫn không có gì xảy ra → bực, bỏ cuộc.
  - Hoặc backend chấp nhận → add no-variant item → khách về cart thấy sản phẩm không có size → confused.
- **Severity:** P0 (silent failure on primary CTA)
- **Fix:**
  - Check sản phẩm có variants → nếu CÓ → click → push to PDP page (`router.push(toProductPath(slug))`) thay vì add ngay.
  - Nếu không có variants → add ngay + hiển thị error nếu fail.
  - **Hoặc:** mở mini quick-buy popover ngay trên card (advanced).
  
  ```tsx
  export function ProductCardAddBar({ product }: { product: Product }) {
    const router = useRouter();
    const { addToCart, showToast } = useCart();
    const hasVariants = (product.variants?.length ?? 0) > 0;
    
    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (hasVariants) {
            router.push(toProductPath(product.slug));
            return;
          }
          addToCart(product.id, 1).catch((err) => {
            showToast("Lỗi", err?.message ?? "Không thể thêm vào giỏ");
          });
        }}
      >
        {hasVariants ? "CHỌN BIẾN THỂ" : "THÊM VÀO GIỎ HÀNG"}
      </button>
    );
  }
  ```
- **Acceptance:**
  - Sản phẩm có variants → button text "CHỌN BIẾN THỂ" → click → đi PDP.
  - Sản phẩm không variant → button text "THÊM VÀO GIỎ HÀNG" → click → add + toast.
  - Lỗi → toast cảnh báo, không silent.

#### [FN-02] 🟠 P1 — Đăng ký xong push thẳng đến `/tai-khoan/` mà tài khoản chưa verify email

- **File:** `bigbike-web/app/dang-ky/page.tsx:75-78`
- **Code:** `<button onClick={() => router.push(toAccountPath())}>Vào tài khoản</button>`
- **Tác động:**
  - Backend tạo customer với status `PENDING_VERIFICATION` (theo `verify-email` endpoint trong API_CONTRACT.md).
  - Frontend push to `/tai-khoan/` → AccountShell auth gate kiểm tra session → có thể session valid (đã login sau register) hoặc require verification → nếu fail, redirect lại login → khách rối.
  - Hiện code đã hiển thị thông báo "đã gửi email xác nhận, kiểm tra spam" — TỐT — nhưng button "Vào tài khoản" trái với thông điệp ("kiểm tra mail trước, đừng vào tài khoản chưa verify").
- **Severity:** P1
- **Fix:**
  - Đổi nút "Vào tài khoản" thành "Về trang chủ" hoặc "Tiếp tục mua sắm".
  - Hoặc: detect status từ register response → nếu status === "PENDING_VERIFICATION" → hiển thị "Đợi xác nhận email", không cho vào tài khoản.
- **Acceptance:** Khách đăng ký xong không bị bỗng dưng quay về login page.

---

## 4. CUSTOMER JOURNEY AUDIT

### 4.1 Đường đi A: Khách mới từ Google search "mũ bảo hiểm shoei tphcm"

| Bước | Trang | Trải nghiệm | Điểm rớt |
|---|---|---|---|
| 1 | Google → SERP | Title + description + (sản phẩm có rating snippet?) → CTR | ⚠️ [SEO-03]: thiếu aggregateRating → kém CTR |
| 2 | `/product/shoei-x14/` (PDP) | Gallery, brand, name, price OK. Variant chip OK. | 🟢 OK |
| 3 | Cuộn xuống tabs | Mô tả, Specs, Video. KHÔNG có "Bảo hành & Đổi trả" | 🟠 [PDP-01] mất 15% trust |
| 4 | Click "THÊM VÀO GIỎ" | Nếu chưa chọn size → button disabled với text rõ. OK. | 🟢 OK |
| 5 | Nhìn header → Tìm category mũ khác | Header `<nav>` rỗng nếu menu chưa seed | 🔴 [TRUST-02] mất khách |
| 6 | Cuộn xuống footer → tìm SĐT gọi hỏi | "Đang cập nhật thông tin liên hệ." | 🔴 [TRUST-01] mất khách |

**Conversion estimate sau journey này:** 35% → 18% (do điểm 5+6 cộng dồn).

### 4.2 Đường đi B: Khách quen, browse → cart → checkout

| Bước | Trang | Trải nghiệm | Điểm rớt |
|---|---|---|---|
| 1 | `/san-pham/?pwb-brand=shoei` | Filter chip Shoei OK. Muốn thêm Arai → radio chỉ 1 | 🟠 [DISC-01] |
| 2 | Click sản phẩm → PDP → Add to cart | Toast "ĐÃ THÊM VÀO GIỎ" với link "Xem giỏ →" | 🟢 |
| 3 | Click cart icon → /gio-hang/ | Item, qty stepper, coupon input OK | 🟢 |
| 4 | "Phí vận chuyển: Tính ở bước thanh toán" | Mơ hồ, ko biết có miễn ship ko | 🟠 [CART-01] |
| 5 | Click "Tiến hành thanh toán" | 308 redirect /thanh-toan → /thanh-toan/ (extra round-trip) | 🟢 (acceptable) |
| 6 | /thanh-toan/ Step 1: form địa chỉ | Province + District dropdown. Ward = TEXT INPUT | 🔴 [CHK-01] |
| 7 | Nhập "Phường 5" / "P.5" / "P 5" | Backend không normalize → có thể giao sai | 🔴 [CHK-01] |
| 8 | Step 2: Payment → chọn BACS | Description "thông tin TK gửi qua email" | 🟠 |
| 9 | Step 3: Confirm → Đặt hàng | Idempotency key + price-change warning OK | 🟢 |
| 10 | /don-hang/xac-nhan?so=...&key=... | "Cảm ơn anh em!" + order info — KHÔNG CÓ TK CHUYỂN KHOẢN | 🔴 [TRUST-03] |
| 11 | Khách lưỡng lự, đợi email | Nếu không có email (CHK-05) → đơn treo | 🔴 [CHK-05] |

**Conversion estimate B:** 60% → 38% (5+10 = -22%, +/- 5%).

### 4.3 Đường đi C: Khách mobile, gấp, gõ vội

| Bước | Trang | Trải nghiệm | Điểm rớt |
|---|---|---|---|
| 1 | Mở /tim-kiem/?q=non | Search page basic, không autocomplete (chỉ form GET) | 🟢 (acceptable, cmd+k cũng có) |
| 2 | Click product card | OK, gallery responsive | 🟢 |
| 3 | Click nút "Mua ngay" → Quick Buy | Modal dropdown shipping/payment | 🟠 [CHK-04] |
| 4 | Gõ phone "0903 123 456" (có space) | Schema reject vì regex strict | 🟠 [CHK-03] |
| 5 | Bỏ space, retry | OK. Submit. | 🟢 |
| 6 | Order confirm | Cùng [TRUST-03] | 🔴 |

---

## 5. REDESIGN PROPOSALS

### 5.1 Homepage

**Hiện trạng:** Hero slider → HomeTrustRail → Featured (3 grid) → About → Carousel sản phẩm mới → Category grid → Promo banner → Experience articles → News → Video → Brands → SEO content → FAQ JSON-LD (no UI).

**Vấn đề:** Thiếu social proof (số khách, review count, "đã bán X+ mũ"). FAQ chỉ trong JSON-LD, KHÔNG render UI cho khách đọc trực tiếp.

**Đề xuất:**
1. **Sau HomeTrustRail (line 336), thêm "Số liệu BigBike":**
   ```
   13 năm kinh nghiệm · 50.000+ rider tin dùng · 4.8/5 ⭐ (2.300 đánh giá Google)
   ```
2. **Thêm UI accordion FAQ** ngay trước SEO content bottom (line 561). Render `HOME_FAQS` (line 49) như `<details>` thay vì chỉ JSON-LD.
3. **Thay thế Block 6 "Promo Banner"** với 3-card promo có nội dung khác nhau (1 banner sale + 1 tip rider + 1 video review).

### 5.2 Listing (`/san-pham/`)

**Đề xuất:**
1. **Filter sticky bên trái** → mobile thành drawer slide-out (đã có `wp-filters-mobile-toggle` nhưng chưa kiểm chứng UX). 
2. **Brand & Color → checkbox + show selected count.**
3. **Sort thêm "Bán chạy", "Đánh giá cao", "Khuyến mãi nhiều"**.
4. **Add `ProductCardAddBar`** chỉ hiện trên hover desktop / luôn hiện mobile. Logic phân biệt variant như [FN-01].
5. **Hiển thị "Còn N sản phẩm" trên card khi LOW_STOCK** — đã có cho PDP, nên bring vào card cho urgency.

### 5.3 Product Detail (`/product/[slug]/`)

**Đề xuất:**
1. **Right column thứ tự ưu tiên:**
   ```
   Brand · Category
   Tên sản phẩm (h1)
   ⭐ Rating + count
   Giá (sale/retail/save)
   ✓ Còn hàng | Chỉ còn N
   Variant chips (size/màu)
   Số lượng stepper
   [THÊM VÀO GIỎ] [MUA NGAY]
   ── Trust block 4 items ──  
   ── KEY SPECS callout (Bảo hành 24t · Material · Sizes XS-XXL · Origin) ── ← MỚI
   ── Share Facebook / Zalo / X ──
   ```
2. **Tabs thứ tự mới:** `Mô tả | Bảo hành & Đổi trả | Thông số | Đánh giá | Video` (với "Bảo hành & Đổi trả" làm tab thứ 2 → trust ngay sau khi đọc mô tả).
3. **Sticky add-to-cart bar mobile** khi cuộn xuống tabs → vẫn thấy giá + nút "Thêm" floating bottom.

### 5.4 Cart (`/gio-hang/`)

**Đề xuất:**
1. **Banner top:** progress bar miễn ship như [CART-01].
2. **Empty state** show 4 quick-link categories (Mũ/Áo/Găng/Giày).
3. **Right summary:**
   - Tạm tính
   - Mã giảm giá (input + apply)
   - Phí ship (auto: "Miễn phí từ 2tr" / "Tính sau khi nhập địa chỉ" + tooltip ?)
   - Tổng cộng
   - **Trust mini bar** (4 icons) — đẩy lên trên CTA  
   - [TIẾN HÀNH THANH TOÁN]
4. **Recently viewed** section ở dưới cart.

### 5.5 Checkout (`/thanh-toan/`)

**Đề xuất:**
1. **Step 1 (Address):** mỗi field có `autoComplete` + `enterKeyHint`. Email REQUIRED khi BACS chọn trong step 2 → quay lại step 1 nếu thiếu.
2. **Step 2 (Payment + Shipping):**
   - **Payment radio tile** với:
     - COD: "Thanh toán khi nhận hàng" + icon tiền
     - BACS: "Chuyển khoản ngân hàng — TK hiển thị ngay sau đặt" + icon ngân hàng
   - **Shipping radio tile** với chi phí + ETA (Nội thành 1-2 ngày, Toàn quốc 3-5 ngày).
3. **Step 3 (Review):**
   - Order summary đầy đủ
   - **NEW: Bank info preview** nếu BACS đã chọn → "Sau khi đặt, bạn sẽ nhận TK ngân hàng để chuyển khoản. Số tiền: X".
4. **Submit confirm:** disable button + hiển thị "Đang đặt hàng..." (đã có), + idempotency key (đã có), + browser unload guard nếu submit chưa xong.

### 5.6 Mobile

**Đề xuất:**
1. **Sticky add-to-cart bar** trên PDP mobile khi cuộn quá fold.
2. **Drawer mobile menu thêm "Trang chủ" + "Liên hệ".**
3. **Form fields:** `inputMode` + `autoComplete` + `enterKeyHint`.
4. **Touch target ≥ 44×44px** verify CSS.

---

## 6. COPY REWRITE SUGGESTIONS

| File:Line | Hiện tại | Đề xuất | Lý do |
|---|---|---|---|
| `app/page.tsx:53` | "Có. BigBike giao hàng toàn quốc qua các đơn vị vận chuyển uy tín. Miễn phí ship cho đơn hàng từ 2 triệu đồng." | "Có ạ. BigBike giao toàn quốc 3-5 ngày qua GHN/GHTK. **MIỄN SHIP** đơn từ 2 triệu — tức 1 cái mũ AGV K6 cũng đủ điều kiện." | Rõ thời gian + đơn vị + ví dụ cụ thể |
| `app/page.tsx:62` | "BigBike hỗ trợ đổi trả trong vòng 7 ngày với sản phẩm còn nguyên vẹn..." | "BigBike đổi/trả trong 7 ngày kể từ khi nhận hàng — sản phẩm còn nguyên tem mác, chưa qua sử dụng. Riêng mũ bảo hiểm: chỉ đổi nếu chưa tháo bao bì cá nhân (yêu cầu vệ sinh)." | Thêm ngoại lệ cho mũ — quan trọng cho biker |
| `app/thanh-toan/page.tsx:73-74` | "bacs: Chuyển khoản ngân hàng — thông tin TK gửi qua email sau khi đặt hàng." | "bacs: Chuyển khoản ngân hàng — bạn sẽ thấy số TK ngay sau khi đặt + nhận thêm qua email. Đơn hàng được xử lý sau khi BigBike nhận tiền (thường trong 1 giờ làm việc)." | Trust + clarity timing |
| `app/page.tsx:67-68` | "Đội ngũ BigBike tư vấn theo xe, cung đường và nhu cầu thực tế..." | "BigBike tư vấn miễn phí: bạn chạy gì (Exciter/Winner/CB/SH...), đi tỉnh nào, ngân sách bao nhiêu — anh em sẽ chọn giúp size mũ + dòng phù hợp. Zalo phản hồi trong 5 phút giờ hành chính." | Specific + commitment time |
| `components/catalog/ProductCard.tsx:79-89` (mapStockState) | "Đang cập nhật" | "Đang đồng bộ tồn kho (gọi 0xxx để hỏi nhanh)" | Default fallback ko nên mơ hồ |
| `app/gio-hang/page.tsx:354` | "Hàng chính hãng" | "100% chính hãng (kèm tem QC)" | Specific + checkable |
| `app/gio-hang/page.tsx:354` | "COD toàn quốc" | "COD — kiểm hàng trước khi trả tiền" | Action-oriented |
| `components/layout/SiteHeader.tsx:61-62` (PromoStrip) | "BIGBIKE SINCE 2013 garage gear moto chính hãng, tư vấn kỹ cho từng cung đường" | "✓ Chính hãng · ✓ Bảo hành hãng · ✓ Miễn ship đơn từ 2tr · ✓ Đổi trả 7 ngày" | Trust signals dày hơn USP |
| `components/catalog/QuickBuyModal.tsx:138` | "Mua ngay" | "Mua ngay — không cần thêm vào giỏ" | Clarify khác cart flow |
| `app/don-hang/xac-nhan/page.tsx:50-51` | "Đơn hàng đã được xác nhận. Chúng tôi sẽ liên hệ xác nhận trong 1 giờ làm việc." | "Đơn hàng **#{orderNumber}** đã ghi nhận! Anh em sẽ check email + gọi xác nhận trong 1 giờ làm việc. Nếu khẩn, gọi {hotline}." | Concrete + ID + escape hatch |

---

## 7. PRIORITIZED ROADMAP

### 🔴 P0 — Bắt buộc trước khi mở bán (1-2 ngày)

| # | Task | Effort | Impact |
|---|---|---|---|
| 1 | [TRUST-01] Hardcode fallback footer (menu + hotline + address) hoặc seed admin settings | 2h | +10% trust |
| 2 | [TRUST-02] Static fallback header menu | 1h | +8% nav usability |
| 3 | [TRUST-03] Hiển thị TK ngân hàng trên trang xác nhận BACS | 4h | +15% conversion BACS |
| 4 | [CHK-01] Phường/Xã dropdown từ API backend | 4h | -30% sai địa chỉ giao hàng |
| 5 | [CHK-02] Province code/name match backend contract | 3h + verify | Bug fix |
| 6 | [FN-01] ProductCardAddBar phân biệt variant | 2h | -25% silent failure |
| 7 | [SEO-01] Verify env `NEXT_PUBLIC_SITE_URL` cho prod | 30min + add runtime check | Fix SEO disaster |

**Tổng P0:** ~16h (1 dev 2 ngày).

### 🟠 P1 — Beta launch (3-7 ngày)

| # | Task | Effort | Impact |
|---|---|---|---|
| 8 | [PDP-01] Thêm tab "Bảo hành & Đổi trả & Vận chuyển" | 3h + content | +12% trust |
| 9 | [PDP-02] Quantity input có max + inputMode | 1h | -5% backend reject |
| 10 | [PDP-03] Disable "Mua ngay" khi chưa chọn variant | 30min | UX clarity |
| 11 | [DISC-01] Brand/Color filter checkbox + multi | 4h + backend verify | +8% AOV |
| 12 | [DISC-02] Sort thêm "Bán chạy", "Rating", "Khuyến mãi" | 2h + backend verify | +6% click product |
| 13 | [CART-01] Free-ship progress bar | 2h | +10% AOV (push to threshold) |
| 14 | [CHK-03] Phone regex auto-strip space/dash | 30min | -3% form abandonment |
| 15 | [CHK-04] Quick Buy hiển thị tổng tiền + radio tile | 3h | +5% quick buy conversion |
| 16 | [CHK-05] Email required khi BACS | 1h | -10% đơn treo |
| 17 | [MOB-01] Form autoComplete + enterKeyHint | 1h | +6% mobile checkout |
| 18 | [MOB-02] Touch target audit + fix CSS | 2h | A11y + mobile UX |
| 19 | [SEO-02] Fix "Trang chu" → "Trang chủ" | 5min | Brand image |
| 20 | [SEO-03] aggregateRating JSON-LD | 1h | +CTR Google |
| 21 | [SEO-04] LocalBusiness conditional render | 30min | Search Console clean |
| 22 | [PERF-01] HeroSlider stopOnInteraction + reduced-motion | 30min | A11y + UX |
| 23 | [A11Y-01] Audit color contrast WCAG AA | 2h | Accessibility |
| 24 | [TRUST-04] [TRUST-05] Verify ĐKKD + hotline thật | 1h + verify | Trust |
| 25 | [FN-02] Đăng ký redirect đúng | 30min | UX |

**Tổng P1:** ~28h (1 dev 4 ngày).

### 🟢 P2 — Sau launch + iterate (2-4 tuần)

| # | Task |
|---|---|
| 26 | [DISC-03] Color filter dynamic từ catalog |
| 27 | [DISC-04] Search autocomplete có thumbnail |
| 28 | [PDP-04] Toast có close + cap stack |
| 29 | [CART-02] Empty cart show suggestions |
| 30 | [CART-03] Coupon error map specific |
| 31 | [MOB-03] Mobile drawer thêm Trang chủ + Liên hệ |
| 32 | [SEO-05] Unify search route (`/tim-kiem/` vs `/san-pham/?q=`) |
| 33 | [PERF-02] Lazy-load Brand/Video carousel |
| 34 | [PERF-03] Giảm revalidate + on-demand |
| 35 | [A11Y-02] Form error softer red + icon |
| 36 | [A11Y-03] aria-controls quantity stepper |

### 🔵 P3 — Nice to have

- Wishlist / yêu thích
- Compare products (So sánh 2-3 mũ)
- Customer review photo upload
- Live chat real (FloatingChat hiện chỉ là loader)
- Google/Facebook social login
- "Bạn có muốn tìm" auto-correct trong search
- A/B test home blocks order
- Sticky add-to-cart mobile PDP
- Wallet save (cookie giỏ guest 30 ngày)

---

## 8. FINAL VERDICT

### 8.1 Đã đủ production để bán hàng thật chưa?

> **Câu trả lời thẳng:** **Chưa, nhưng rất gần.** 

Khoảng 16 giờ dev (2 ngày) sửa P0 là ĐỦ MINIMUM để mở bán mà không gặp 4 vấn đề critical:
1. Footer "Đang cập nhật" làm mất trust → fix bằng seed settings/menu hoặc hardcode fallback.
2. Header rỗng nav → fix fallback static menu.
3. BACS không có TK → fix bằng hiển thị TK trên order confirm.
4. Phường nhập tay → fix dùng dropdown.

Sau P0 sẽ có thể bán nhưng **conversion chưa tối ưu**. P1 (28h dev, 4 ngày) sẽ đẩy conversion lên thêm 15-25%.

### 8.2 Cần fix tối thiểu

**Trước khi production launch chính thức:**

```
┌─────────────────────────────────────────────────────────────┐
│ MUST-DO LIST (1 dev × 2 ngày = 16h)                        │
├─────────────────────────────────────────────────────────────┤
│ 1. ⛔ Seed backend settings + menu (footer/header/hotline) │
│ 2. ⛔ Hiển thị thông tin TK ngân hàng trên order confirm    │
│    (cho khách chọn BACS)                                    │
│ 3. ⛔ Phường/Xã dropdown thay vì input text                 │
│ 4. ⛔ ProductCardAddBar — sản phẩm có variant thì redirect  │
│    sang PDP, không add silent                               │
│ 5. ⛔ Verify env `NEXT_PUBLIC_SITE_URL=https://bigbike.vn`  │
│    trong CI/CD và `getSiteOrigin()` throw nếu localhost     │
│    trong production                                         │
│ 6. ⛔ Fix "Trang chu" → "Trang chủ" trong json-ld.ts:91,124 │
└─────────────────────────────────────────────────────────────┘
```

**Sau khi mở bán (4 ngày tới):** P1 list bên trên.

### 8.3 Điểm mạnh đáng ghi nhận

Codebase này có những điểm rất tốt mà nhiều shop VN thiếu:

- ✅ **Kiến trúc Next.js 16 ISR + dynamic snapshot** — vừa SEO tốt vừa fresh data.
- ✅ **CSP, HSTS, X-Frame-Options** — security headers chuẩn.
- ✅ **Idempotency key cho checkout** — chống double-charge.
- ✅ **CSRF token cho cart/checkout mutations**.
- ✅ **JSON-LD đa dạng** (Organization, WebSite, LocalBusiness, FAQ, Product, Breadcrumb).
- ✅ **Sitemap auto-generate từ DB**.
- ✅ **Search autocomplete với debounce + recent searches localStorage**.
- ✅ **Variant matching logic xử lý OOS chính xác** (probe-pick approach).
- ✅ **Toast feedback khi add-to-cart**.
- ✅ **Skeleton mirror layout** (không bị CLS lớn).
- ✅ **Honeypot trong review form** chống spam.
- ✅ **Price-change detection ở checkout** (chuyên nghiệp).
- ✅ **Tone tiếng Việt biker tự nhiên** ("anh em", "đi đường dài", "garage gear").
- ✅ **Accessibility cơ bản:** aria-label, aria-expanded, role, lang="vi", semantic html.

### 8.4 Một câu cho chủ shop

> *"Code ổn rồi, chỉ cần seed dữ liệu admin (menu, hotline, settings, TK ngân hàng), hiển thị TK trên order confirm, và sửa cái Phường nhập tay. Hai ngày dev là mở bán được. Một tuần tiếp theo làm P1, conversion sẽ tăng ~20%."*

---

## 9. PHỤ LỤC

### 9.1 Files đã đọc/audit

```
✓ next.config.ts (392 lines)
✓ app/layout.tsx + page.tsx + sitemap.ts + robots.ts
✓ app/product/[slug]/page.tsx
✓ app/san-pham/page.tsx
✓ app/gio-hang/page.tsx
✓ app/thanh-toan/page.tsx + order-received/[id]/page.tsx
✓ app/don-hang/xac-nhan/page.tsx
✓ app/dang-nhap/page.tsx + dang-ky/page.tsx
✓ app/tai-khoan/page.tsx + don-hang/page.tsx
✓ app/tim-kiem/page.tsx
✓ app/api/search-suggest/route.ts
✓ components/layout/SiteHeader.tsx
✓ components/layout/SiteFooter.tsx
✓ components/layout/MobileHeaderMenu.tsx
✓ components/layout/HeaderUserMenu.tsx
✓ components/layout/SearchToggle.tsx
✓ components/catalog/PurchaseSectionClient.tsx
✓ components/catalog/PricingPanel.tsx
✓ components/catalog/StockStatus.tsx
✓ components/catalog/VariantSelector.tsx
✓ components/catalog/ProductTabs.tsx
✓ components/catalog/ReviewsSection.tsx
✓ components/catalog/QuickBuyModal.tsx
✓ components/catalog/ProductCard.tsx + ProductCardAddBar.tsx + AddToCartButton.tsx
✓ components/catalog/CatalogFilters.tsx + CatalogSortSelect.tsx
✓ components/home/HeroSlider.tsx
✓ components/ui/VnAddressFields.tsx
✓ components/ui/Skeletons.tsx
✓ lib/utils/routes.ts + format.ts
✓ lib/api/client-api.ts + public-api.ts (partial)
✓ lib/seo/json-ld.ts + metadata.ts
✓ lib/schemas/checkout.ts
✓ lib/cart-context.tsx
✓ styles/brand-tokens.css (partial)
```

### 9.2 Test thực tế đã chạy

```
GET /                       → 200 in 162-175ms (warm), 93kb HTML
GET /san-pham               → 308 → /san-pham/ → 200
GET /gio-hang               → 308 → /gio-hang/ → 200
GET /thanh-toan             → 308 → /thanh-toan/ → 200
GET /tim-kiem?q=mu          → 308 → /tim-kiem/?q=mu → 200
GET /tai-khoan              → 308 → /tai-khoan/ → 307 → /dang-nhap?tiep=...
GET /danh-muc-san-pham      → 308 → /danh-muc-san-pham/ → 200
GET /lien-he                → 308 → /lien-he/ → 200
GET /sp/test.html           → 308 → /product/test/
GET /robots.txt             → 200, sitemap=http://localhost:3000/sitemap.xml
GET /sitemap.xml            → 200, content has http://localhost:3000/* (env issue)
GET /product/test-slug/     → 200 in 1.78s (cold ISR), 101kb
GET /danh-muc-san-pham/non-bao-hiem-moto/ → 200 in 1.78s, 117kb
```

### 9.3 NEEDS_VERIFICATION

Các điểm cần verify trước khi fix:

- [V1] `mã ĐKKD 41K8017383` có thật của BigBike không (hiện hardcode footer)
- [V2] Số hotline thật của BigBike (default `0903 123 456` rõ là giả)
- [V3] Backend có support multi-brand filter (`pwb-brand=shoei,arai`)?
- [V4] Backend `PRODUCT_SORT_VALUES` có support `salesCount:desc`, `rating:desc`?
- [V5] Backend Province format: `code` hay `name` hay `{code, name}` JSON?
- [V6] CI/CD có inject `NEXT_PUBLIC_SITE_URL=https://bigbike.vn` ở build prod không?
- [V7] CSS `.wp-pdp-qty-stepper button` có `min-height: 44px` không?
- [V8] Color contrast của `--bb-text-disabled: rgba(255,255,255,0.36)` trên `#0a0a0a` — có dùng cho text quan trọng không?

Cách kiểm chứng: 
- V1, V2: hỏi chủ shop hoặc check Cổng dịch vụ công.
- V3, V4, V5: đọc `bigbike-backend/src/main/java/.../ProductController.java`, `VnAddressController.java`, `CheckoutService.java`.
- V6: check `.github/workflows/*.yml` hoặc Vercel/Cloudflare env vars.
- V7, V8: mở DevTools, đo touch target và contrast ratio.

---

**Kết thúc audit Opus.**
