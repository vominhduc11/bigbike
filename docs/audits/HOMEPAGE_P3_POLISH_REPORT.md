# Homepage P3 Polish Report

> **Phase:** P3 Polish + Final Homepage Design Parity Regression cho `bigbike-web`.
> **Ngày:** 2026-05-18
> **Liên quan:** [HOMEPAGE_DESIGN_PARITY_AUDIT.md](HOMEPAGE_DESIGN_PARITY_AUDIT.md) · [HOMEPAGE_P1_FIX_REPORT.md](HOMEPAGE_P1_FIX_REPORT.md) · [HOMEPAGE_DATA_FIX_REPORT.md](HOMEPAGE_DATA_FIX_REPORT.md) · [HOMEPAGE_P2_FIX_REPORT.md](HOMEPAGE_P2_FIX_REPORT.md)
> **Ràng buộc đã tuân thủ:** không đổi business logic / API contract · không tạo migration mới · không sửa backend · không hardcode dữ liệu · không động checkout/product detail/admin.

---

## 1. Summary

Sau P1 (mega menu) + Phase DATA (V1009 publish sản phẩm) + P2 (search/account/burger/footer), homepage `bigbike-web` đã ở mức **visual parity cao** với thiết kế. Phase P3 chủ yếu là **kiểm tra polish + regression toàn trang**; phần lớn các "issue P3" trong audit gốc khi kiểm tra lại **đã đúng từ trước** (chỉ là quan sát thiếu trong audit tĩnh).

- **Polish bằng CODE: 1** — wording nút CTA section trải nghiệm ("XEM CHI TIẾT" → "Xem tiếp").
- **Đã đúng sẵn (audit observation gap): 2** — dấu ◆ đỏ giữa menu item (`.bb-navigation-item::after`), hover nền đỏ ô category (`.bb-cat-list-item::before` dùng `cat-hover.jpg`). Không cần sửa.
- **Không sửa — DATA/admin: 4** — menu 5→4 mục, category grid 12→8 ô, promo banner asset, excerpt bài viết.
- **Không sửa — ASSET_REQUIRED: 1** — icon mũ bảo hiểm cho account trigger.
- **Không sửa — NEEDS_CONFIRMATION: 2** — đổi nền search overlay tối→trắng, bố cục section "uy tín" canh giữa.
- **Không sửa — OUT_OF_SCOPE: 1** — nút "Xem thêm" ở section video (chưa có trang /videos để trỏ tới).

**Ước lượng visual parity hiện tại: ~90–93%.** Phần lệch còn lại gần như hoàn toàn là **DATA/admin config**, không phải lỗi code.

---

## 2. Files Changed

| File | Change | Reason |
|---|---|---|
| [`components/home/ExperienceCarousel.tsx`](../../bigbike-web/components/home/ExperienceCarousel.tsx) | Nhãn nút CTA `XEM CHI TIẾT` → `Xem tiếp` | P3 — khớp wording thiết kế cho section "PHỤ KIỆN ĐI PHƯỢT MOTO CAO CẤP" |

Chỉ **1 file** thay đổi. Không file nào khác cần sửa — các hạng mục polish còn lại đã đạt sẵn hoặc thuộc DATA/ASSET/CONFIRMATION.

---

## 3. Fixed P3 Issues

| Area | Issue | Before | After | Evidence |
|---|---|---|---|---|
| Section trải nghiệm | Nút CTA sai wording so với thiết kế | "XEM CHI TIẾT" | "Xem tiếp" (render hoa: "XEM TIẾP") | `homepage-p3-after-shots/experience-section.png` |

**Các hạng mục audit gốc liệt kê P3 nhưng kiểm tra lại đã đúng — không cần sửa:**

| Hạng mục | Kết luận |
|---|---|
| Dấu ◆ đỏ giữa menu item | **Đã có** — `.bb-navigation-item::after` (ô 5px xoay 45° màu `--bb-brand-primary`, ẩn ở item cuối). Audit tĩnh không nhận ra. |
| Hover ô category nền đỏ texture | **Đã có** — `.bb-cat-list-item::before` overlay `cat-hover.jpg`, `opacity 0→1` khi hover. Audit tĩnh không hover nên không thấy. |
| Mũi tên carousel video | **Đã có** — `HomeVideoCarousel` render nút prev/next (ẩn `max-[575px]`) + dots. |

---

## 4. Remaining DATA/ASSET/CONFIRMATION Items

