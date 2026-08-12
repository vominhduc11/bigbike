# Báo cáo lệch UI/UX & responsive — `bigbike-web` ↔ WordPress gốc `bigbike_vn__2026_04_17`

> **Giai đoạn 2 — Báo cáo dạng option. CHƯA SỬA GÌ.** Khảo sát read-only, mỗi điểm lệch đã được verify lại bằng cách mở đúng dòng file WP + Next (loại bỏ báo nhầm). Đối chiếu ở 7 mốc: **360 / 576 / 768 / 992 / 1200 / 1440 / 1920px**.
>
> **Số ID là cố định để bạn duyệt** (không liên tục — gom theo khu vực). Bạn trả lời kiểu: `duyệt 3,4,5,6` hoặc `DECIDE 25 -> theo WP`, `bỏ 17`.
>
> **Nhãn:**
> - 🟢 **MATCH** — Next đã port lệch khỏi WP, nên kéo về WP (an toàn, thuần CSS/token).
> - 🔶 **DECIDE** — cần bạn chọn *Theo WP* hay *Giữ Next* (thường là chỗ mobile Next làm tốt hơn WP, hoặc Next redesign).
> - ⚪ **KEEP** — cải tiến Next-only, khuyến nghị giữ; chỉ liệt kê để bạn biết.

---

## Tổng quan

| # | Khu vực | Số mục | Trong đó DECIDE | Rủi ro cao/vừa |
|---|---|---|---|---|
| 1 | Header desktop (bar/nav/mega menu) | 4 (135–138) | 2 | 1 med |
| 1b | Header mobile (drawer/bottom nav) | 6 (101–106) | 0 (1 keep) | 3 med |
| 2 | Footer | 7 (107–113) | 0 | 3 med |
| 3 | Trang chủ | 12 (1–12) | 1 (+2 keep) | 2 med |
| 4 | Danh mục + Bộ lọc | 9 (13–21) | 4 | 4 med |
| 5 | PDP (chi tiết SP) | 13 (114–126) | 6 keep + … | 1 high, 5 med |
| 6 | Giỏ hàng | 11 (22–32) | 1 (+2 keep) | 2 med |
| 7 | Thanh toán | 8 (33–40) | 1 | 2 med |
| 8 | Tài khoản | 9 (41–49) | 1 (+1 keep) | 4 med |
| 9 | Tin tức | 10 (50–59) | 1 | 2 med |
| 10 | Đăng nhập/ký/quên MK | 5 (60–64) | 4 | 1 med |
| 11 | Trang tĩnh/CS/Giới thiệu/Liên hệ | 8 (127–134) | 1 | 4 med |
| 12 | Đặt hàng thành công | 3 (139–141) | 1 (hỏi) | 1 med |
| 13 | So sánh SP (Next-only) | 2 (65–66) | 0 | 0 |

**Tổng: 107 điểm lệch.** Phần lớn là 🟢 MATCH thuần token/spacing/breakpoint (rủi ro thấp). Các 🔶 DECIDE tập trung ở mobile (nơi Next thường tốt hơn WP) — gom riêng ở cuối.

---

## 1. Header desktop — bar / navigation / mega menu

**Khớp WP (không cần sửa):** chiều cao header 80px ✓; font nav 16px display hẹp uppercase 600 trắng ✓; padding item 26/27px dọc ✓; ngưỡng đổi mobile/desktop 1261px ✓; logo 2 ảnh (desktop/mobile) ✓.

