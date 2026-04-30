-- V21: Seed 7 static pages missing from the pages table.
-- V1000 dev seed already has: gioi-thieu, chinh-sach-bao-hanh.
-- This migration adds the remaining pages needed for all deployments (dev + prod).
-- Also adds og_image_url site_settings placeholder.
-- All inserts are idempotent via WHERE NOT EXISTS (H2 + PostgreSQL compatible).

-- ============================================================
-- 1. POLICY PAGES
-- ============================================================

insert into pages (id, slug, title, body, page_type, publish_status,
                   seo_title, seo_description, seo_canonical_url, seo_no_index,
                   published_at, created_at, updated_at)
select 'page_chinh_sach_bao_mat', 'chinh-sach-bao-ve-thong-tin-ca-nhan',
       'Chính sách bảo vệ thông tin cá nhân',
       '<h2>Thông tin chúng tôi thu thập</h2>
<p>Khi bạn mua hàng hoặc đăng ký tài khoản tại BigBike.vn, chúng tôi có thể thu thập: họ tên, số điện thoại, địa chỉ email, địa chỉ giao hàng, lịch sử đơn hàng.</p>
<h2>Mục đích sử dụng thông tin</h2>
<ul>
<li>Xử lý đơn hàng và giao hàng</li>
<li>Liên hệ xác nhận đơn hàng</li>
<li>Hỗ trợ khách hàng sau mua</li>
<li>Gửi thông tin khuyến mãi (nếu bạn đồng ý)</li>
</ul>
<h2>Cam kết bảo mật</h2>
<p>BigBike <strong>không</strong> bán, trao đổi hoặc chuyển nhượng thông tin cá nhân của bạn cho bên thứ ba, trừ khi có sự đồng ý của bạn hoặc theo yêu cầu của pháp luật.</p>
<h2>Quyền của bạn</h2>
<p>Bạn có quyền yêu cầu xem, chỉnh sửa hoặc xóa thông tin cá nhân bất kỳ lúc nào. Liên hệ: info@bigbike.vn hoặc hotline 028.62797251.</p>', 'POLICY', 'PUBLISHED',
       'Chính sách bảo mật thông tin cá nhân | BigBike',
       'Cam kết bảo mật và bảo vệ thông tin cá nhân của khách hàng tại BigBike.vn.',
       'https://bigbike.vn/chinh-sach/bao-mat/', false,
       '2026-04-01T01:00:00Z', '2026-04-01T01:00:00Z', '2026-04-25T00:00:00Z'
where not exists (select 1 from pages where slug = 'chinh-sach-bao-ve-thong-tin-ca-nhan');

insert into pages (id, slug, title, body, page_type, publish_status,
                   seo_title, seo_description, seo_canonical_url, seo_no_index,
                   published_at, created_at, updated_at)
select 'page_chinh_sach_doi_tra', 'chinh-sach-doi-tra-hang',
       'Chính sách đổi trả hàng',
       '<h2>Thời hạn đổi trả</h2>
<p>BigBike hỗ trợ đổi / trả sản phẩm trong vòng <strong>7 ngày</strong> kể từ ngày nhận hàng.</p>
<h2>Điều kiện đổi trả</h2>
<ul>
<li>Sản phẩm <strong>chưa qua sử dụng</strong>, còn nguyên tem, nhãn, đóng gói đầy đủ</li>
<li>Có hóa đơn mua hàng hoặc xác nhận đơn hàng từ BigBike</li>
<li>Lý do đổi trả hợp lệ: sai size, sai màu, lỗi nhà sản xuất</li>
</ul>
<h2>Trường hợp KHÔNG áp dụng đổi trả</h2>
<ul>
<li>Sản phẩm đã sử dụng, bị trầy xước, biến dạng</li>
<li>Sản phẩm khuyến mãi ghi rõ "không đổi trả"</li>
<li>Quá 7 ngày kể từ ngày nhận hàng</li>
</ul>
<h2>Quy trình đổi trả</h2>
<ol>
<li>Liên hệ hotline <strong>028.62797251</strong> hoặc nhắn Zalo <strong>0764640679</strong> trước khi gửi hàng về.</li>
<li>Đóng gói sản phẩm cẩn thận, kèm hóa đơn và ghi rõ lý do đổi trả.</li>
<li>Gửi về địa chỉ: <strong>79/30/52 Âu Cơ, P.14, Q.11, TP.HCM</strong></li>
<li>BigBike kiểm tra và xử lý trong vòng 3 — 5 ngày làm việc.</li>
</ol>
<h2>Phí vận chuyển đổi trả</h2>
<ul>
<li>Lỗi do nhà sản xuất / BigBike giao sai: BigBike chịu phí ship 2 chiều.</li>
<li>Đổi size hoặc thay đổi ý: khách hàng chịu phí ship 1 chiều.</li>
</ul>', 'POLICY', 'PUBLISHED',
       'Chính sách đổi trả sản phẩm 7 ngày | BigBike',
       'Chính sách đổi trả hàng trong vòng 7 ngày tại BigBike — đảm bảo quyền lợi người mua.',
       'https://bigbike.vn/chinh-sach/doi-tra/', false,
       '2026-04-01T01:00:00Z', '2026-04-01T01:00:00Z', '2026-04-25T00:00:00Z'
