-- V61: Fix dead canonical URLs for help pages seeded in V21.
--
-- cach-do-size-dau and cach-do-size-gang-tay had canonical URLs pointing to
-- /huong-dan/size-mu/ and /huong-dan/size-gang-tay/ — routes that do not exist
-- in the web frontend (no /huong-dan/[slug] route). The actual serving route
-- is /[slug]/ so canonicals must match.
--
-- Also seeds chinh-sach-bao-hanh page which V21 omitted (V1000 dev-only seed had it).

UPDATE pages
SET seo_canonical_url = 'https://bigbike.vn/cach-do-size-dau/',
    updated_at = updated_at
WHERE slug = 'cach-do-size-dau'
  AND seo_canonical_url = 'https://bigbike.vn/huong-dan/size-mu/';

UPDATE pages
SET seo_canonical_url = 'https://bigbike.vn/cach-do-size-gang-tay/',
    updated_at = updated_at
WHERE slug = 'cach-do-size-gang-tay'
  AND seo_canonical_url = 'https://bigbike.vn/huong-dan/size-gang-tay/';

-- chinh-sach-bao-hanh was only in V1000 (disabled dev seed), not in V21.
-- Add it for all deployments.
INSERT INTO pages (id, slug, title, body, page_type, publish_status,
                   seo_title, seo_description, seo_canonical_url, seo_no_index,
                   published_at, created_at, updated_at)
SELECT 'page_chinh_sach_bao_hanh', 'chinh-sach-bao-hanh',
       'Chính sách bảo hành',
       '<h2>Thời hạn bảo hành</h2>
<p>BigBike cam kết bảo hành sản phẩm theo chính sách của từng thương hiệu, tối thiểu <strong>12 tháng</strong> kể từ ngày mua.</p>
<h2>Phạm vi bảo hành</h2>
<ul>
<li>Lỗi kỹ thuật từ nhà sản xuất (vật liệu, đường may, khóa cài)</li>
<li>Sản phẩm không đạt tiêu chuẩn chất lượng ghi trên nhãn hàng</li>
</ul>
<h2>Không áp dụng bảo hành</h2>
<ul>
<li>Hao mòn tự nhiên do sử dụng</li>
<li>Hỏng hóc do tai nạn, sử dụng sai mục đích hoặc không theo hướng dẫn</li>
<li>Sản phẩm đã được tự ý sửa chữa, thay đổi cấu trúc</li>
</ul>
<h2>Quy trình bảo hành</h2>
<ol>
<li>Liên hệ BigBike qua hotline <strong>028.62797251</strong> hoặc Zalo <strong>0764640679</strong>.</li>
<li>Cung cấp hóa đơn mua hàng và mô tả lỗi.</li>
<li>Gửi sản phẩm về hoặc mang trực tiếp tới cửa hàng: <strong>79/30/52 Âu Cơ, P.14, Q.11, TP.HCM</strong>.</li>
<li>BigBike kiểm tra và xử lý trong 5 — 10 ngày làm việc.</li>
</ol>', 'POLICY', 'PUBLISHED',
       'Chính sách bảo hành sản phẩm | BigBike',
       'Chính sách bảo hành sản phẩm tại BigBike — cam kết bảo hành chính hãng tối thiểu 12 tháng.',
       'https://bigbike.vn/chinh-sach/bao-hanh/', false,
       '2026-04-01T01:00:00Z', '2026-04-01T01:00:00Z', '2026-04-25T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM pages WHERE slug = 'chinh-sach-bao-hanh');