**[135] 🟢 Kim cương ngăn cách nav: 6px đỏ-đậm vs WP 5px đỏ tươi**
`≥1261` · low — WP `.navigation--item:after #ff0c09 5×5px` → Next `h-1.5 w-1.5 (6px) bg-[--bb-action-primary]` (red-700, AA-tối). **Sửa:** đổi về 5px + dùng `--bb-brand-primary` (#ff0c09) cho dấu trang trí (không cần AA).

**[136] ⚪ Padding ngang item nav giãn theo màn (clamp 30→44px) vs WP cố định 30px**
`≥~1500` · low · nextOnly — top/bottom & 30px tại 1261 đã khớp; chỉ giãn rộng hơn WP ở màn lớn/4K. **Khuyến nghị giữ** (chủ ý cho ultra-wide); nếu cần khớp tuyệt đối thì bỏ cận trên clamp.

**[137] 🔶 Hành vi cuộn header: WP tự ẩn khi cuộn xuống (Headroom) vs Next luôn ghim**
`mọi viewport (scroll)` · med · DECIDE — WP `header.headroom` ẩn header khi cuộn xuống/hiện lại khi cuộn lên; Next `StickyHeaderShell` chỉ đổi trạng thái "đã cuộn", header luôn hiện. **Khuyến nghị Giữ Next** (sticky luôn hiện là pattern hiện đại). Là hành vi, không thuần CSS — chờ bạn quyết.

**[138] 🔶 Mega menu là bản redesign Next (sidebar + lưới L3) vs dropdown mặc định WP**
`≥1261 (hover)` · med · DECIDE — Next dựng mega menu 2 cột (sidebar danh mục trái nền #f9f9f9 + lưới cột phải), WP là dropdown lồng đơn giản. **Khuyến nghị Giữ Next** (dựng lại theo WP là hạ cấp). Chờ bạn xác nhận giữ.

---

## 1b. Header mobile — hamburger drawer / bottom nav

**[101] 🔶 Drawer trượt từ TRÁI (Next) vs từ PHẢI (WP)**
`≤1260` · med · nextOnly/DECIDE — WP `.navigation` `right:0;translate(100%)` (vào từ phải); Next `.bb-mobile-header-drawer left:0;translateX(-100%)` (vào từ trái). **Sửa nếu theo WP:** neo phải, đổi nút đóng/overlay sang phải.

**[102] 🔶 Phone drawer hẹp (≤340–360px) vs WP full-width**
`360/576/767` · low — WP phone drawer phủ 100% chiều ngang; Next chỉ `min(86–88vw,340–360px)`, còn hở mép tối. **Sửa nếu theo WP:** `width:min(100vw,…)` ở max-md.

**[103] 🔶 Phone drawer phủ luôn header (top:0) vs WP bắt đầu dưới header (top:80px)**
`360/576/767` · med — WP giữ header hiện phía trên drawer; Next phủ toàn màn. **Sửa nếu theo WP:** `top:var(--bb-header-height); height:calc(100dvh - var(--bb-header-height))`.

**[104] 🔶 Header mobile 60px (Next) vs 80px (WP)**
`360/576/767` · med — WP giữ 80px tới phone; Next nén còn 60px (`--bb-header-height:3.75rem` ở ≤767). **Sửa nếu theo WP:** nâng về 5rem/80px; hoặc xác nhận 60px là chủ ý nén mobile.

**[105] ⚪ Bottom tab nav 5 mục là Next-only (WP không có) — GIỮ**
`<768` · low · nextOnly — cải thiện với tay 1 tay trên phone. Giữ; chỉ đảm bảo `md:hidden`.

**[106] 🔶 Tốc độ trượt drawer 280ms (Next) vs ~1000ms (WP)**
`≤1200` · low — WP animate ~1s; Next 280ms (nhanh hơn). **Khuyến nghị giữ 280ms**; nếu muốn giống WP nâng ~500ms qua duration token.

> Ghi chú: ngưỡng 1261, touch target 44px, không tràn ngang — đều đã khớp/đạt.

---

## 2. Footer

**[107] 🟢 Cột Thông tin/Mạng XH tách ở xl(1280) (Next) vs md(768) (WP)**
`768–1279` · med — WP col-md-7/col-md-5 (2 cột từ 768); Next chỉ `xl:grid-cols-12`. **Sửa:** đổi trigger lưới lồng sang `md:` (md:col-span-7/5).

**[108] 🟢 Footer info/social mặc định THU GỌN trên mobile (Next) vs WP MỞ sẵn**
`<768` · low — WP `@media max-767 .toggle--item-body{display:block}` mở sẵn; Next `useState(false)` ẩn tới khi chạm. **Sửa:** mặc định mở (initial true), vẫn giữ nút +/-.

**[109] 🟢 Cỡ chữ liên hệ (đt/email) nhỏ hơn WP trên desktop (24/20 vs WP 30px đồng nhất)**
`≥768` · med — WP `.contact-infor--item 2.143rem=30px` đồng nhất; Next phones 24 / email 20. **Sửa:** thêm/ dùng token footer-contact ~30px, 1 cỡ cho mọi dòng.

**[110] 🟢 Mobile chữ liên hệ co thêm (20/18) vs WP giữ 30px**
`<768` · low — Next override mobile tel 20 / mail 18; WP vẫn 30px. **Sửa:** nâng override mobile về ~30px (cùng token #109).

**[111] 🟢 Padding TOP footer-top mobile 36px (Next) vs 60px (WP)**
`<768` · low — bottom (0) đã khớp; chỉ top lệch. **Sửa:** `max-md:pt-9` → `pt-[60px]` nếu theo WP.

**[112] 🟢 Slogan footer quá lớn (48px) vs WP (16px)**
`768/1200/1920` · med — Next `--bb-text-footer-slogan:3rem` (48px); WP slogan h2 thực render 16px (rule 48px chỉ áp h3). **Sửa:** hạ token slogan về ~16px (verify trên trình duyệt).

**[113] 🟢 Khoảng cách social/link phình ~14% do quy đổi rem sai base**
`mọi viewport` · low — Next dùng rem literal của WP trên base 16px → social gap ~25px vs WP ~22px. **Sửa:** quy đổi rem footer của WP sang px (base 14px) trước khi áp.

---

## 3. Trang chủ

**[1] 🔶 Hero mobile: WP auto theo ảnh dọc vs Next ép 75vh + cắt (object-cover)**
`<768` · med · DECIDE — WP dùng ảnh mobile dọc 411×548 hiện đủ; Next ép `max-md:h-[75vh]` cắt giữa. **Theo WP** = bỏ 75vh, theo tỉ lệ ảnh mobile; **Giữ Next** = crop nhất quán above-the-fold.

**[2] 🟢 Carousel SP nổi bật: JS tính 3 thẻ nhưng CSS hiển thị 4 ở 768–1023 → chấm trang sai**
`768–1023` · med — `resolveSlidesPerView` trả 3 trong khi card flex-basis là 4-up từ 768. **Sửa:** đổi tier JS trả 4 từ ≥768 (khớp WP 767); giữ tier 1536→5/2560→6.

**[3] 🟢 Padding-top khối sản phẩm 60px (Next) vs 40px (WP)**
`mọi (desktop rõ nhất)` · low — `.bb-home-products-parity` pt 60 → **40** (giữ pb 40).

**[4] 🟢 Khối video: padding trong/title nhỏ hơn WP (64/72/52 vs 90/90/70)**
`desktop` · low — nâng inner pb→90, title pt→90/pb→70 (giữ các giảm responsive max-md).

**[5] 🟢 Tile danh mục nhỏ đổi 2→3 cột ở 600px (Next) vs 576px (WP)**
`576–599` · low — `min-[600px]` → `min-[576px]` (JSX page.tsx:485, không đụng block CSS 600px legacy).

**[6] 🟢 Tin tức (card) tiêu đề+trích 14px (Next) vs 16px (WP)**
`mọi` · low — `text-ui-14` → `text-ui-16` (page.tsx:311,317).

**[7] 🔶 Brand carousel thêm tier 3(430)/4(600); WP nhảy thẳng 2→5 ở 767**
`430–766` · low · DECIDE — Next mượt hơn (2/3/4/5); WP 2-up logo to quá khổ ở ~600–760. **Theo WP** = bỏ tier 430/600; **Giữ Next** = giữ ramp. (Giữ 1920→6/2560→7.)

**[8] ⚪ Video carousel: desktop Next 4/5/6/7 vs WP cố định 3; biên 2-up 480 vs 600**
`≥1024 & 480–599` · low · nextOnly — desktop nhiều video hơn = cải tiến, **giữ**. Tùy chọn nhỏ: biên 2-up 480→600 cho khớp WP.

**[9] 🟢 Experience carousel mobile hiện 1.1 slide (Next) vs 1.2 (WP)**
`<768` · low — base slidesPerView 1.1 → 1.2 (tùy chọn spaceBetween 12→13).

**[10] 🟢 Cột mô tả Experience cap 770px (Next) vs 66.67% co giãn (WP)**
`≥1200` · low — bỏ `max-w-[770px]`, giữ `md:w-2/3` để chạy theo 66.67% như WP.

**[11] 🟢 Đoạn SEO content-bottom 14px (Next) vs 16px (WP)**
`mọi` · low — `.bb-seo-content p` `--fs-caption(14)` → `--fs-body(16)`.

**[12] 🟢 Margin dưới heading "Sản phẩm nổi bật" mobile 14px (Next) vs 40px (WP)**
`<768` · low — bỏ `max-md:mb-[14px]` để giữ 40px như WP (hoặc giữ là chủ ý nén mobile).

---

## 4. Danh mục / Lưu trữ sản phẩm + Bộ lọc

**[13] 🔶 Thanh sort/filter dính (sticky) trên desktop ở Next; WP KHÔNG dính**
`≥768` · low · DECIDE — WP ép `position:relative` ≥768; Next `sticky top-20`. **Theo WP** = bỏ sticky desktop, chỉ dính ở mobile; **Giữ Next** (tiện hơn).

**[14] 🟢 Tiêu đề card archive 18px (Next) vs 16px (WP)**
`mọi` · low — `text-h4(18)` → `text-product-title(16)` (token đã có, đã encode WP 16px).

**[15] 🔶 Gutter grid mobile 12px (Next) vs 30px (WP); <375px Next rớt 1 cột**
`<768` · med · DECIDE — Next sát hơn (12px) + 1 cột ở <375; WP 30px, luôn 2 cột. **Theo WP** = gap 30px, giữ 2 cột; **Giữ Next** = mật độ cao.

**[16] 🔶 Card mobile có viền + nền (Next) vs WP không viền**
`<768` · low · DECIDE — Next `max-[767px]:border bg-card`; WP card trơn. **Giữ Next** (dễ chạm) hoặc bỏ viền theo WP.

**[17] 🔶 Ảnh card ép khung vuông (Next) vs cao tự nhiên (WP)**
`mọi` · med · DECIDE — Next `aspect-square` (hàng đều); WP cao theo ảnh (hàng so le). Ảnh vẫn giữ tỉ lệ trong khung. **Giữ Next** (lưới đều) hợp lý.

**[18] ⚪ Bar "Thêm vào giỏ" luôn hiện trên mobile (Next) vs WP chỉ hover (không chạm được)**
`<768` · low · nextOnly — WP lỗi mobile (CTA hover-only). **Giữ Next.**

**[19] 🟢 Bề rộng drawer lọc mobile min(86vw,340) (Next) vs 310px cố định (WP); padding 18/14 vs 25**
`<768` · low — chỉnh nhẹ về 310px/25px nếu muốn khớp (chưa có token 310/25 → "nice-to-match").

**[20] 🔶 Toolbar mobile: WP xếp count/filter/sort 50/50 (2/hàng) vs Next full-width xếp dọc**
`<768` · med · DECIDE — WP gọn (cell 50%, chữ 12px); Next cao hơn nhưng dễ chạm. **Theo WP** = cell 50/50; **Giữ Next** = target lớn.

**[21] ⚪ Khoảng dưới hero: WP page-title mb 90px vs Next hero xiên (clip-path) không margin**
`mọi` · low · nextOnly — hệ quả của hero xiên Next-only. **Giữ**; nếu thấy sát thì thêm pt #main-content qua spacing token.

---

## 5. Chi tiết sản phẩm (PDP)

**[114] 🔶 Thứ tự mobile đảo: WP info-trước, Next gallery-trước**
`<768 (UA mobile thật)` · med · DECIDE — WP `wp_is_mobile()` đưa title/giá/mua lên trên, gallery dưới; Next gallery trước → đẩy nút mua xuống dưới màn. **Theo WP** = info-col order-1 trên mobile. (Quan trọng cho mobile.)

**[115] 🟢 Gallery/summary 2 cột vỡ ở 768 (WP) nhưng tới 1025 mới vỡ (Next)**
`768–1024 (UA desktop)` · med — `max-[1024px]:flex-col` → `max-md:flex-col` (2 cột từ 768 như WP).

**[116] 🟢 Container PDP quá rộng ở dải 1025–1199**
`1025–1199` · med — Next nhảy 1140px từ 1025; WP giữ 960px tới 1200. **Sửa:** `max-w-[960px] min-[1200px]:max-w-[1140px]`.

**[117] 🟢 Cỡ giá 24px (Next) vs 21px (WP)**
`mọi` · low — thêm `--text-ui-21` (hoặc tạm `text-ui-20`) cho giá PricingPanel.

**[118] 🟢 Nhãn size-box & "Chia sẻ" 24px (Next) vs 21px (WP)**
`mọi` · low — chuyển các `text-ui-24` này về token 21px.

**[119] 🟢 Rail thumbnail dọc: WP từ 993px, Next từ 1025px → lệch dải 993–1024**
`993–1024` · **high** — chuyển mốc dọc của Next xuống ~993px (đừng đẩy về 768 — WP vẫn ngang 768–992).

**[120] 🟢 Nhãn badge tồn kho 13px (Next) vs ~14px (WP)**
`mọi` · low — `text-ui-13` → `text-ui-14` (khung 42/190px đã khớp).

**[121] ⚪ Mobile: WP giữ tab ngang; Next chuyển accordion xếp dọc**
`<768` · low · nextOnly — tab ngang WP chật/ tràn ở 360; Next accordion tốt hơn. **Giữ Next.**

**[122] 🟢 Carousel SP liên quan: 4 thẻ ở 767–1023 (WP) vs 3 (Next)**
`768/992` · med — nâng tier `≥768 return 4` (giữ 1536→5/2560→6).

**[123] 🟢 SP liên quan nhảy 2 thẻ ở 380px (Next) vs 420px (WP)**
`380–419` · low — đổi ngưỡng 2-thẻ về 420.

**[124] ⚪ Bảng thông số: WP giữ bảng 2 cột trên mobile; Next xếp 1 cột**
`<768` · low · nextOnly — Next dễ đọc hơn trên màn hẹp. **Giữ Next.**

**[125] ⚪ Nav neo (scroll-spy) dính trên mobile là Next-only (WP không có)**
`<768` · low · nextOnly — **Giữ.**

**[126] ⚪ Khối đánh giá: WP commentlist mặc định; Next có panel tóm tắt + form sidebar**
`mọi` · low · nextOnly — Next là bản nâng cấp. **Giữ.**

---

## 6. Giỏ hàng

**[22] 🟢 Tách 2 cột ở 768 (WP) vs 992 (Next)**
`768–991` · med — đổi `max-[991px]:` → `max-md:` cho cả 2 cột (giữ md:sticky).

**[23] 🟢 Tiêu đề "GIỎ HÀNG CỦA BẠN" ~16px (Next, class no-op) vs 24px (WP)**
`mọi` · low — h3 → `text-ui-24`, bỏ class `text-cart-total` (không định nghĩa ở đâu).

**[24] 🟢 Tổng tiền ~16px (Next, class no-op) vs 24px (WP)**
`mọi` · low — `text-cart-total` → `text-ui-24` (giữ `text-brand`).

**[25] 🔶 Stepper số lượng: thứ tự nút đảo (+/− vs −/+) & kiểu (WP 20px trơn vs Next 44px có viền)**
`mọi; touch <768` · med · DECIDE — **Giữ Next** (44px chạm tốt); tùy chọn chỉ đảo thứ tự nút về +/input/− như WP.

**[26] 🟢 WP có badge số lượng (kim cương đỏ) cạnh tiêu đề; Next bỏ**
`mọi` · low — thêm badge số (dữ liệu đã có), `bg-brand` chữ trắng `rotate-45`. (Hoặc giữ tiêu đề gọn là chủ ý.)

**[27] 🟢 WP có hàng nút "Tiếp tục mua hàng/Thanh toán" dưới cột SP; Next thiếu nút continue đen**
`mọi` · low — thêm link "Tiếp tục mua hàng" (đen) dưới cột items. KHÔNG thêm "Update cart" (đó là logic).

**[28] ⚪ Danh sách items có max-height + scroll riêng trên desktop (Next) vs WP không**
`≥768` · low · nextOnly — giữ summary trong tầm mắt. **Giữ Next.**

**[29] ⚪ Cột tổng tiền dính (sticky) trên desktop (Next) vs WP không**
`≥768` · low · nextOnly — **Giữ Next** (token --bb-header-stack).

**[30] 🟢 Tên SP 14px (WP) vs 16px (Next)**
`mọi` · low · *(kiểm tra typography pass trước)* — về `text-ui-14` nếu theo WP; có thể là chủ ý nâng cỡ của đợt typography.

**[31] 🟢 Breadcrumb padding dọc 16px (loaded) vs WP 30px + nhảy class loading→loaded**
`mọi` · low — cho loaded dùng `.bb-cart-breadcrumb` (30px/14px) như loading; fix luôn lệch WP + nhảy layout.

**[32] 🟢 Tiêu đề H1 cart loaded luôn UPPERCASE vs quy tắc dự án (none ở desktop)**
`≥768` · low — bỏ `uppercase` vô điều kiện, dùng `max-md:uppercase` như skeleton loading.

---

## 7. Thanh toán

**[33] 🔶 Tỉ lệ 2 cột: WP 66.7/33.3 co giãn vs Next 1fr/360px cố định (sidebar phình ~47% ở 768)**
`768–1199` · low · DECIDE — **Theo WP** = `md:grid-cols-[2fr_1fr]`; hoặc đệm dải 768–1023.

**[34] 🔶 Vị trí "Phương thức TT + Đặt hàng": WP ở cột phải (dưới tổng) vs Next ở cột trái (Bước 2)**
`≥768` · med · DECIDE — Next dùng wizard có số bước. **Theo WP** = chuyển khối JSX sang aside; **Giữ Next** = giữ layout bước. (Di chuyển trình bày, giữ handler.)

**[35] 🟢 Badge số bước: WP kim cương đỏ 20px có bóng vs Next vuông phẳng 34px**
`mọi` · low — thu ~20px, `rotate-45` + số counter-rotate, giữ `bg-brand`; bóng chỉ thêm nếu có token shadow.

**[36] 🟢 Cao input: WP 52px vs Next 44 mobile / 48 desktop**
`mọi` · low — nâng min-height control về ~52px qua token (giữ sàn 44px touch).

**[37] 🟢 Cỡ label: WP 14px vs Next 13px (mobile)**
`<768` · low — label về `--text-ui-14`.

**[38] 🟢 Thẻ tóm tắt: WP bóng đổ, sticky@100px vs Next viền, sticky@header-stack+16**
`≥768` · low — chrome (bóng vs viền) lệch thật → có thể đổi sang shadow token; **sticky giữ token --bb-header-stack** (đừng về 100px cứng). Khuyến nghị giữ viền cho đồng bộ thẻ Next.

**[39] ⚪ Next có radio chọn phương thức vận chuyển; WP chỉ hiện ở bảng tổng**
`mọi` · low · nextOnly — **Giữ Next** (UX rõ hơn).

**[40] 🟢 Nhịp bước: WP 30px padding/title vs Next ~14px giữa thẻ / 16px dưới title**
`mọi` · low · med — nâng dưới-title `mb-4→mb-6`, giữa bước `mb-3.5→mb-6/8` qua spacing token.

---

## 8. Tài khoản

**[41] 🟢 Sidebar/nội dung xếp dọc ở ≤1024 (Next) vs ≤768 (WP)**
`768–1024` · med — chuyển mốc gộp 1 cột về ≤767 (md) để giữ 2 cột 768–1024 như WP (giữ tier ≥1280/1536/1920).

**[42] 🟢 Mô hình sidebar: WP 25%/75% co giãn vs Next rail cố định 282px; rail 1280 vs WP 1140**
`≥768` · med — (a) đưa max-width nền về 1140 qua token, hoặc (b) chuyển rail sang ~25% theo WP.

**[43] 🟢 Bảng đơn hàng mobile: WP xếp thẻ có nhãn vs Next cuộn ngang 5 cột**
`≤768` · med — thêm bản `md:hidden` dạng thẻ xếp (MobileCardList pattern), giữ bảng desktop.

**[44] 🟢 Bảng chi tiết hóa đơn: cũng cuộn ngang mobile vs WP xếp**
`≤640` · low — đồng bộ với #43 (2 cột nên nhẹ hơn); ít nhất kiểm tra không tràn ở 360.

**[45] 🔶 Nav sidebar mobile: WP danh sách dọc full-width vs Next hàng chip cuộn ngang**
`≤767` · low · DECIDE — Next gọn, không đẩy nội dung xuống. **Giữ Next** (đảm bảo chip ≥44px) hoặc về dọc theo WP.

**[46] 🟢 Spacing & active item nav khác (30px/đỏ vs 16px/kim cương cam)**
`≥768` · low — nâng padding item về ~30px nếu khớp mật độ WP; màu active/marker là design-system Next (giữ, nhưng lấy từ token).

**[47] 🔶 Khối user: WP ẩn avatar vs Next hiện avatar chữ-cái-tròn trong thẻ viền**
`mọi` · low · DECIDE — **Giữ Next** (sạch, on-brand) hoặc ẩn avatar theo WP. (SĐT là vấn đề data — ngoài phạm vi.)

**[48] 🟢 Form sửa tài khoản: 2 cột ở sm(640) (Next) vs md(768) (WP); nút submit gọn vs full-width**
`640–768 + nút` · med — đổi `sm:grid-cols-*` → `md:`; nút save full-width mobile như form sửa địa chỉ (đang lệch chuẩn nội bộ).

**[49] 🟢 Padding dọc khối account: WP 40/40 vs Next 8 top/56 bottom**
`≥768` · low — căn top dưới breadcrumb về ~40px qua spacing token (giữ emblem-clearance offset).

---

## 9. Tin tức / Bài viết

**[50] 🟢 Breakpoint cột listing lệch 1px do max-width (Next) vs min-width (WP)**
`đúng 576 & 768` · low — đổi class cột từ max-width sang min-width (`min-[576px]:` + `md:`) như section liên quan đã đúng.

**[51] 🟢 Tiêu đề card listing to/đậm hơn WP (18/600/24 vs 16/400/20)**
`mọi` · low — `text-base font-normal leading-5` (16/400/20).

**[52] 🟢 Card mobile bỏ bóng đổi sang viền (Next) vs WP giữ bóng**
`≤767` · low — bỏ swap `max-md:` để giữ `--bb-shadow-md` mọi viewport như WP.

**[53] ⚪ Độ dài trích listing: WP ~120 ký tự vs Next 20 từ**
`mọi` · — **NGOÀI PHẠM VI** (là logic cắt chữ, không phải CSS). Chỉ ghi nhận.

**[54] 🟢 Tiêu đề sidebar "Danh mục tin tức" bị uppercase + phóng to vs WP**
`mọi + desktop` · low — dùng style widget-title (`--fs-h2` 24px, normal-case, không scale-up) thay `sectionHeading`.

**[55] 🟢 Tiêu đề widget bài viết: lệch weight & case (size đã khớp 20px)**
`mọi` · low — `font-semibold normal-case` → `font-bold uppercase` (giữ `text-h3` 20px).

**[56] 🟢 Tiêu đề "CÓ THỂ BẠN QUAN TÂM" to hơn WP (24/35 vs ~18–19 UA)**
`mọi` · low — dùng họ widget-big (text-h3 20px bold uppercase) thay `sectionHeading`.

**[57] 🟢 Nút share thành pill xanh chữ-cái thay vì icon FA xám (WP)**
`mọi` · med — bỏ nền tròn xanh, dùng icon xám (`text-muted-foreground`) gap 30px, hover `text-brand`; label uppercase semibold xám. (Glyph FA là việc font — ngoài phạm vi.)

**[58] 🔶 Banner trang (H1 size đã khớp 24px); chỉ chiều cao banner mobile khác (300 vs 450)**
`<768` · med · nextOnly/DECIDE — H1 24px đã khớp WP mọi nơi. Chỉ banner mobile Next 300px vs WP 450px. PageHero là component dùng chung site-wide → chờ bạn quyết (WP 450px chủ yếu là khoảng trống — wpWeaker khả dĩ).

**[59] 🟢 Breadcrumb hero mobile cắt cứng cả chuỗi thay vì gọn first+last (WP)**
`≤767` · low — thêm collapse mobile: ẩn crumb giữa, giữ first+last (`max-md:hidden`).

---

## 10. Đăng nhập / Đăng ký / Quên mật khẩu

**[60] 🔶 H1 auth: Next 24px UPPERCASE vs WP ~16px thường**
`mọi` · low · DECIDE — sửa ở `globals.css:660-669` + `3624-3629` (KHÔNG phải authHeading) → 16px token + `text-transform:none` nếu theo WP; hoặc giữ heading 24px in hoa của Next.

**[61] 🔶 Form đăng ký: WP 2 cột (md+) vs Next 1 cột**
`768–1920` · med · DECIDE — **Giữ Next 1 cột** (WP cap 320px nên 2 cột thành ~145px chật). Theo WP cần nới wrap + md:grid-cols-2 (hạ UX).

**[62] 🔶 Tiêu đề Quên/Đổi MK: WP h3 thường nhỏ vs Next 24px UPPERCASE**
`mọi` · low · DECIDE — gắn theo fix #60. (Lệch chữ "Đổi mật khẩu" là i18n — ngoài phạm vi.)

**[63] 🟢 Khoảng cách field: WP 30px phẳng vs Next 30 desktop/18 mobile**
`<768` · low — bỏ override `gap:18px` mobile để giữ 30px như WP (hoặc giữ là nén mobile chủ ý).

**[64] 🔶 Thẻ auth thêm viền + nền + padding trên mobile (Next-only)**
`<768` · low · DECIDE — **Giữ Next** (form WP trần full-bleed yếu hơn trên mobile) hoặc bỏ chrome theo WP.

---

## 11. Trang tĩnh / Chính sách / Giới thiệu / Hướng dẫn / Liên hệ

**[127] 🟢 Sidebar trang Hướng dẫn ở PHẢI + đảo thứ tự vs WP (sidebar TRÁI)**
`≥1024` · low — đảo `bb-detail-layout` để aside render trước (sidebar trái như WP).

**[128] 🟢 Tỉ lệ cột Hướng dẫn ~55/45 vs WP 25/75 (sidebar quá rộng)**
`≥1024` · med — `bb-detail-layout` về `9fr/3fr` (aside trước) khớp 75/25 WP.

**[129] 🟢 Sidebar/nội dung vỡ ở 1024 (Next) vs 768 (WP)**
`768–1023` · med — chuyển breakpoint 2 cột (policy + bb-detail-layout) về md(768).

**[130] 🟢 Giới thiệu: hàng đa cột gộp ở 1024 (Next) vs 768 (WP)**
`768–992` · low — đổi grid About từ `lg:` sang `md:`.

**[131] 🟢 Heading "Bigbike" (Giới thiệu) bị thu còn 24px vs WP 50px**
`≥768` · low — dùng token display lớn (~50px, `--fs-h2/h1`) thay `!text-ui-24`.

**[132] 🔶 Liên hệ: WP mở đầu bằng MAP full-width trên cùng vs Next có hero banner + map nhét cột phải**
`mọi` · med · DECIDE — **Theo WP** = thêm dải map full-width đầu trang; **Giữ Next** = hero + map 2 cột.

**[133] 🟢 Liên hệ: info/form vỡ ở 1024 (Next) vs 768 (WP)**
`768–992` · low — lưới 2 cột liên hệ về `md:`.

**[134] 🟢 Tile dịch vụ (Giới thiệu) thiếu layout thẻ min-height 400px có bóng của WP**
`≥768` · med — render thẻ có padding/min-height/bóng đa cột thay vì hàng mỏng (nếu theo WP).

---

## 12. Đặt hàng thành công

> Next `/don-hang/xac-nhan` đã bám đúng cấu trúc WooCommerce `thankyou.php` (thông báo + overview + bảng đơn + địa chỉ). Tuy nhiên WP còn 1 màn thành công riêng cần làm rõ.

**[139] 🔶/❓ WP có màn thành công CĂN GIỮA (ảnh + lời cảm ơn) — Next chỉ hiển thị bảng chi tiết**
`mọi` · med · HỎI — WP `payment-success.css .payment-success{max-width:370px;text-align:center}` + ảnh `payment-success.png` + `.desc h3 24px display hẹp cũ`. Next chỉ render kiểu bảng (thông báo+overview+bảng+địa chỉ). **Cần bạn xác nhận:** màn thành công khách thấy thật là (a) bảng chi tiết như Next, (b) màn ảnh+cảm ơn căn giữa của WP, hay (c) ảnh+cảm ơn rồi mới tới chi tiết. Không tự quyết.

**[140] 🟢 Bảng chi tiết đơn dựa vào cuộn ngang trên mobile (overflow-x-auto)**
`≤480` · low — WP shop_table_responsive xếp dọc ≤768; Next cuộn ngang (2 cột nên nhẹ). Đồng bộ pattern với #43/#44.

**[141] 🟢 Tiêu đề mục dùng sectionHeading (uppercase 24/35) — to/hoa hơn mặc định WP**
`mọi` · low — dùng token nhỏ hơn (text-h3 20px, normal-case) cho tiêu đề "Chi tiết đơn hàng"/địa chỉ (cùng họ fix #54/#56).

---

## 13. So sánh sản phẩm (Next-only — WP không có)

**[65] 🟢 CompareBar bị MobileBottomNav che mất hàng dưới trên mobile (<768)**
`<768` · low · nextOnly — CompareBar `bottom-0 z-40` bị bottom-nav (z-650, ~76px) đè → mất nút "So sánh/Xóa tất cả". **Sửa:** `bottom-[calc(var(--bb-mobile-nav-height)+env(safe-area-inset-bottom))] md:bottom-0` (đúng pattern cart-toast/FloatingChat).

**[66] 🟢 Nút xóa chip CompareBar chỉ 20px (< 44px) trên mobile**
`<768` · low · nextOnly — `h-5 w-5` (20px). **Sửa:** `pointer-coarse:h-[var(--bb-touch-target)] w-[…]` (giữ glyph 14px). Áp luôn nút xóa ở ComparisonTable (24px).

---

## 🔶 DANH SÁCH CẦN BẠN QUYẾT (Follow WP ⟷ Keep Next)

| # | Vấn đề | Khuyến nghị |
|---|---|---|
| 1 | Hero mobile: crop 75vh vs ảnh dọc WP | tùy gu — Keep Next nếu thích nhất quán |
| 7 | Brand carousel 2/3/4/5 vs WP 2→5 | Keep Next |
| 13 | Toolbar sort sticky desktop | Keep Next |
| 15 | Gutter grid mobile 12 vs 30 | **mobile**: tùy mật độ mong muốn |
| 16 | Card mobile có viền | Keep Next |
| 17 | Ảnh card khung vuông | Keep Next |
| 20 | Toolbar mobile 50/50 vs xếp dọc | **mobile**: Keep Next (chạm dễ) |
| 25 | Stepper số lượng kiểu/thứ tự | Keep Next, tùy chọn đảo nút |
| 33 | Tỉ lệ 2 cột checkout | Theo WP (2fr/1fr) |
| 34 | Vị trí "Đặt hàng" trái vs phải | tùy gu wizard |
| 45 | Nav account mobile chip vs dọc | Keep Next |
| 47 | Avatar account | Keep Next |
| 58 | Chiều cao banner mobile 300 vs 450 | tùy — component dùng chung |
| 60/62 | H1 auth 24px hoa vs 16px thường | tùy gu thương hiệu |
| 61 | Form đăng ký 1 vs 2 cột | Keep Next |
| 64 | Thẻ auth có viền mobile | Keep Next |
| 101–104,106 | Drawer mobile: hướng/độ rộng/vị trí/chiều cao/tốc độ | **mobile** — nhóm quyết 1 lần |
| 114 | Thứ tự mobile PDP (info trước?) | **mobile**: nên Theo WP (mua dễ thấy) |
| 132 | Liên hệ: map full-width vs hero | tùy gu |
| 137 | Header tự ẩn khi cuộn | Keep Next |
| 138 | Mega menu redesign | Keep Next |
| 139 | Màn đặt hàng thành công kiểu nào | **cần bạn trả lời** |

---

## ✅ Gợi ý lô an toàn để duyệt nhanh (🟢 thuần token/spacing/breakpoint, rủi ro thấp)

**Lô A — Khớp breakpoint WP (đổi ngưỡng cột):** 5, 22, 41, 50, 107, 115, 116, 122, 123, 129, 130, 133
**Lô B — Khớp cỡ chữ/typography token:** 6, 11, 14, 23, 24, 51, 54, 55, 56, 109, 110, 112, 117, 118, 120, 131, 141
**Lô C — Khớp spacing:** 3, 4, 12, 31, 40, 49, 111, 113
**Lô D — Bugfix/khớp hành vi rõ ràng:** 2 (chấm trang), 32 (uppercase), 52 (bóng card), 59 (breadcrumb), 65 (CompareBar che), 66 (touch target), 108 (footer mở mobile), 119 (rail thumbnail), 127/128 (sidebar Hướng dẫn)

> Bạn có thể duyệt theo lô (vd "duyệt lô A,B") hoặc theo từng số. Tôi sẽ sửa từng lô, chạy build/lint/test + đối chiếu viewport, báo kết quả rồi mới sang lô kế.