where not exists (select 1 from pages where slug = 'chinh-sach-doi-tra-hang');

insert into pages (id, slug, title, body, page_type, publish_status,
                   seo_title, seo_description, seo_canonical_url, seo_no_index,
                   published_at, created_at, updated_at)
select 'page_dieu_khoan', 'cac-dieu-kien-va-dieu-khoan',
       'Điều kiện & Điều khoản sử dụng',
       '<p>Khi sử dụng website BigBike.vn, bạn đồng ý với các điều khoản dưới đây.</p>
<h2>Thông tin doanh nghiệp</h2>
<ul>
<li><strong>Tên cửa hàng</strong>: BigBike.vn</li>
<li><strong>Địa chỉ</strong>: 79/30/52 Âu Cơ, Phường 14, Quận 11, TP.HCM</li>
<li><strong>Điện thoại</strong>: 028.62797251</li>
<li><strong>Email</strong>: info@bigbike.vn</li>
</ul>
<h2>Quyền sở hữu trí tuệ</h2>
<p>Toàn bộ nội dung trên website BigBike.vn (hình ảnh, văn bản, thương hiệu, icon) thuộc quyền sở hữu của BigBike hoặc được sử dụng với sự cho phép. Nghiêm cấm sao chép, phân phối lại mà không có sự đồng ý bằng văn bản.</p>
<h2>Giới hạn trách nhiệm</h2>
<p>BigBike không chịu trách nhiệm về các thiệt hại phát sinh do sử dụng sai sản phẩm, không tuân thủ hướng dẫn của nhà sản xuất hoặc do lỗi kỹ thuật ngoài tầm kiểm soát của chúng tôi.</p>
<h2>Thay đổi điều khoản</h2>
<p>BigBike có quyền thay đổi điều khoản này bất kỳ lúc nào. Phiên bản mới nhất luôn được đăng tải tại trang này.</p>', 'POLICY', 'PUBLISHED',
       'Điều khoản sử dụng BigBike.vn',
       'Điều kiện và điều khoản sử dụng dịch vụ, website và mua sắm tại BigBike.vn.',
       'https://bigbike.vn/chinh-sach/dieu-khoan/', false,
       '2026-04-01T01:00:00Z', '2026-04-01T01:00:00Z', '2026-04-25T00:00:00Z'
where not exists (select 1 from pages where slug = 'cac-dieu-kien-va-dieu-khoan');

-- ============================================================
-- 2. HELP PAGES
-- ============================================================

insert into pages (id, slug, title, body, page_type, publish_status,
                   seo_title, seo_description, seo_canonical_url, seo_no_index,
                   published_at, created_at, updated_at)
select 'page_huong_dan_mua_hang', 'huong-dan-mua-hang',
       'Hướng dẫn mua hàng',
       '<h2>Mua hàng trực tuyến (Online)</h2>
