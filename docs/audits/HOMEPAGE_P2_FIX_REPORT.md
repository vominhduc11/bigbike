# Homepage P2 Fix Report

> **Phase:** Xử lý các issue **P2** của homepage `bigbike-web` theo [HOMEPAGE_DESIGN_PARITY_AUDIT.md](HOMEPAGE_DESIGN_PARITY_AUDIT.md) / [HOMEPAGE_P2_FIX_PLAN.md](HOMEPAGE_P2_FIX_PLAN.md).
> **Ngày:** 2026-05-18
> **Ràng buộc đã tuân thủ:** không đổi business logic / API contract / auth API · không hardcode dữ liệu · không refactor lớn · phạm vi giới hạn header / footer / search / menu.

---

## 1. Summary

- **Tổng P2 trong phạm vi (A–G): 7 nhóm.**
- **Fix bằng CODE: 4** — A (search overlay), B (account dropdown), C (burger drawer — phần width), D (footer).
- **Là DATA / admin config: 3** — E (menu chính), F (category grid), G (promo banner). Ghi admin action + SQL gợi ý ở mục 3, **không hardcode** frontend.
- **DATA_REQUIRED: 1** — lưới ảnh Instagram trong burger (thiếu hẳn nguồn dữ liệu).
- **NEEDS_CONFIRMATION: 1** — đổi nền search overlay tối → trắng (quyết định nhận diện thương hiệu).

Kết quả: 4 issue CODE đã sửa, build + lint pass, không phát sinh horizontal overflow, không regress P1.

---

## 2. Fixed Issues

| Area | Issue | Type | Files Changed | Before | After | Screenshot |
|---|---|---|---|---|---|---|
| **A. Search** | Placeholder & heading sai wording; trạng thái rỗng ẩn hẳn khối lịch sử | CODE | [`SearchToggle.tsx`](../../bigbike-web/components/layout/SearchToggle.tsx) | Placeholder "Tìm sản phẩm, thương hiệu…"; heading "Tìm kiếm gần đây" / "Sản phẩm gợi ý"; khi chưa có lịch sử → không hiện gì dưới ô input | Placeholder **"Vui lòng nhập từ khóa…"**; heading **"LỊCH SỬ TÌM KIẾM"** / **"GỢI Ý"**; khối "Lịch sử tìm kiếm" **luôn hiện** kể cả khi rỗng (có dòng gợi ý thay vì ẩn) | `search-overlay-empty.png`, `search-overlay-suggestions.png` |
| **B. Account** | Dropdown logged-in phẳng — thiếu dòng context + nút CTA đỏ/đen | CODE | [`HeaderUserMenu.tsx`](../../bigbike-web/components/layout/HeaderUserMenu.tsx) | Dropdown gồm label "Xin chào" + các menu item thường ("Tài khoản của tôi", "Đơn hàng", "Đăng xuất") | Thêm dòng context "Trải nghiệm mua sắm không giới hạn cùng Bigbike.vn"; **nút đỏ "TÀI KHOẢN CỦA TÔI ›"**; **nút đen "ĐĂNG XUẤT ⇥"**; giữ link "Đơn hàng của tôi" (route sẵn có) | `account-dropdown-guest.png` (logged-in: xem mục 4) |
| **C. Burger** | Drawer hơi hẹp so với thiết kế | CODE | [`ShopInfoDrawer.tsx`](../../bigbike-web/components/layout/ShopInfoDrawer.tsx) | `sm:max-w-md` (448px) | `sm:max-w-lg` (512px) — rộng hơn, gần thiết kế hơn | `burger-menu-open.png` |
| **D. Footer** | Nửa phải trống, không có block địa chỉ | CODE | [`SiteFooter.tsx`](../../bigbike-web/components/layout/SiteFooter.tsx) | Grid 3 cột (Brand+Newsletter / Thông tin / Mạng xã hội); cột phải lèo tèo; hotline+email nhét trong cột brand; **không hiển thị địa chỉ** | Grid **4 cột** cân đối; thêm cột **"Liên hệ"** gồm hotline + email + **địa chỉ** (đọc setting `contact_address`, đã có sẵn data); nửa phải không còn trống | `footer.png` |

