# Audit nhất quán UI — bigbike-admin (app đang chạy, redesign/ui-ux)

> Cách audit: duyệt read-only trên `http://localhost:4000`, đo trực tiếp DOM (icon class, button class, padding tính toán) — khách quan, không suy đoán. Phủ ~28/39 màn có tín hiệu đo được (30 route nav, trừ vài màn dạng form-cấu-hình/row-click không có nút đo được) + vài màn detail đã xem trước (Order/Product/Receivable detail). **Không sửa gì** — đây là báo cáo để bạn quyết.

## Tóm tắt 1 dòng
Hệ design **đã nhất quán ở lớp nền** (màu/token, font, shell, padding nội dung `20/24/64`, screen-header mọi màn, đa số dùng `bb-btn` + 100% icon lucide). Lệch nằm ở **lựa chọn icon cho cùng 1 hành động**, **vài nút "Lưu" chưa dùng `bb-btn`**, **2 màn xài nhiều SVG tự chế**, và **2 mật độ bảng khác nhau**. Tất cả đều là lớp trình bày → fix rủi ro thấp.

---

## P1 — ICON (đúng chỗ bạn thấy lệch)

| # | Vấn đề | Hiện trạng | Nên thống nhất |
|---|--------|-----------|----------------|
| I1 | **Icon "Sửa" khác glyph** | Media dùng `lucide-pen`; brands / redirects / content / admin-users dùng `lucide-pencil` | Chọn 1 (đề xuất `pencil`) cho mọi nút sửa |
| I2 | **Nút "Thêm/Tạo" lúc có icon lúc không** | Có `lucide-plus`: brands, coupons, redirects, content. `lucide-user-plus`: admin-users (hợp lý). **Không icon / "+" chữ**: categories ("Thêm danh mục"), sliders ("Thêm banner"), home-videos ("+ Thêm video") | Thêm `lucide-plus` cho mọi CTA tạo mới (giữ user-plus cho admin nếu muốn) |
| I3 | **Nút "Xuất" lúc icon lúc ký tự** | `lucide-download`: content, inventory. **Ký tự "↓" chữ**: audit-logs ("↓ Xuất Excel") | Dùng `lucide-download` cho mọi nút xuất |
| I4 | **2 màn xài nhiều SVG inline KHÔNG phải lucide** | **categories: 17** SVG non-lucide · **home-videos: 59** SVG non-lucide (mọi màn khác = 100% lucide) | Rà 2 màn này, thay icon tự chế bằng lucide tương đương |
| I5 | **Stroke-width icon không đồng nhất** | Đa số `stroke-width=2` (chuẩn lucide); lác đác `1.75` / `2.25` (vd Dashboard) | Để mặc định lucide (2) trừ khi cố ý |

## P1 — NÚT / CTA

| # | Vấn đề | Hiện trạng | Nên thống nhất |
|---|--------|-----------|----------------|
| B1 | **Nút "Lưu" chính là `<button>` trần, không `bb-btn`** | featured-products ("Lưu thứ tự") · home-highlights ("Lưu cấu hình") | Gắn `bb-btn bb-btn-primary` như nút lưu ở các màn khác |

## P2 — SPACING / MẬT ĐỘ

| # | Vấn đề | Hiện trạng | Nên thống nhất |
|---|--------|-----------|----------------|
| S1 | **Bảng có 2 mật độ ô** | Padding dọc ô ~`0px`: brands, serials, redirects, content, admin-users, orders, customers · `8px`: categories, inventory, audit-logs | Chốt 1 token mật độ cho mọi bảng dữ liệu *(lưu ý: số đo theo 1 cột mẫu — verify lại trước khi sửa)* |

## P3 — EMPTY / LOADING (đo live bị hạn chế)
DOM chỉ lộ trạng thái rỗng/đang-tải khi không có data; đa số màn có data nên không kiểm hết được. Chỉ xác nhận được empty-state chung ở **POS** và **Reviews**. → Đề xuất Claude Code **kiểm ở code**: đảm bảo mọi màn list đi qua `StatePanel` (empty) + `MediaCardSkeleton`/skeleton chung (loading) thay vì markup tự chế.

---

## ĐÃ nhất quán (không cần đụng)
- Bộ icon: ~26/28 màn dùng **100% lucide-react**.
- Padding nội dung `20px 24px 64px` đồng nhất mọi màn; screen-header có ở mọi màn.
- Hệ `bb-btn` (primary/secondary/ghost/danger/sm) dùng rộng khắp.
- Màu/token cam Direction B + brand đỏ + danger + amber: nhất quán (đã verify ở đợt sweep trước).

## Phạm vi chưa đo được bằng DOM
warranties · serials · attributes · shipping · products (header CTA/row-action không bắt được do dùng row-click hoặc form-cấu-hình, hoặc load chậm tại thời điểm đo). → Nên liếc mắt riêng hoặc kiểm ở code.

---

## Đề xuất hành động (lớp trình bày, rủi ro thấp)
Gộp thành **1 "consistency pass"** cho Claude Code, làm trên nhánh `redesign/ui-ux`:
1. Thống nhất icon hành động: sửa=`pencil`, tạo=`plus`, xuất=`download`, xoá=`trash2` (I1–I3).
2. Rà & thay SVG tự chế ở **categories** + **home-videos** sang lucide (I4).
3. Gắn `bb-btn bb-btn-primary` cho nút "Lưu" trần ở featured-products + home-highlights (B1).
4. Chốt 1 mật độ bảng (S1) — verify cột mẫu trước.
5. Kiểm code empty/loading dùng component chung (P3).
Chỉ đổi icon-component / className / token — **không đụng logic, handler, dữ liệu**.