<ol>
<li><strong>Chọn sản phẩm</strong>: Duyệt theo danh mục hoặc tìm kiếm tên sản phẩm / thương hiệu.</li>
<li><strong>Chọn size và màu</strong>: Tham khảo bảng size trước khi đặt hàng. Liên hệ tư vấn nếu chưa chắc chắn.</li>
<li><strong>Thêm vào giỏ hàng</strong>: Nhấn "THÊM VÀO GIỎ HÀNG", kiểm tra giỏ hàng.</li>
<li><strong>Thanh toán</strong>: Điền thông tin giao hàng, chọn phương thức thanh toán (COD hoặc chuyển khoản).</li>
<li><strong>Xác nhận đơn hàng</strong>: BigBike sẽ liên hệ xác nhận trong vòng 30 phút — 2 giờ làm việc.</li>
</ol>
<h2>Mua hàng trực tiếp tại cửa hàng</h2>
<p>Địa chỉ: <strong>79/30/52 Âu Cơ, P.14, Q.11, TP.HCM</strong></p>
<p>Mang xe đến, đội ngũ tư vấn sẽ giúp bạn thử đồ và chọn size chuẩn nhất.</p>
<h2>Phương thức thanh toán</h2>
<ul>
<li><strong>Tiền mặt</strong> (COD — khi nhận hàng)</li>
<li><strong>Chuyển khoản ngân hàng</strong> (Vietcombank, Techcombank, BIDV)</li>
<li><strong>Ví điện tử</strong> (Momo, ZaloPay)</li>
</ul>
<h2>Thời gian giao hàng</h2>
<ul>
<li><strong>Nội thành TP.HCM</strong>: 1 — 2 ngày làm việc</li>
<li><strong>Các tỉnh thành khác</strong>: 3 — 7 ngày làm việc (tùy địa chỉ)</li>
</ul>
<h2>Liên hệ hỗ trợ</h2>
<p>Hotline: <strong>028.62797251</strong> — <strong>0764640679</strong> (Mrs. Thư / Zalo)</p>', 'HELP', 'PUBLISHED',
       'Hướng dẫn mua hàng tại BigBike',
       'Hướng dẫn chi tiết cách đặt hàng, thanh toán và nhận hàng tại BigBike.vn — nhanh chóng, an toàn.',
       'https://bigbike.vn/huong-dan-mua-hang/', false,
       '2026-04-01T01:00:00Z', '2026-04-01T01:00:00Z', '2026-04-25T00:00:00Z'
where not exists (select 1 from pages where slug = 'huong-dan-mua-hang');

insert into pages (id, slug, title, body, page_type, publish_status,
                   seo_title, seo_description, seo_canonical_url, seo_no_index,
                   published_at, created_at, updated_at)
select 'page_cach_do_size_dau', 'cach-do-size-dau',
       'Cách xác định size mũ bảo hiểm',
       '<p>Chọn đúng size mũ là yếu tố quan trọng nhất để mũ bảo vệ hiệu quả và đội thoải mái.</p>
<h2>Cách đo chu vi đầu</h2>
<ol>
<li>Dùng thước dây mềm (hoặc sợi dây + thước cứng).</li>
<li>Đo vòng quanh đầu tại <strong>điểm lớn nhất</strong> — khoảng 2.5 cm phía trên lông mày, ngang qua đỉnh tai.</li>
<li>Kết quả đo bằng <strong>cm</strong>.</li>
</ol>
<h2>Bảng size mũ bảo hiểm</h2>
<table>
<thead><tr><th>Size</th><th>Chu vi đầu (cm)</th></tr></thead>
<tbody>
<tr><td>XS</td><td>53 — 54 cm</td></tr>
<tr><td>S</td><td>55 — 56 cm</td></tr>
<tr><td>M</td><td>57 — 58 cm</td></tr>
<tr><td>L</td><td>59 — 60 cm</td></tr>
<tr><td>XL</td><td>61 — 62 cm</td></tr>
<tr><td>XXL</td><td>63 — 64 cm</td></tr>
<tr><td>3XL</td><td>65 — 66 cm</td></tr>
</tbody>
</table>
<h2>Lưu ý quan trọng</h2>
<ul>
<li><strong>Mũ vừa đúng size</strong> phải ôm sát đều toàn bộ đầu, không lắc được khi đội mà chưa cài khóa.</li>
<li>Mũ mới thường hơi chặt — sau 2–4 giờ sử dụng, lớp lót sẽ giãn ra vừa vặn.</li>
<li>Hình đầu tròn (round oval), trung bình (intermediate oval) hay dài (long oval) ảnh hưởng đến comfort — tư vấn với BigBike để chọn mũ phù hợp.</li>
<li>Luôn thử mũ trực tiếp nếu có thể, hoặc liên hệ hotline để được tư vấn.</li>
</ul>', 'HELP', 'PUBLISHED',
       'Cách xác định size mũ bảo hiểm chính xác | BigBike',
       'Hướng dẫn đo chu vi đầu và tra bảng size mũ bảo hiểm fullface, 3/4, lật hàm từ AGV, LS2, MT, HJC...',
       'https://bigbike.vn/huong-dan/size-mu/', false,
       '2026-04-01T01:00:00Z', '2026-04-01T01:00:00Z', '2026-04-25T00:00:00Z'
where not exists (select 1 from pages where slug = 'cach-do-size-dau');

insert into pages (id, slug, title, body, page_type, publish_status,
                   seo_title, seo_description, seo_canonical_url, seo_no_index,
                   published_at, created_at, updated_at)
select 'page_cach_do_size_gang_tay', 'cach-do-size-gang-tay',
       'Cách đo size găng tay bảo hộ',
       '<p>Chọn đúng size găng tay giúp bảo vệ tốt hơn và lái xe thoải mái hơn.</p>
