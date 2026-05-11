-- V96: Seed trang Giới thiệu vào bảng pages.
-- Trang này chỉ có trong test-seed.sql (H2), chưa có trong migration thật → 404 ở dev/prod.
-- Idempotent via WHERE NOT EXISTS.

insert into pages (id, slug, title, body, page_type, publish_status,
                   seo_title, seo_description, seo_canonical_url, seo_no_index,
                   published_at, created_at, updated_at)
select 'page_gioi_thieu', 'gioi-thieu', 'Giới thiệu BigBike',
'<h1>GIỚI THIỆU BIGBIKE</h1>
<p>BigBike là cửa hàng chuyên cung cấp đồ bảo hộ moto / biker gear chính hãng tại TP.HCM, hoạt động từ năm 2013. Chúng tôi phân phối trực tiếp từ các thương hiệu quốc tế uy tín: <strong>LS2, Scoyco, Sena, Alpinestars, Furygan, Helite, AGV, Shark, Shoei, Arai</strong> và nhiều thương hiệu khác.</p>
<h2>Sứ mệnh</h2>
<p>Bigbike tự hào là một trong những shop chuyên bán đồ phượt, đồ bảo hộ moto đáng tin cậy tại TP.HCM. Chúng tôi cam kết cung cấp sản phẩm <strong>100% chính hãng</strong>, tư vấn tận tâm và hỗ trợ khách hàng sau mua hàng chu đáo.</p>
<h2>Tại sao chọn BigBike?</h2>
<ul>
<li><strong>Chính hãng 100%</strong>: Tất cả sản phẩm có giấy tờ chứng nhận xuất xứ, không hàng nhái, không hàng xách tay không rõ nguồn gốc.</li>
<li><strong>Tư vấn chuyên sâu</strong>: Đội ngũ am hiểu sản phẩm, sẵn sàng tư vấn chọn đồ phù hợp với phong cách riding và ngân sách của bạn.</li>
<li><strong>Đa dạng thương hiệu</strong>: Hơn 40 thương hiệu từ Ý, Pháp, Nhật, Hàn, Mỹ — từ bình dân đến cao cấp.</li>
<li><strong>Sau bán hàng chu đáo</strong>: Bảo hành chính hãng, hỗ trợ đổi size, hướng dẫn sử dụng và bảo quản sản phẩm.</li>
</ul>
<h2>Thông tin liên hệ</h2>
<p><strong>Địa chỉ</strong>: 79/30/52 Âu Cơ, Phường 14, Quận 11, TP.HCM</p>
<p><strong>Hotline</strong>: 028.62797251 — 0764640679 (Mrs. Thư / Zalo) — 0906902404 (Mr. Trí)</p>
<p><strong>Giờ mở cửa</strong>: Thứ 2 — Thứ 6: 09:00 — 21:00 | Thứ 7, Chủ Nhật: 09:00 — 18:00</p>',
       'ABOUT', 'PUBLISHED',
       'Giới thiệu BigBike — Shop Bảo Hộ Biker TP.HCM',
       'BigBike — chuyên đồ bảo hộ biker, mũ bảo hiểm, áo giáp, găng tay, giày và phụ kiện rider chính hãng từ 2013 tại TP.HCM.',
       'https://bigbike.vn/gioi-thieu/', false,
       '2026-04-01T01:00:00Z', '2026-04-01T01:00:00Z', '2026-04-01T01:00:00Z'
where not exists (select 1 from pages where slug = 'gioi-thieu');