**Chi tiết B — Account dropdown:** chỉ sửa phần **nội dung dropdown logged-in**. Giữ nguyên: logic auth (`performLogout`, `useAuth`), guest dropdown, hành vi hydration placeholder, route (`toAccountPath`/`toOrderHistoryPath` — không bịa route mới). Icon trigger vẫn là user-icon — đổi sang icon mũ bảo hiểm cần asset icon chuẩn, xếp vào P3 polish (xem mục 6).

---

## 3. Data/Admin Required Issues

| Area | Required Admin/Data Action | Expected Result | Status |
|---|---|---|---|
| **E. Menu chính** | Menu lấy từ bảng `menu_items` (menu `location='primary'`, do admin/seed cấu hình). Hiện 5 mục: `Trang chủ / Tất cả sản phẩm / Tin tức / Giới thiệu / Liên hệ`. Thiết kế cần 4: `Danh mục sản phẩm / Về Bigbike.vn / Bigbike News / Liên hệ`. → Vào admin (Menu → Header Menu): xoá mục "Trang chủ"; đổi nhãn "Tất cả sản phẩm"→"Danh mục sản phẩm", "Giới thiệu"→"Về Bigbike.vn", "Tin tức"→"Bigbike News". | Header hiển thị đúng 4 mục như thiết kế; mục "Danh mục sản phẩm" vẫn giữ mega menu (children không đổi). | ⚠️ DATA — chờ admin |
| **F. Category grid** | Lưới danh mục lấy từ `categories` với cờ `show_on_homepage`. Hiện **12** danh mục bật cờ; thiết kế cần **8**. → Vào admin (Danh mục): tắt `show_on_homepage` cho 4 danh mục thừa, giữ đúng 8: Áo-Quần bảo hộ, Balo, Găng tay, Giáp bảo hộ, Giày bảo hộ, Mũ bảo hiểm, Tai nghe Bluetooth, Phụ kiện khác. Tên danh mục dài cũng nên rút gọn. | Lưới danh mục homepage 2 hàng × 4 ô đúng thiết kế. | ⚠️ DATA — chờ admin |
| **G. Promo banner** | `site_settings.promo_image_url` đang **rỗng** → frontend fallback `/wp/banner-ads.jpg`. → Vào admin (Cấu hình/Settings): upload ảnh banner "SALE OFF 30% — CHO 10 SẢN PHẨM CUỐI CÙNG" đúng thiết kế và gán vào `promo_image_url`. | Promo banner hiển thị đúng nội dung/phong cách thiết kế. | ⚠️ DATA — chờ admin |
| **C. Instagram grid** | Burger drawer thiết kế có lưới 4 ảnh Instagram. Hệ thống hiện **chỉ có 1 setting `instagram_url`** (1 link), **không có data source cho danh sách ảnh**. → Cần bổ sung nguồn dữ liệu (vd Instagram feed API, hoặc 1 settings group chứa danh sách ảnh). | Hiển thị lưới ảnh Instagram trong burger drawer. | ⚠️ **DATA_REQUIRED** — thiếu data contract; không hardcode URL ảnh ngoài |

> Các SQL trực tiếp cho E/F/G **không thực thi** trong phase này (đổi nội dung menu/category/banner là quyết định nội dung — nên làm qua admin panel). Code frontend đã đọc đúng field (`menu_items`, `categories.show_on_homepage`, `promo_image_url`) nên **không cần sửa code**.

---

## 4. Verification

| Hạng mục | Kết quả |
|---|---|
| **Build** | ✅ PASS — `npm run build` (Next.js 16.2.4) hoàn tất, không lỗi compile. |
| **Lint** | ✅ PASS — `eslint` 4 file đã sửa, exit 0, không warning. |
| **Browser/viewport** | Playwright (Chromium headless) — 4 viewport: 1920×1080, 1440×900, 768×1024, 390×844. **Không viewport nào có horizontal overflow** (`scrollW === clientW` cả 4). |
| **Interactive states đã chụp** | `search-overlay-empty` (placeholder + "LỊCH SỬ TÌM KIẾM" ✓), `search-overlay-suggestions` ("GỢI Ý" ✓), `account-dropdown-guest`, `burger-menu-open` (drawer rộng hơn ✓), `mega-menu-open` (regression — xem mục 5), `footer` (4 cột + địa chỉ ✓), `category-grid`, `promo-banner`. |
| **account-dropdown-logged-in** | Chưa chụp được (cần đăng nhập tài khoản thật). Thay đổi đã verify qua build + review code; cần kiểm tra thủ công sau khi đăng nhập. |