| Area | Type | Required Action | Impact |
|---|---|---|---|
| Menu chính header | **DATA** | Admin sửa `menu_items` (menu `primary`): 5 mục → 4 mục đúng wording (Danh mục sản phẩm / Về Bigbike.vn / Bigbike News / Liên hệ). Xem [HOMEPAGE_P2_FIX_REPORT.md](HOMEPAGE_P2_FIX_REPORT.md) mục 3-E. | Trung bình — wording header lệch thiết kế |
| Category grid | **DATA** | Admin tắt `show_on_homepage` cho 4 danh mục thừa (hiện 12 → cần 8). Layout code đã đúng (grid `auto-fit` 4 cột); khi còn 12 thì ra 3 hàng. | Trung bình — lưới 3 hàng thay vì 2 |
| Promo banner | **DATA** | Admin upload ảnh banner "SALE OFF 30%" và gán `site_settings.promo_image_url` (hiện rỗng → fallback `/wp/banner-ads.jpg`). | Trung bình — nội dung banner lệch |
| Excerpt bài viết (blog card) | **DATA** | Admin điền `excerpt` cho bài viết để card blog có đoạn mô tả. | Thấp |
| Icon account (mũ bảo hiểm) | **ASSET_REQUIRED** | Cần asset/icon mũ bảo hiểm chuẩn. Hiện dùng user-icon. Không tự vẽ SVG để tránh lệch chất lượng. | Thấp |
| Nền search overlay | **NEEDS_CONFIRMATION** | Thiết kế là panel trắng; hiện nền tối (nhất quán nội bộ). Đổi tối→trắng phải recolor toàn bộ item — cần xác nhận hướng nhận diện trước. | Thấp–trung bình |
| Bố cục section "Uy tín" | **NEEDS_CONFIRMATION** | Thiết kế canh giữa 1 cột; hiện 2 cột (logo trái + text phải). Cả hai đều hợp lệ về brand — cần xác nhận trước khi đổi layout. | Thấp |
| Nút "Xem thêm" video | **OUT_OF_SCOPE** | Cần trang `/videos` để trỏ tới (chưa tồn tại). Không thêm nút chết. | Thấp |
| Brand strip | **DATA** | Danh sách brand do admin cấu hình; khác bộ brand minh hoạ trong thiết kế. | Thấp |

> Không hạng mục nào được vá bằng hardcode trong code frontend.

---

## 5. Regression Check

Kiểm tra qua screenshot `homepage-p3-after-shots/` (build sau khi clear fetch-cache, dữ liệu V1009 đã phản ánh đúng):

| Khu vực | Kết quả |
|---|---|
| **Hero** | ✅ Render overlay sản phẩm (danh mục + tên + nút "MUA NGAY" + watermark + chỉ số slide) — không regress. |
| **Mega menu (P1)** | ✅ Panel sidebar danh mục cấp 1 + flyout còn nguyên — `mega-menu-open.png`. |
| **Search overlay (P2)** | ✅ Placeholder "Vui lòng nhập từ khóa…", heading "LỊCH SỬ TÌM KIẾM" / "GỢI Ý" còn đúng — `search-overlay-empty.png`, `search-overlay-suggestions.png`. |
| **Account dropdown (P2)** | ✅ Guest dropdown hoạt động — `account-dropdown-guest.png`. (Logged-in: xem mục 6.) |
| **Burger drawer (P2)** | ✅ Drawer rộng (`max-w-lg`), mở/đóng OK — `burger-drawer-open.png`. |
| **Footer (P2)** | ✅ 4 cột cân đối (Brand+Newsletter / Thông tin / Liên hệ + địa chỉ / Mạng xã hội) — `homepage-footer.png`. |
| **Category grid** | ✅ Render đúng (icon line-art, label, border, hover đỏ); hiện 12 ô do DATA chưa cấu hình (mục 4). |
| **Promo banner** | ✅ Render không méo; nội dung phụ thuộc `promo_image_url` (DATA). |
| **Product carousel "Item đặc sắc"** | ✅ Sau V1009: tab "Chưa phân loại" đã biến mất, hiện 3 tab đúng danh mục (Giáp bảo hộ / Balô / Tai nghe Bluetooth) — `recommended-carousel.png`. |
| **Featured grid dưới hero** | ✅ Đã hiển thị 3 card (V1009 publish FEATURED_GRID) — `desktop-1920--top` / `homepage-mid-sections`. |
| **Header sticky** | ✅ Không nhảy layout; ẩn khi cuộn xuống, hiện khi cuộn lên — `sticky-header.png`. |
| **Responsive** | ✅ **Không horizontal overflow** ở cả 4 viewport (1920/1440/768/390 — `scrollW === clientW`). |

→ **Không phát hiện regression nào** do P3 hoặc các phase trước.

