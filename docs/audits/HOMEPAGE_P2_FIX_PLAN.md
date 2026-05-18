# HOMEPAGE P2 FIX PLAN — bigbike-web

> **Phase:** Xử lý các issue **P2** của homepage theo [HOMEPAGE_DESIGN_PARITY_AUDIT.md](HOMEPAGE_DESIGN_PARITY_AUDIT.md).
> **Ngày:** 2026-05-18
> **Ràng buộc:** không đổi business logic / API contract / auth API · không hardcode dữ liệu · không refactor lớn · phạm vi giới hạn homepage / header / footer / search / menu.

---

## 1. Điều tra nhanh (trace data backend)

| Kiểm tra | Kết quả |
|---|---|
| Menu chính | bảng `menu_items` (menu `location='primary'`) — 5 mục: `Trang chủ / Tất cả sản phẩm / Tin tức / Giới thiệu / Liên hệ`. Frontend lấy qua `getPublicMenu("primary")`. |
| Category homepage | bảng `categories` có cột `show_on_homepage` — hiện **12** dòng `= true`. Frontend lấy qua `listCategories({ showOnHomepage: true })`. |
| Promo banner | `site_settings.promo_image_url` = **rỗng** → frontend fallback `/wp/banner-ads.jpg`. |
| Địa chỉ shop | `site_settings.contact_address = "79/30/52 Âu Cơ, Phường 14, Quận 11, TP.HCM"` — đã có data, footer chưa render. |
| Instagram ảnh | Không có data source cho lưới ảnh Instagram (chỉ có `instagram_url` là 1 link). |

→ Menu, category grid, promo banner là **DATA**. Footer thiếu địa chỉ là **CODE** (data đã có, component chưa đọc). Search & account là **CODE**.

---

## 2. Bảng phân loại P2

| Priority | Area | Issue | Type | Root Cause | Files / Data liên quan | Will Fix Now? |
|---|---|---|---|---|---|---|
| P2 | A. Search | Placeholder & heading sai wording; trạng thái rỗng ẩn hẳn block lịch sử | **CODE** | Chuỗi hardcode trong component; `showRecent` ẩn block khi `recent.length === 0` | `components/layout/SearchToggle.tsx` | ✅ YES |
| P2 | A. Search | Panel nội dung nền tối — thiết kế là panel trắng | **CODE (visual)** | `.bb-search-*` theo dark theme | `app/globals.css` | ⚠️ NO — **NEEDS_CONFIRMATION** (đổi color identity của overlay, vượt mức wording-fix, rủi ro regress; overlay tối hiện tại nhất quán nội bộ) |
| P2 | B. Account | Dropdown logged-in thiếu CTA đỏ "Tài khoản của tôi" + nút đen "Đăng xuất" + dòng context; guest cũng phẳng | **CODE** | `HeaderUserMenu` render `DropdownMenuItem` mặc định | `components/layout/HeaderUserMenu.tsx` | ✅ YES |
| P2 | B. Account | Icon trigger là user-icon, thiết kế là mũ bảo hiểm | **CODE** | `UserIcon` SVG | `components/layout/HeaderUserMenu.tsx` | ✅ YES (đổi sang icon mũ) |
| P2 | C. Burger | Thiếu lưới 4 ảnh Instagram | **DATA** | Không có data source ảnh Instagram (chỉ có `instagram_url`) | `site_settings` / data | ⚠️ NO — **DATA_REQUIRED** |
| P2 | C. Burger | Drawer hơi hẹp so với thiết kế | **CODE** | `sm:max-w-md` (448px) | `components/layout/ShopInfoDrawer.tsx` | ✅ YES (minor — nới rộng) |
| P2 | D. Footer | Nửa phải trống, không có block địa chỉ | **CODE** | Grid 3 cột; component không đọc `contact_address` | `components/layout/SiteFooter.tsx` | ✅ YES |
| P2 | E. Menu | Menu chính 5 mục, sai wording so với thiết kế (4 mục) | **DATA** | `menu_items` (menu `primary`) do admin/seed cấu hình | `menu_items` table / admin panel | ⚠️ NO — **DATA** (kèm SQL gợi ý trong report) |
| P2 | F. Category grid | 12 ô thay vì 8 | **DATA** | 12 `categories.show_on_homepage = true` | `categories` table / admin panel | ⚠️ NO — **DATA** |
| P2 | G. Promo banner | Ảnh banner sai/trống | **DATA** | `site_settings.promo_image_url` rỗng | `site_settings` / admin panel | ⚠️ NO — **DATA** |

---

## 3. Phạm vi sửa CODE phase này

**Sẽ sửa (CODE):**
- **A — Search:** wording (placeholder + heading "LỊCH SỬ TÌM KIẾM" / "GỢI Ý"); luôn hiện block lịch sử kể cả khi rỗng. → `SearchToggle.tsx`.
- **B — Account:** dựng lại nội dung dropdown (context text + nút đỏ "Tài khoản của tôi" + nút đen "Đăng xuất") cho cả guest & logged-in; đổi icon trigger sang mũ bảo hiểm. → `HeaderUserMenu.tsx`.
- **C — Burger:** nới rộng drawer. → `ShopInfoDrawer.tsx`.
- **D — Footer:** thêm cột/khối "Liên hệ" có địa chỉ; cân lại grid để nửa phải không trống. → `SiteFooter.tsx`.

**Không sửa code (DATA / cần xác nhận):**
- **A panel trắng:** NEEDS_CONFIRMATION — đổi nền overlay tối→trắng là quyết định nhận diện, ghi vào "Remaining".
- **C Instagram grid:** DATA_REQUIRED — thiếu nguồn ảnh.
- **E menu / F category / G promo:** DATA — ghi admin action + SQL gợi ý trong report, không hardcode frontend.

**Không đụng:** checkout, product detail, admin, backend, migration, auth service, cart service.