<h2>Cách đo</h2>
<ol>
<li>Dùng thước dây, đo vòng quanh bàn tay tại điểm rộng nhất (qua các đốt ngón tay, không tính ngón cái).</li>
<li>Đo bằng <strong>cm</strong> (hoặc <strong>inch</strong> rồi chuyển đổi).</li>
<li>Tham khảo bảng size của từng thương hiệu — size khác nhau giữa các hãng.</li>
</ol>
<h2>Bảng size tham khảo chung</h2>
<table>
<thead><tr><th>Size</th><th>Vòng bàn tay (cm)</th></tr></thead>
<tbody>
<tr><td>XS</td><td>17 — 18 cm</td></tr>
<tr><td>S</td><td>18 — 19 cm</td></tr>
<tr><td>M</td><td>19 — 20 cm</td></tr>
<tr><td>L</td><td>20 — 21 cm</td></tr>
<tr><td>XL</td><td>21 — 22 cm</td></tr>
<tr><td>XXL</td><td>22 — 24 cm</td></tr>
</tbody>
</table>
<h2>Lưu ý</h2>
<ul>
<li>Nếu tay bạn ở giữa hai size, chọn size lớn hơn để thoải mái.</li>
<li>Với găng tay mùa đông (có lót dày), có thể chọn lớn hơn 0.5 size.</li>
<li>Mỗi thương hiệu có thể có bảng size riêng — luôn kiểm tra trên trang sản phẩm.</li>
</ul>', 'HELP', 'PUBLISHED',
       'Cách đo size găng tay bảo hộ moto chính xác | BigBike',
       'Hướng dẫn chi tiết cách đo size tay để chọn găng tay bảo hộ moto vừa vặn, không chật không rộng.',
       'https://bigbike.vn/huong-dan/size-gang-tay/', false,
       '2026-04-01T01:00:00Z', '2026-04-01T01:00:00Z', '2026-04-25T00:00:00Z'
where not exists (select 1 from pages where slug = 'cach-do-size-gang-tay');

-- ============================================================
-- 3. CONTACT PAGE
-- ============================================================

insert into pages (id, slug, title, body, page_type, publish_status,
                   seo_title, seo_description, seo_canonical_url, seo_no_index,
                   published_at, created_at, updated_at)
select 'page_lien_he', 'lien-he',
       'Liên hệ BigBike',
       '<h2>Địa chỉ cửa hàng</h2>
<p><strong>79/30/52 Âu Cơ, Phường 14, Quận 11, TP.HCM</strong></p>
<h2>Hotline &amp; Zalo</h2>
<ul>
<li><strong>028.62797251</strong> — Tổng đài</li>
<li><strong>0764640679</strong> — Mrs. Thư (Zalo)</li>
<li><strong>0906902404</strong> — Mr. Trí</li>
</ul>
<h2>Giờ mở cửa</h2>
<table>
<thead><tr><th>Ngày</th><th>Giờ</th></tr></thead>
<tbody>
<tr><td>Thứ 2 — Thứ 6</td><td>09:00 — 21:00</td></tr>
<tr><td>Thứ 7, Chủ Nhật</td><td>09:00 — 18:00</td></tr>
</tbody>
</table>
<h2>Kênh mạng xã hội</h2>
<ul>
<li><strong>Facebook</strong>: facebook.com/bigbikegear</li>
<li><strong>YouTube</strong>: BigBike Vietnam</li>
</ul>
<h2>Để lại lời nhắn</h2>
<p>Nếu bạn cần tư vấn ngoài giờ làm việc, hãy nhắn tin qua <strong>Zalo 0764640679</strong> — chúng tôi sẽ phản hồi sớm nhất có thể.</p>', 'CONTACT', 'PUBLISHED',
       'Liên hệ BigBike — Shop Bảo Hộ Biker TP.HCM',
       'Liên hệ BigBike qua hotline, Zalo hoặc đến trực tiếp cửa hàng tại 79/30/52 Âu Cơ, P.14, Q.11, TP.HCM.',
       'https://bigbike.vn/lien-he/', false,
       '2026-04-01T01:00:00Z', '2026-04-01T01:00:00Z', '2026-04-25T00:00:00Z'
where not exists (select 1 from pages where slug = 'lien-he');

-- ============================================================
-- 4. SITE SETTINGS — og_image_url placeholder
-- ============================================================

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000520', 'og_image_url',
       '',
       'seo', true, 'Open Graph image URL for social sharing (1200x630 recommended). Upload via admin.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'og_image_url');