**Screenshot folder:** [`docs/audits/homepage-p2-after-shots/`](homepage-p2-after-shots/) (10 ảnh viewport + 8 ảnh state/section + `_p2-log.txt`).

**Cách verify:** build production cục bộ → `next start` cổng 3001 (không đụng container Docker cổng 3000) → Playwright. Script tạm `_bbtmp-p2shots.mjs` đã chạy rồi **xoá**; server cục bộ đã tắt.

---

## 5. Regression Check

| Khu vực | Kết quả |
|---|---|
| **Mega menu (P1)** | ✅ Không regress — `mega-menu-open.png` cho thấy panel sidebar danh mục + flyout vẫn đúng như sau Phase P1. |
| **Hero** | ✅ Render bình thường (hiện hiển thị overlay sản phẩm + CTA "MUA NGAY" — do Phase DATA `V1009` đã được áp dụng). |
| **Featured grid / Recommended carousel** | ✅ Render bình thường, không vỡ. |
| **Header sticky** | ✅ Không đụng `StickyHeaderShell` — hành vi giữ nguyên. |
| **Responsive** | ✅ Không có horizontal overflow ở cả 4 viewport (desktop/laptop/tablet/mobile). Footer 4 cột thu về 1 cột (FooterCollapsible) trên mobile, đọc tốt. |
| **Auth** | ✅ Không đụng logic auth; chỉ đổi phần trình bày dropdown. |

> Lưu ý: lần chụp đầu bị nhiễu do một tiến trình `next start` cũ còn giữ cổng 3001 (server cũ trả nội dung sai). Đã kill tiến trình, khởi động lại server sạch và chụp lại — kết quả ở trên là từ build P2 mới.

---

## 6. Remaining Issues

**P2 còn lại / chờ xử lý ngoài CODE:**
- **E, F, G** — DATA: chờ admin cấu hình menu / category `show_on_homepage` / promo banner asset (mục 3).
- **C — Instagram grid:** DATA_REQUIRED — cần bổ sung nguồn dữ liệu ảnh Instagram trước khi dựng UI.
- **A — nền search overlay:** thiết kế là panel trắng, hiện đang nền tối. **NEEDS_CONFIRMATION** — đổi tối→trắng là thay đổi nhận diện của overlay (phải recolor toàn bộ item, rủi ro regress), vượt mức "sửa wording" của P2; overlay tối hiện tại nhất quán nội bộ. Đề nghị xác nhận hướng nhận diện trước khi đổi.

**P2 ngoài phạm vi A–G của phase này (vẫn nằm trong audit gốc):**
- Section "Item đặc sắc": heading "SẢN PHẨM NỔI BẬT TẠI BIGBIKE" ≠ thiết kế "ITEM ĐẶC SẮC TẠI BIGBIKE"; dạng tab thay vì carousel. (Heading là quick win; dạng hiển thị cần quyết định component.)

**P3 (chưa xử lý — để phase polish):**
- Icon account đổi sang mũ bảo hiểm (cần asset icon chuẩn), separator ◆ giữa menu item, bố cục section uy tín, hover đỏ ô category, wording "Xem tiếp", nút "Xem thêm" video, excerpt blog.

**Console 401:** vẫn chưa xử lý — để task điều tra riêng (không thuộc P2).

---

## 7. Final Verdict

Sau Phase P2, homepage `bigbike-web` đạt **visual parity ở mức khá cao** với thiết kế:
- Header / search / account / footer / burger đã đúng wording, đúng cấu trúc, đúng bố cục cốt lõi.
- Không còn lỗi layout, không horizontal overflow, không regress P1.
- Phần lệch còn lại chủ yếu là **DATA/admin config** (menu, category, promo, Instagram) — đã có hướng dẫn rõ, không cần code.

**Có thể chuyển sang P3 polish** sau khi:
1. Admin cấu hình xong E/F/G (hoặc chấp nhận xử lý song song ở P3).
2. Xác nhận hướng cho 2 mục treo: nền search overlay (NEEDS_CONFIRMATION) và nguồn ảnh Instagram (DATA_REQUIRED).

**Console 401** nên tách thành task điều tra riêng — không nên gộp vào P3 polish vì bản chất là lỗi runtime/API, không phải lỗi visual.