---

## 6. Verification

| Hạng mục | Kết quả |
|---|---|
| **Build** | ✅ PASS — `npm run build` (Next.js 16.2.4) hoàn tất, không lỗi. |
| **Lint** | ✅ PASS — `eslint` file đã sửa, exit 0. |
| **Test** | ⚠️ 11/12 file test pass, **94/95 test pass**. 1 test fail: `__tests__/schemas/auth.test.ts > loginSchema` — **không liên quan homepage** (auth schema), pre-existing, không do P3. Không sửa (ngoài phạm vi). |
| **Viewport đã kiểm tra** | 1920×1080, 1440×900, 768×1024, 390×844 — không overflow. |
| **States đã chụp** | homepage-default-top, homepage-mid-sections, homepage-footer, sticky-header, mega-menu-open, search-overlay-empty, search-overlay-suggestions, account-dropdown-guest, burger-drawer-open, experience-section, category-grid, promo-banner, recommended-carousel. |
| **account-dropdown-logged-in** | Chưa chụp — cần đăng nhập tài khoản thật. Thay đổi P2 đã verify qua code/build; cần kiểm tra thủ công sau đăng nhập. |
| **Screenshot folder** | [`docs/audits/homepage-p3-after-shots/`](homepage-p3-after-shots/) — 22 file (8 viewport + 13 state/section + `_p3-log.txt`). |

**Ghi chú kỹ thuật verify:** Next.js cache `fetch` trong `.next/cache` theo `revalidate=3600` → build lại trong vòng 1h tái dùng response API cũ. Lần chụp đầu carousel hiện dữ liệu cũ ("Chưa phân loại"); đã **xoá `.next/cache` + build lại** → screenshot phản ánh đúng DB hiện tại (V1009 đã áp dụng). Server verify chạy `next start` cổng 3001, không đụng container Docker cổng 3000. Script tạm đã xoá.

---

## 7. Console Check

- **Mọi viewport: 1 console error** — `Failed to load resource: the server responded with a status of 401`.
- Đây là **lỗi đã biết** từ audit gốc, nghi là một request tới API cần xác thực (giỏ hàng/phiên/tài khoản) gọi khi người dùng chưa đăng nhập. Không làm vỡ trang, không gây lỗi render.
- **Theo yêu cầu phase này: chỉ ghi nhận, KHÔNG xử lý.** Không sửa auth/session ở đây.
- Không phát sinh console error/warning **mới** nào do P3 (chỉ đúng 1 lỗi 401 cũ).
- Endpoint chính xác chưa xác định được từ log trình duyệt (chỉ thấy status 401, không kèm URL trong message) → task điều tra riêng nên bật Network panel / log phía server để truy endpoint.

---

## 8. Final Verdict

**Homepage đã đủ gần thiết kế để review với stakeholder.** Các khối lớn (hero, featured grid, item đặc sắc, danh mục, promo, trải nghiệm, blog, video, brand, SEO, footer) + header/search/account/burger/mega menu đều đúng cấu trúc, đúng wording cốt lõi, không vỡ layout, không horizontal overflow, không regression. Visual parity ~90–93%.

**Có thể chuyển sang task xử lý console 401** — đây là việc còn lại đáng làm tiếp theo, nên tách thành task điều tra riêng (bản chất runtime/API, không phải visual).

**Còn block cần admin/data xử lý trước khi production:**
1. **Menu chính** — sửa `menu_items` về 4 mục đúng wording (DATA).
2. **Category grid** — đưa `show_on_homepage` về đúng 8 danh mục (DATA).
3. **Promo banner** — upload asset + gán `promo_image_url` (DATA).
4. *(Khuyến nghị)* Phase DATA `V1009` đã áp dụng trên DB hiện tại; khi **deploy môi trường khác** cần đảm bảo backend chạy profile `dev` để Flyway áp dụng, hoặc admin publish sản phẩm tương đương.

**2 mục cần quyết định thiết kế (không chặn review):** nền search overlay (tối/trắng), bố cục section uy tín — nên chốt khi review với stakeholder.

→ **Kết luận: homepage sẵn sàng cho vòng review thiết kế với stakeholder.** Các điều chỉnh còn lại là DATA/admin config + 2 quyết định nhận diện, không phải lỗi code; có thể xử lý song song hoặc ngay trong buổi review.

---

*Hết báo cáo. Phase P3 chỉ sửa 1 dòng wording CODE; phần còn lại là kiểm tra regression + ghi nhận DATA/ASSET/CONFIRMATION. Không tạo migration, không sửa backend, không hardcode.*
